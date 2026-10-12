import { db, notify, logWorkflowStep } from '../db.js';
import { sendMail } from './emailer.js';
import { armSla } from './sla.js';
import { checkMilestonesOnResolution } from './badges.js';
import path from 'path';

/**
 * Hierarchical workflow AFTER the 5-agent AI pipeline:
 *
 *   Citizen → AI → JUNIOR staff (initial check → comment → forward)
 *          → SENIOR staff (real? solvable? manpower? money? → forward)
 *          → MAYOR/CHAIRMAN (permission → back to SENIOR)
 *          → SENIOR sends to WORK INSPECTION TEAM (WIT)
 *          → WIT inspects and ASSIGNS FIELD staff
 *          → FIELD staff starts & solves → resolved.
 *
 * Rejection is possible at junior, senior and mayor checks.
 * WIT never rejects — it only assigns. Rejected complaints stay
 * visible to every staff role (junior/senior/mayor/wit/field).
 *
 * Statuses: verified → junior_review → senior_review → mayor_review
 *           → wit_review → assigned → in_process → resolved | rejected
 */

export const STAGE_LABELS = {
  junior_review: 'Junior Staff Check',
  senior_review: 'Senior Staff Feasibility',
  mayor_review: 'Mayor / Chairman Permission',
  wit_inspection: 'Work Inspection Team',
  assignment: 'Assignment',
  execution: 'Execution'
};

export function stageFor(status) {
  switch (status) {
    case 'verified':
    case 'junior_review':
      return { stage: 'junior_review', owner: 'junior' };
    case 'senior_review':
      return { stage: 'senior_review', owner: 'senior' };
    case 'mayor_review':
      return { stage: 'mayor_review', owner: 'mayor' };
    case 'wit_review':
      return { stage: 'wit_inspection', owner: 'wit' };
    case 'assigned':
    case 'in_process':
      return { stage: 'execution', owner: 'field' };
    case 'resolved':
      return { stage: 'execution', owner: null };
    default:
      return { stage: null, owner: null };
  }
}

async function setStage(complaintId, stage, ownerRole) {
  await db.prepare("UPDATE complaints SET current_stage = ?, stage_owner_role = ?, updated_at = NOW() WHERE complaint_id = ?")
    .run(stage, ownerRole, complaintId);
}

async function setStatus(complaintId, status, { etaHours = null, executorStaffId = null, executorName = null, rejectedAtStage = null } = {}) {
  await db.prepare(
    `UPDATE complaints SET status = ?,
       eta_hours = COALESCE(?, eta_hours),
       executor_staff_id = COALESCE(?, executor_staff_id),
       executor_name = COALESCE(?, executor_name),
       rejected_at_stage = COALESCE(?, rejected_at_stage),
       resolved_at = CASE WHEN ? = 'resolved' THEN NOW() ELSE resolved_at END,
       updated_at = NOW()
     WHERE complaint_id = ?`
  ).run(status, etaHours, executorStaffId, executorName, rejectedAtStage, status, complaintId);
  const { stage, owner } = stageFor(status);
  if (stage) await setStage(complaintId, stage, owner);
  // (Re)arm the SLA clock for the new stage (no-op for terminal states)
  await armSla(complaintId);
}

async function staffOfAuthority(authorityId, staffRole) {
  return await db.prepare(
    `SELECT staff_id, full_name, email FROM staff
     WHERE authority_id = ? AND staff_role = ? ORDER BY staff_id LIMIT 1`
  ).get(authorityId, staffRole);
}

async function addHistory(complaintId, oldStatus, newStatus, note, changedBy) {
  await db.prepare(
    `INSERT INTO status_history (complaint_id, old_status, new_status, note, changed_by)
     VALUES (?, ?, ?, ?, ?)`
  ).run(complaintId, oldStatus, newStatus, note, changedBy);
}

