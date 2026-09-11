import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class ComplaintDetailScreen extends StatefulWidget {
  final int id;
  const ComplaintDetailScreen({super.key, required this.id});

  @override
  State<ComplaintDetailScreen> createState() => _ComplaintDetailScreenState();
}

class _ComplaintDetailScreenState extends State<ComplaintDetailScreen> {
  final api = ApiService();
  bool loading = true;
  String? error;
  Complaint? c;
  List<HistoryItem> history = [];
  List<AgentLogItem> agents = [];
  List<WorkflowStep> workflow = [];
  List<String> myActions = [];
  List<Map<String, dynamic>> executors = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await api.complaintDetail(widget.id);
      if (!mounted) return;
      setState(() {
        c = d['complaint'];
        history = d['history'];
        agents = d['agents'];
        workflow = d['workflow'] ?? [];
        myActions = (d['my_actions'] as List<String>? ?? []);
        loading = false;
      });
      if (myActions.contains('wit_assign')) {
        try {
          final e = await api.executors();
          if (mounted) setState(() => executors = e);
        } catch (_) {}
      }
    } catch (e) {
      setState(() {
        error = 'Could not load complaint';
        loading = false;
      });
    }
  }

  Future<void> _vote() async {
    final lang = context.read<Lang>();
    if (c == null) return;
    if (['assigned', 'in_process'].contains(c!.status)) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(lang.t('exp.voted.locked')),
          backgroundColor: NSColors.amber));
      return;
    }
    try {
      await api.vote(c!.id);
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _workflowAction(String action) async {
    final lang = context.read<Lang>();
    final commentCtrl = TextEditingController();
    final etaCtrl = TextEditingController(text: '48');
    int? executorId = executors.isNotEmpty ? executors.first['staff_id'] as int : null;

    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: NSColors.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(22, 22, 22, MediaQuery.of(sheetCtx).viewInsets.bottom + 22),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lang.t('act.$action'), style: whiteTitle(size: 17)),
            const SizedBox(height: 6),
            Text('#${c!.id} · ${c!.title}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: Colors.white38, fontSize: 12)),
            const SizedBox(height: 16),
            if (action == 'wit_assign' && executors.isNotEmpty) ...[
              DropdownButtonFormField<int>(
                value: executorId,
                decoration: InputDecoration(hintText: lang.t('act.executor')),
                items: executors.map((e) => DropdownMenuItem(
                    value: e['staff_id'] as int, child: Text(e['full_name'], style: const TextStyle(color: Colors.white)))).toList(),
                onChanged: (v) => setSheet(() => executorId = v),
              ),
              const SizedBox(height: 12),
              TextField(controller: etaCtrl, keyboardType: TextInputType.number,
                  decoration: InputDecoration(hintText: lang.t('act.eta'))),
              const SizedBox(height: 12),
            ],
            TextField(controller: commentCtrl, maxLines: 3,
                decoration: InputDecoration(hintText: lang.t('act.comment'))),
            const SizedBox(height: 18),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () => Navigator.pop(sheetCtx, true),
                child: Text(lang.t('staff.confirm')),
              ),
            ),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    try {
      await api.workflowAction(
        c!.id, action,
        comment: commentCtrl.text,
        etaHours: action == 'wit_assign' ? int.tryParse(etaCtrl.text) : null,
        executorStaffId: action == 'wit_assign' ? executorId : null,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(lang.t('act.done')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Widget _lifecycleStep({
    required String icon,
    required Color color,
    required String title,
    String? date,
    String? comment,
    String? by,
    bool dim = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          margin: const EdgeInsets.only(top: 2),
          width: 34, height: 34,
          decoration: BoxDecoration(
            color: color.withOpacity(dim ? 0.08 : 0.15),
            shape: BoxShape.circle,
            border: Border.all(color: color.withOpacity(dim ? 0.25 : 0.5)),
          ),
          child: Center(child: Text(icon, style: const TextStyle(fontSize: 15))),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: TextStyle(
                  color: dim ? Colors.white38 : Colors.white,
                  fontWeight: FontWeight.w700, fontSize: 13.5)),
          if (date != null)
            Text(date, style: const TextStyle(color: Colors.white24, fontSize: 11)),
          if (comment != null && comment.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.white10),
              ),
              child: Text('“$comment”',
                  style: const TextStyle(color: Colors.white54, fontSize: 11.5)),
            ),
          if (by != null)
            Padding(padding: const EdgeInsets.only(top: 3),
                child: Text(by, style: const TextStyle(color: Colors.white24, fontSize: 10.5))),
        ])),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Scaffold(
      appBar: AppBar(title: Text('${lang.t('res.ticket')}${widget.id}')),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : error != null
              ? Center(child: ErrorBanner(error!))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            CategoryChip(c!.category),
                            const SizedBox(width: 8),
                            StatusChip(c!.status),
                            const Spacer(),
                            Text('▲ ${c!.voteCount}',
                                style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 16)),
                          ]),
                          const SizedBox(height: 12),
                          Text(c!.title,
                              style: const TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text(c!.description,
                              style: const TextStyle(color: Colors.white54, fontSize: 13.5, height: 1.5)),
                          if (['assigned', 'in_process'].contains(c!.status)) ...[
                            const SizedBox(height: 12),
                            InfoBanner('${lang.t('det.locked')}'
                                '${c!.etaHours != null ? " · ${lang.t('det.eta')}${c!.etaHours}h" : ""}'),
                          ],
                          if (c!.status == 'resolved') ...[
                            const SizedBox(height: 12),
                            InfoBanner(lang.t('det.resolvedDone'), color: NSColors.mint),
                          ],
                          if (!c!.isMine &&
                              ['submitted', 'verified', 'under_field_review', 'mid_review', 'mayor_review']
                                  .contains(c!.status)) ...[
                            const SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: c!.votedByMe ? null : _vote,
                                icon: Icon(c!.votedByMe ? Icons.check_rounded : Icons.how_to_vote_rounded),
                                label: Text(c!.votedByMe ? lang.t('exp.voted') : lang.t('exp.upvote')),
                              ),
                            ),
                          ],
                        ]),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // ---- Workflow actions (role-aware) ----
                    if (myActions.isNotEmpty) ...[
                      GlassBox(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(lang.t('wf.role.${c!.stageOwnerRole ?? 'field'}'),
                              style: whiteTitle(size: 16)),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8, runSpacing: 8,
                            children: myActions.map((a) {
                              final isReject = a.contains('reject');
                              return FilledButton.icon(
                                onPressed: () => _workflowAction(a),
                                style: FilledButton.styleFrom(
                                  backgroundColor: isReject
                                      ? NSColors.rose.withOpacity(0.25)
                                      : NSColors.accent.withOpacity(0.3),
                                  foregroundColor: isReject ? NSColors.rose : Colors.white,
                                ),
                                icon: Icon(isReject ? Icons.close_rounded : Icons.check_rounded, size: 17),
                                label: Text(lang.t('act.$a'), style: const TextStyle(fontSize: 12)),
                              );
                            }).toList(),
                          ),
                        ]),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // ---- Lifecycle card (transparency) ----
                    GlassBox(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(lang.t('wf.title'), style: whiteTitle(size: 16)),
                        const SizedBox(height: 12),
                        _lifecycleStep(icon: '📨', color: NSColors.mint,
                            title: lang.t('wf.submitted'), date: c!.createdAt, by: c!.submitterName),
                        _lifecycleStep(icon: '🤖', color: NSColors.mint,
                            title: lang.t('wf.aiVerified'), by: lang.t('wf.role.system')),

                        // Junior check
                        ..._stageBlock('junior_review', 'wf.junior', '🧑‍💼', NSColors.accent),
                        // Senior feasibility
                        ..._stageBlock('senior_review', 'wf.senior', '📋', NSColors.accent2),
                        // Mayor permission
                        ..._stageBlock('mayor_review', 'wf.mayor', '🏛️', NSColors.amber),
                        // Work Inspection Team
                        ..._stageBlock('wit_inspection', 'wf.wit', '🔍', NSColors.mint),

                        // Assignment
                        if (_step('assignment', 'assigned') != null)
                          _lifecycleStep(
                              icon: '👥', color: NSColors.accent,
                              title: lang.t('wf.assign'),
                              date: _step('assignment', 'assigned')!.createdAt,
                              comment: _step('assignment', 'assigned')!.comment,
                              by: '${_step('assignment', 'assigned')!.actorName} · ${lang.t('wf.executor')}: ${c!.executorName ?? "—"}'),

                        // Execution / resolved
                        if (c!.status == 'resolved')
                          _lifecycleStep(
                              icon: '✅', color: NSColors.mint,
                              title: lang.t('wf.resolved'),
                              date: c!.createdAt,
                              comment: _step('execution', 'resolved')?.comment,
                              by: _step('execution', 'resolved')?.actorName)
                        else if (c!.status == 'rejected')
                          _lifecycleStep(
                              icon: '✕', color: NSColors.rose,
                              title: '${lang.t('wf.rejectedAt')}: ${lang.t(_stageLabel(c!.rejectedAtStage))}',
                              comment: _rejectComment(),
                              by: _rejectBy())
                        else if (['assigned', 'in_process'].contains(c!.status))
                          _lifecycleStep(
                              icon: '🔄', color: NSColors.amber,
                              title: lang.t('wf.exec'),
                              by: '${c!.executorName ?? "—"}${c!.etaHours != null ? " · ETA ${c!.etaHours}h" : ""}')
                        else
                          _lifecycleStep(icon: '⏳', color: Colors.white24,
                              title: lang.t('wf.awaiting'), dim: true),
                      ]),
                    ),
                    const SizedBox(height: 16),

                    GlassBox(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(lang.t('det.agents'), style: whiteTitle(size: 16)),
                        const SizedBox(height: 4),
                        Text(lang.t('det.agentsSub'),
                            style: const TextStyle(color: Colors.white24, fontSize: 11.5)),
                        const SizedBox(height: 12),
                        ...agents.map((a) => Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.03),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white10)),
                              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                const Text('🤖', style: TextStyle(fontSize: 15)),
                                const SizedBox(width: 10),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(AgentLogItem.prettyNames[a.agentName] ?? a.agentName,
                                      style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w700, fontSize: 12.5)),
                                  if (a.output != null)
                                    Padding(padding: const EdgeInsets.only(top: 3),
                                        child: Text(a.output!,
                                            style: const TextStyle(color: Colors.white38, fontSize: 11.5))),
                                ])),
                              ]),
                            )),
                        if (agents.isEmpty)
                          Text(lang.t('det.noAgents'),
                              style: const TextStyle(color: Colors.white24, fontSize: 12.5)),
                      ]),
                    ),
                    const SizedBox(height: 16),

                    if (history.isNotEmpty)
                      GlassBox(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(lang.t('det.timeline'), style: whiteTitle(size: 16)),
                          const SizedBox(height: 14),
                          ...history.map((h) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Column(children: [
                                    Container(
                                      margin: const EdgeInsets.only(top: 4),
                                      width: 10, height: 10,
                                      decoration: const BoxDecoration(gradient: NSGradient.box, shape: BoxShape.circle),
                                    ),
                                    Container(width: 1.5, height: 26, color: Colors.white10),
                                  ]),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text('${h.oldStatus.isEmpty ? "—" : h.oldStatus} → ${h.newStatus.replaceAll("_", " ")}',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
                                    if (h.note != null && h.note!.isNotEmpty)
                                      Text(h.note!, style: const TextStyle(color: Colors.white38, fontSize: 12)),
                                    Text(h.changedBy, style: const TextStyle(color: Colors.white24, fontSize: 11)),
                                  ])),
                                ]),
                              )),
                        ]),
                      ),
                  ]),
                ),
    );
  }

  WorkflowStep? _step(String stage, String action) {
    try {
      return workflow.firstWhere((s) => s.stage == stage && s.action == action);
    } catch (_) {
      return null;
    }
  }

  WorkflowStep? _lastByAction(String action) {
    final list = workflow.where((s) => s.action == action).toList();
    return list.isEmpty ? null : list.last;
  }

  String? _rejectComment() => _lastByAction('rejected')?.comment;
  String? _rejectBy() => _lastByAction('rejected')?.actorName;

  String _stageLabel(String? stage) {
    switch (stage) {
      case 'junior_review': return 'wf.junior';
      case 'senior_review': return 'wf.senior';
      case 'mayor_review': return 'wf.mayor';
      case 'wit_inspection': return 'wf.wit';
      default: return 'wf.awaiting';
    }
  }

  // Renders the (single) decisive step of a review stage, or a dim placeholder
  List<Widget> _stageBlock(String stage, String labelKey, String icon, Color color) {
    final done = _step(stage, 'approved') ?? _step(stage, 'rejected') ?? _step(stage, 'returned');
    if (done != null) {
      final isReject = done.action == 'rejected';
      return [
        _lifecycleStep(
            icon: isReject ? '✕' : icon,
            color: isReject ? NSColors.rose : color,
            title: langLabelFor(labelKey),
            date: done.createdAt,
            comment: done.comment,
            by: '${done.actorName} · ${context.read<Lang>().t('wf.role.${done.actorRole}')}')
      ];
    }
    final isActive = c!.currentStage == stage;
    return [
      _lifecycleStep(
          icon: isActive ? '⏳' : icon,
          color: color,
          title: langLabelFor(labelKey),
          dim: !isActive)
    ];
  }

  String langLabelFor(String key) => context.read<Lang>().t(key);
}
