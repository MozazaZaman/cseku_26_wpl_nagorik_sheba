import { useLang } from '../lib/i18n.jsx';
import { fmtDate } from '../lib/api.js';

/**
 * Citizen-facing lifecycle card: the full journey of a complaint with
 * dates, actor names and comments at every human stage.
 *
 * Chain: submitted → AI → junior check → senior feasibility → mayor
 * permission → WIT → field execution → resolved | rejected.
 */
function StepRow({ icon, tone, title, date, comment, by, byRole, extra = null }) {
  const toneCls = {
    done: 'border-mint/40 bg-mint/10',
    active: 'border-accent/50 bg-accent/10',
    wait: 'border-white/10 bg-white/[0.03]',
    reject: 'border-rose-400/50 bg-rose-500/10'
  }[tone];
  const iconTone = {
    done: 'bg-mint/20 text-mint',
    active: 'bg-accent/20 text-accent animate-pulse',
    wait: 'bg-white/10 text-slate-500',
    reject: 'bg-rose-500/20 text-rose-400'
  }[tone];
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-sm ${toneCls} ${iconTone}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className={`text-sm font-bold ${tone === 'wait' ? 'text-slate-400' : 'text-white'}`}>{title}</p>
          {date && <p className="text-[11px] text-slate-500">{fmtDate(date)}</p>}
        </div>
        {comment && (
          <p className="mt-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
            “{comment}”
          </p>
        )}
        {(by || extra) && (
          <p className="mt-1 text-[11px] text-slate-500">
            {by && <>{by}{byRole && ` · ${byRole}`}</>}
            {extra}
          </p>
        )}
      </div>
    </li>
  );
}

export default function LifecycleCard({ complaint, workflow = [] }) {
  const { t } = useLang();

  const byStage = {};
  for (const s of workflow) (byStage[s.stage] ??= []).push(s);
  const step = (stage, action) => byStage[stage]?.find((s) => s.action === action);
  const stageDone = (stage) =>
    step(stage, 'approved') || step(stage, 'rejected') || step(stage, 'returned') || step(stage, 'assigned');

  const rejected = complaint.status === 'rejected';
  const rejectedStage = complaint.rejected_at_stage;
  const rejectedStep = workflow.filter((s) => s.action === 'rejected').slice(-1)[0];

  const status = complaint.status;
  const witAssigned = step('assignment', 'assigned');
  const startedExec = ['assigned', 'in_process'].includes(status);

  // order: junior → senior → mayor → wit(+assignment) → execution
  const STAGES = [
    { key: 'junior_review', label: t('wf.stage.junior_review'), icon: '🧑‍💼' },
    { key: 'senior_review', label: t('wf.stage.senior_review'), icon: '📋' },
    { key: 'mayor_review', label: t('wf.stage.mayor_review'), icon: '🏛️' },
    { key: 'wit_inspection', label: t('wf.stage.wit_inspection'), icon: '🔍' }
  ];

  const roleLabel = (role) => t(`wf.roleBadge.${role}`) || role;

  return (
    <section className="glass-strong mt-6 p-6">
      <h2 className="font-display text-lg font-extrabold text-white">{t('wf.title')}</h2>
      <p className="mb-4 text-xs text-slate-400">{t('wf.sub')}</p>
      <ul>
        <StepRow icon="📨" tone="done" title={t('wf.step.submitted')} date={complaint.created_at}
          by={complaint.submitter_name} />
        <StepRow icon="🤖" tone="done" title={t('wf.step.aiVerified')}
          by={t('wf.roleBadge.system')}
          extra={complaint.category ? ` · ${t('wf.department')}: ${complaint.category}` : ''} />

        {STAGES.map(({ key, label, icon }) => {
          const done = stageDone(key);
          const isRejectHere = rejected && rejectedStage === key;
          if (done || isRejectHere) {
            const isRejected = done?.action === 'rejected' || isRejectHere;
            const d = done || rejectedStep;
            return (
              <StepRow key={key} icon={isRejected ? '✕' : icon}
                tone={isRejected ? 'reject' : 'done'}
                title={label} date={d?.created_at} comment={d?.comment}
                by={d?.actor_name} byRole={d ? roleLabel(d.actor_role) : null} />
            );
          }
          const reached = STAGES.findIndex((s) => s.key === key) <=
            STAGES.findIndex((s) => s.key === (complaint.current_stage || 'junior_review'));
          return (
            <StepRow key={key} icon={reached && !rejected ? '⏳' : icon}
              tone={rejected ? 'wait' : reached ? 'active' : 'wait'}
              title={label} done={false} />
          );
        })}

        {/* assignment */}
        {witAssigned && (
          <StepRow icon="👷" tone="done" title={t('wf.stage.assignment')}
            date={witAssigned.created_at} comment={witAssigned.comment}
            by={witAssigned.actor_name} byRole={roleLabel(witAssigned.actor_role)}
            extra={complaint.executor_name
              ? ` · ${t('wf.executor')}: ${complaint.executor_name}${complaint.eta_hours ? ` · ETA ${complaint.eta_hours}h` : ''}`
              : ''} />
        )}

        {/* execution */}
        {status === 'resolved' ? (
          <StepRow icon="✅" tone="done" title={t('wf.step.resolved')}
            date={complaint.resolved_at}
            comment={step('execution', 'resolved')?.comment}
            by={step('execution', 'resolved')?.actor_name}
            byRole={step('execution', 'resolved') ? roleLabel('field') : null} />
        ) : rejected ? null : startedExec ? (
          <StepRow icon="🔄" tone="active" title={t('wf.stage.execution')}
            by={complaint.executor_name}
            extra={complaint.eta_hours ? ` · ETA ${complaint.eta_hours}h` : ''} done={false} />
        ) : (
          <StepRow icon="⏳" tone="wait" title={t('wf.step.resolved')} done={false} />
        )}
      </ul>

      {rejected && (
        <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          ✕ {t('wf.rejectedAt')}: <strong>{t(`wf.stage.${rejectedStage}`)}</strong>
          {rejectedStep?.comment && ` — “${rejectedStep.comment}”`}
        </p>
      )}
    </section>
  );
}