/** Email + in-app notify the staff member(s) of a role in the authority. */
async function notifyStaffRole(authorityId, staffRole, complaint, headline, type = 'status_change') {
  const staff = await staffOfAuthority(authorityId, staffRole);
  if (!staff) return;
  await sendMail({
    to: staff.email,
    subject: `[Nagorik Sheba] ${headline} — complaint #${complaint.complaint_id}`,
    text: `${headline}\n\nTicket #${complaint.complaint_id}: ${complaint.title}\nOpen your staff console to take action.\n\n— Nagorik Sheba`
  }).catch(() => {});
  await notify(staff.staff_id, complaint.complaint_id, headline,
    `#${complaint.complaint_id} "${complaint.title}" is waiting in your queue.`, 'staff', type);
}

/** Email + in-app notify the citizen (submitter) and every voter. */
async function notifyCitizenAndVoters(complaint, title, message, type = 'status_change') {
  const citizen = await db.prepare('SELECT user_id, email, full_name FROM users WHERE user_id = ?').get(complaint.user_id);
  if (citizen) {
    sendMail({
      to: citizen.email,
      subject: `[Nagorik Sheba] ${title} — complaint #${complaint.complaint_id}`,
      text: `Dear ${citizen.full_name},\n\n${message}\n\nComplaint: "${complaint.title}" (#${complaint.complaint_id})\nTrack the full lifecycle in the app or on the website.\n\n— Nagorik Sheba`
    }).catch(() => {});
    await notify(citizen.user_id, complaint.complaint_id, title, message, 'citizen', type);
  }
  const voters = await db.prepare(
    'SELECT DISTINCT user_id FROM votes WHERE complaint_id = ? AND user_id != ?'
  ).all(complaint.complaint_id, complaint.user_id);
  for (const v of voters) {
    await notify(v.user_id, complaint.complaint_id, `Update on an issue you voted for (#${complaint.complaint_id})`,
      `"${complaint.title}" — ${message}`, 'citizen', type);
  }
}

export class WorkflowError extends Error {
  constructor(message, code = 400) {
    super(message);
    this.code = code;
  }
}

const APPROVERS = ['junior', 'senior', 'mayor']; // roles that can reject

/**
 * Apply a workflow action. Actions:
 *   junior_approve / junior_reject   (junior)
 *   senior_approve / senior_reject   (senior)
 *   mayor_approve  / mayor_reject    (mayor)
 *   send_to_wit                      (senior — after mayor permission)
 *   wit_assign                       (WIT — assigns field staff + ETA)
 *   field_start / field_resolve      (assigned field staff)
 */
