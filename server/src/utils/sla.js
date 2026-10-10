import { db } from '../db.js';

/**
 * SLA (Service Level Agreement) timers for the hierarchical workflow.
 *
 * Each staff stage has a base time budget. The effective budget shrinks for
 * high-priority complaints (Agent-04 score = votes x 4 + severity x 12 + age):
 *
 *   priority_score > 80  -> 0.5x  (urgent: half the normal time)
 *   priority_score 40-80 -> 0.75x
 *   priority_score < 40  -> 1.0x  (normal)
 *
 * Behaviors on breach (checked by the hourly sweep in index.js):
 *   1. deadline missed        -> flag overdue, notify stage owner + superior
 *   2. deadline + grace period -> AUTO-FORWARD past the stalled staff member
 *      (junior -> senior -> mayor -> handoff-to-WIT; the WIT assignment and
 *      field execution stages cannot be auto-decided — human judgement /
 *      physical work — so they only get repeat escalation pings).
 */

export const SLA_BASE_DAYS = {
  junior_review: 3,
  senior_review: 3,
  mayor_review: 5,
  handoff: 2,        // mayor approved; senior must click "send to WIT"
  wit_inspection: 2,
  execution: 7
};

// Extra days past the deadline before the system force-forwards the complaint.
export const SLA_GRACE_DAYS = 2;

// Repeat escalation ping interval for stages that cannot auto-forward.
export const SLA_REPING_HOURS = 24;

export function slaScalingFactor(priorityScore) {
  if (priorityScore > 80) return 0.5;
  if (priorityScore >= 40) return 0.75;
  return 1.0;
}

export function effectiveSlaDays(stage, priorityScore) {
  const base = SLA_BASE_DAYS[stage] ?? 3;
  return Math.max(0.5, base * slaScalingFactor(priorityScore ?? 0));
}

/**
 * Statuses the SLA sweep watches, mapped to their stage config.
 * forward: true = auto-forwardable on grace breach (owner can be bypassed).
 */
export const SLA_STAGES = {
  verified: { stage: 'junior_review', forward: true, ownerRole: 'junior', superiorRole: 'senior' },
  junior_review: { stage: 'junior_review', forward: true, ownerRole: 'junior', superiorRole: 'senior' },
  senior_review: { stage: 'senior_review', forward: true, ownerRole: 'senior', superiorRole: 'mayor' },
  mayor_review: { stage: 'mayor_review', forward: true, ownerRole: 'mayor', superiorRole: null },
  approved: { stage: 'handoff', forward: true, ownerRole: 'senior', superiorRole: 'mayor' },
  wit_review: { stage: 'wit_inspection', forward: false, ownerRole: 'wit', superiorRole: 'senior' },
  assigned: { stage: 'execution', forward: false, ownerRole: 'field', superiorRole: 'wit' },
  in_process: { stage: 'execution', forward: false, ownerRole: 'field', superiorRole: 'wit' }
};

/** Where an auto-forward lands, per stage. */
export const SLA_FORWARD_MAP = {
  junior_review: { nextStatus: 'senior_review', nextStage: 'senior_review', nextOwnerRole: 'senior' },
  senior_review: { nextStatus: 'mayor_review', nextStage: 'mayor_review', nextOwnerRole: 'mayor' },
  mayor_review: { nextStatus: 'approved', nextStage: 'mayor_review', nextOwnerRole: 'senior' },
  handoff: { nextStatus: 'wit_review', nextStage: 'wit_inspection', nextOwnerRole: 'wit' }
};

/**
 * (Re)arm the SLA clock for a complaint's current stage. Called on every
 * stage transition (staff action or auto-forward) — sets stage_entered_at,
 * recomputes sla_deadline from the CURRENT priority score, clears the flag.
 */
export async function armSla(complaintId) {
  const c = await db.prepare('SELECT status, priority_score FROM complaints WHERE complaint_id = ?').get(complaintId);
  if (!c) return;
  const cfg = SLA_STAGES[c.status];
  if (!cfg) {
    await db.prepare('UPDATE complaints SET stage_entered_at = NULL, sla_deadline = NULL, overdue_flag = 0 WHERE complaint_id = ?')
      .run(complaintId);
    return;
  }
  const days = effectiveSlaDays(cfg.stage, c.priority_score);
  await db.prepare(
    `UPDATE complaints
     SET stage_entered_at = NOW(),
         sla_deadline = NOW() + (($1)::text || ' days')::interval,
         overdue_flag = 0,
         updated_at = NOW()
     WHERE complaint_id = $2`
  ).run(days, complaintId);
}

/** Grace deadline = sla_deadline + SLA_GRACE_DAYS, as a Date (or null). */
export function graceDeadline(complaint) {
  if (!complaint?.sla_deadline) return null;
  return new Date(new Date(complaint.sla_deadline + 'Z').getTime() + SLA_GRACE_DAYS * 86400000);
}