export async function applyWorkflowAction({ complaint, action, actor, comment, etaHours, executorStaffId, resolutionImageUrl = null }) {
  const status = complaint.status;
  const id = complaint.complaint_id;
  const role = actor.staff_role;

  const needComment = () => {
    if (!comment || !comment.trim()) throw new WorkflowError('A comment is required for this action');
  };
  const guard = (allowedRole, expectedStatuses) => {
    if (role !== allowedRole) throw new WorkflowError(`Only ${allowedRole} staff can perform this action`, 403);
    const expected = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
    if (!expected.includes(status)) throw new WorkflowError(`Cannot ${action}: complaint is currently "${status}"`);
  };
  const reject = async (stageKey, stageLabel) => {
    needComment();
    await setStatus(id, 'rejected', { rejectedAtStage: stageKey });
    await logWorkflowStep({
      complaintId: id, stage: stageKey, action: 'rejected',
      actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: role, comment: comment.trim()
    });
    await addHistory(id, status, 'rejected', comment.trim(), actor.full_name);
    await notifyCitizenAndVoters(complaint, `Complaint rejected at ${stageLabel}`,
      `${actor.full_name} rejected the complaint: "${comment.trim()}"`, 'rejected');
    return { status: 'rejected' };
  };

  switch (action) {
    // ---------- JUNIOR: initial check ----------
    case 'junior_approve': {
      guard('junior', ['verified', 'junior_review']);
      needComment();
      await setStatus(id, 'senior_review');
      await logWorkflowStep({
        complaintId: id, stage: 'junior_review', action: 'approved',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'junior', comment: comment.trim()
      });
      await addHistory(id, 'junior_review', 'senior_review', comment.trim(), actor.full_name);
      await notifyStaffRole(complaint.authority_id, 'senior', complaint, 'New complaint needs senior feasibility check', 'forwarded_to_you');
      await notifyCitizenAndVoters(complaint, 'Initial check passed',
        `${actor.full_name} (Junior Staff) completed the initial check: "${comment.trim()}" It is now with the Senior Staff for feasibility review.`, 'status_change');
      return { status: 'senior_review' };
    }
    case 'junior_reject':
      guard('junior', ['verified', 'junior_review']);
      return reject('junior_review', 'Junior Staff check');

    // ---------- SENIOR: feasibility (real, solvable, manpower, money) ----------
    case 'senior_approve': {
      guard('senior', 'senior_review');
      needComment();
      await setStatus(id, 'mayor_review');
      await logWorkflowStep({
        complaintId: id, stage: 'senior_review', action: 'approved',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'senior', comment: comment.trim()
      });
      await addHistory(id, 'senior_review', 'mayor_review', comment.trim(), actor.full_name);
      await notifyStaffRole(complaint.authority_id, 'mayor', complaint, 'Complaint awaiting your permission', 'permission_required');
      await notifyCitizenAndVoters(complaint, 'Feasibility passed — awaiting Mayor/Chairman permission',
        `${actor.full_name} (Senior Staff) confirmed the problem is real, solvable, and resources (manpower/budget) are available: "${comment.trim()}" It now awaits the Mayor/Chairman's permission.`, 'status_change');
      return { status: 'mayor_review' };
    }
    case 'senior_reject':
      guard('senior', 'senior_review');
      return reject('senior_review', 'Senior Staff feasibility check');

    // ---------- MAYOR: permission ----------
    case 'mayor_approve': {
      guard('mayor', 'mayor_review');
      needComment();
      await setStatus(id, 'approved');
      await logWorkflowStep({
        complaintId: id, stage: 'mayor_review', action: 'approved',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'mayor', comment: comment.trim()
      });
      await addHistory(id, 'mayor_review', 'approved', comment.trim(), actor.full_name);
      // Mayor permission flows back to senior staff, who then sends to WIT
      await notifyStaffRole(complaint.authority_id, 'senior', complaint, 'Permission granted — send to Work Inspection Team', 'forwarded_to_you');
      await notifyCitizenAndVoters(complaint, 'Permission granted by Mayor/Chairman',
        `${actor.full_name} granted permission for the work: "${comment.trim()}" Senior Staff will now forward it to the Work Inspection Team.`, 'status_change');
      return { status: 'approved' };
    }
    case 'mayor_reject':
      guard('mayor', 'mayor_review');
      return reject('mayor_review', 'Mayor/Chairman permission');

    // ---------- SENIOR: forward to Work Inspection Team ----------
    case 'send_to_wit': {
      guard('senior', 'approved');
      needComment();
      await setStatus(id, 'wit_review');
      await logWorkflowStep({
        complaintId: id, stage: 'wit_inspection', action: 'pending',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'senior', comment: comment.trim()
      });
      await addHistory(id, 'approved', 'wit_review', comment.trim(), actor.full_name);
      await notifyStaffRole(complaint.authority_id, 'wit', complaint, 'Complaint ready for work inspection', 'forwarded_to_you');
      await notifyCitizenAndVoters(complaint, 'Sent to Work Inspection Team',
        `${actor.full_name} (Senior Staff) sent the complaint to the Work Inspection Team: "${comment.trim()}" A field staff will be assigned shortly.`, 'status_change');
      return { status: 'wit_review' };
    }

    // ---------- WIT: inspect + assign field staff (never rejects) ----------
    case 'wit_assign': {
      guard('wit', 'wit_review');
      needComment();
      const executor = await db.prepare('SELECT staff_id, full_name, email FROM staff WHERE staff_id = ? AND staff_role = ?')
        .get(executorStaffId, 'field');
      if (!executor) throw new WorkflowError('Executor must be a Field Staff of this authority');
      const eta = parseInt(etaHours);
      if (!eta || eta <= 0) throw new WorkflowError('Please provide an ETA in hours');
      await setStatus(id, 'assigned', { etaHours: eta, executorStaffId: executor.staff_id, executorName: executor.full_name });
      await logWorkflowStep({
        complaintId: id, stage: 'assignment', action: 'assigned',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'wit', comment: comment.trim()
      });
      await addHistory(id, 'wit_review', 'assigned', `${executor.full_name} assigned by WIT. ${comment.trim()}`, actor.full_name);
      sendMail({
        to: executor.email,
        subject: `[Nagorik Sheba] Complaint #${id} assigned to you`,
        text: `You have been assigned to solve complaint #${id}: "${complaint.title}"\nETA: ${eta} hours.\n${comment.trim()}\n\n— Nagorik Sheba`
      }).catch(() => {});
      await notify(executor.staff_id, id, 'Complaint assigned to you',
        `#${id} "${complaint.title}" — please start work. ETA ${eta}h.`, 'staff', 'assignment');
      await notifyCitizenAndVoters(complaint, 'Work team assigned',
        `The Work Inspection Team assigned ${executor.full_name} to solve the problem. Estimated time: ${eta} hours.`, 'assignment');
      return { status: 'assigned' };
    }

    // ---------- FIELD: execute ----------
    case 'field_start': {
      if (role !== 'field') throw new WorkflowError('Only the assigned Field Staff can start', 403);
      if (status !== 'assigned') throw new WorkflowError(`Cannot start: complaint is "${status}"`);
      if (complaint.executor_staff_id !== actor.staff_id) throw new WorkflowError('Only the assigned executor can start this work', 403);
      await setStatus(id, 'in_process');
      await logWorkflowStep({
        complaintId: id, stage: 'execution', action: 'reviewing',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'field', comment: 'Work started on the ground'
      });
      await addHistory(id, 'assigned', 'in_process', 'Field work started.', actor.full_name);
      await notifyStaffRole(complaint.authority_id, 'wit', complaint, 'Field work has started', 'status_change');
      await notifyCitizenAndVoters(complaint, 'Problem solving started',
        `The problem solving is in progress by ${actor.full_name}. Estimated time: ${complaint.eta_hours ?? etaHours ?? '?'} hours.`, 'status_change');
      return { status: 'in_process' };
    }

    case 'field_resolve': {
      if (role !== 'field') throw new WorkflowError('Only the assigned Field Staff can mark done', 403);
      if (!['assigned', 'in_process'].includes(status)) throw new WorkflowError(`Cannot resolve: complaint is "${status}"`);
      if (complaint.executor_staff_id !== actor.staff_id) throw new WorkflowError('Only the assigned executor can complete this work', 403);
      needComment();
      await setStatus(id, 'resolved');
      // Resolution proof + citizen confirmation window
      const confirmDays = parseInt(process.env.RESOLVE_CONFIRM_DAYS || '3', 10);
      const hasProof = resolutionImageUrl
        || (await db.prepare('SELECT resolution_image_url FROM complaints WHERE complaint_id = ?').get(id))?.resolution_image_url;
      if (hasProof) {
        await db.prepare(
          `UPDATE complaints SET resolution_image_url = COALESCE($1, resolution_image_url),
             confirmation_deadline = NOW() + (($2)::text || ' days')::interval,
             resolved_confirmed_by_citizen = 0
           WHERE complaint_id = $3`
        ).run(resolutionImageUrl, confirmDays, id);
      }
      await logWorkflowStep({
        complaintId: id, stage: 'execution', action: 'resolved',
        actorStaffId: actor.staff_id, actorName: actor.full_name, actorRole: 'field',
        comment: resolutionImageUrl
          ? (/^https?:\/\//i.test(resolutionImageUrl) ? `${comment.trim()} [resolution photo: ${resolutionImageUrl}]` : `${comment.trim()} [resolution photo: /uploads/${path.basename(resolutionImageUrl)}]`)
          : comment.trim()
      });
      await addHistory(id, status, 'resolved',
        resolutionImageUrl
          ? `${comment.trim()} (Resolution proof attached)`
          : comment.trim(), actor.full_name);
      await notifyCitizenAndVoters(complaint, 'Problem resolved',
        `"${complaint.title}" has been marked as DONE by ${actor.full_name}: "${comment.trim()}"` +
        (hasProof
          ? ` A resolution photo was attached. If you are the submitter, please confirm the work — otherwise it reopens automatically after ${confirmDays} days.`
          : ' Thank you for making your city better.'), 'resolved');
      // senior staff + mayor keep oversight of all work
      await notifyStaffRole(complaint.authority_id, 'wit', complaint, 'Resolution ready for confirmation', 'resolution_confirmed');
      await notifyStaffRole(complaint.authority_id, 'senior', complaint, 'Complaint resolved on the ground', 'resolved');
      await notifyStaffRole(complaint.authority_id, 'mayor', complaint, 'Complaint resolved on the ground', 'resolved');
      // Milestone badges are evaluated promptly at resolution time rather than
      // waiting for the weekly rolling sweep (first10 / century / veteran).
      try { await checkMilestonesOnResolution(id); } catch (e) { console.error('badge milestone check failed:', e.message); }
      return { status: 'resolved' };
    }

    default:
      throw new WorkflowError(`Unknown workflow action: ${action}`);
  }
}

/** Statuses visible in a role's own action queue. */
export async function queueForRole(staffRole) {
  switch (staffRole) {
    case 'junior': return ['verified', 'junior_review'];
    case 'senior': return ['senior_review', 'approved'];
    case 'mayor': return ['mayor_review'];
    case 'wit': return ['wit_review'];
    case 'field': return ['assigned', 'in_process'];
    default: return ['verified', 'junior_review', 'senior_review', 'mayor_review', 'approved', 'wit_review', 'assigned', 'in_process'];
  }
}

/** All complaints of the authority — for senior staff & mayor oversight. */
export async function allOversightStatuses() {
  return ['verified', 'junior_review', 'senior_review', 'mayor_review', 'approved', 'wit_review', 'assigned', 'in_process', 'resolved', 'rejected'];
}

export const APPROVER_ROLES = APPROVERS;

/** Record the AI-pipeline handoff: complaint enters junior review. */
export async function enterJuniorReview(complaintId, authorityId, title) {
  await db.prepare(
    `UPDATE complaints SET current_stage = 'junior_review', stage_owner_role = 'junior', updated_at = NOW()
     WHERE complaint_id = ?`
  ).run(complaintId);
  await logWorkflowStep({
    complaintId, stage: 'junior_review', action: 'pending',
    actorName: 'AI Pipeline', actorRole: 'system',
    comment: 'Verified by agents — waiting for Junior Staff initial check'
  });
  await armSla(complaintId);
  const junior = await staffOfAuthority(authorityId, 'junior');
  if (junior) {
    sendMail({
      to: junior.email,
      subject: `[Nagorik Sheba] New complaint #${complaintId} for initial check`,
      text: `A new complaint passed the AI agent pipeline and is waiting for your initial check.\n\n#${complaintId}: ${title}\n\n— Nagorik Sheba`
    }).catch(() => {});
    await notify(junior.staff_id, complaintId, 'New complaint for initial check',
      `#${complaintId} "${title}" passed AI verification — please check and forward it to Senior Staff.`, 'staff', 'forwarded_to_you');
  }
}
