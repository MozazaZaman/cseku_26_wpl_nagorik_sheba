import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../config.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/camera_capture.dart';
import '../widgets/map_layers.dart';
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
  List<DuplicateReport> duplicates = [];
  Map<String, dynamic>? authStats;
  int? _score;
  final _satComment = TextEditingController();
  bool satBusy = false;
  final _layer = ValueNotifier<String>('map');

  static const _emojis = ['😡', '😕', '😐', '🙂', '🤩'];

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
        duplicates = (d['duplicates'] as List<DuplicateReport>? ?? []);
        loading = false;
      });
      // Public authority performance block (same data as the web detail page).
      if (c?.authorityId != null) {
        try {
          final st = await api.authorityAnalytics(c!.authorityId!);
          if (mounted) setState(() => authStats = st);
        } catch (_) {}
      }
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

  // ---- Resolution feedback: confirm / reopen / rate ----
  Future<void> _confirm() async {
    final lang = context.read<Lang>();
    try {
      await api.confirmResolution(c!.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('sat.confirmed')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _dispute() async {
    final lang = context.read<Lang>();
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
        title: Text(lang.t('sat.dispute'), style: TextStyle(color: Theme.of(context).extension<NSScheme>()!.text)),
        content: TextField(
          controller: ctrl,
          maxLines: 3,
          decoration: InputDecoration(hintText: lang.t('sat.disputeHint')),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text(lang.t('sat.disputeBtn'))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await api.disputeResolution(c!.id, ctrl.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('sat.disputed')), backgroundColor: NSColors.amber));
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _submitSatisfaction() async {
    final lang = context.read<Lang>();
    if (_score == null) return;
    setState(() => satBusy = true);
    try {
      await api.satisfaction(c!.id, _score!, comment: _satComment.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('sat.thanks')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    } finally {
      if (mounted) setState(() => satBusy = false);
    }
  }

  Future<void> _workflowAction(String action) async {
    final lang = context.read<Lang>();
    final commentCtrl = TextEditingController();
    final etaCtrl = TextEditingController(text: '48');
    File? resolutionPhoto;
    int? executorId = executors.isNotEmpty ? executors.first['staff_id'] as int : null;
    final needsPhoto = action == 'field_resolve';

    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheet) {
          final s2 = Theme.of(context).extension<NSScheme>()!;
          return Padding(
          padding: EdgeInsets.fromLTRB(22, 22, 22, MediaQuery.of(sheetCtx).viewInsets.bottom + 22),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lang.t('act.$action'), style: whiteTitle(context, size: 17)),
            const SizedBox(height: 6),
            Text('#${c!.id} · ${c!.title}', maxLines: 1, overflow: TextOverflow.ellipsis,
                style: TextStyle(color: s2.sub, fontSize: 12)),
            const SizedBox(height: 16),
            if (action == 'wit_assign' && executors.isNotEmpty) ...[
              DropdownButtonFormField<int>(
                value: executorId,
                decoration: InputDecoration(hintText: lang.t('act.executor')),
                items: executors.map((e) => DropdownMenuItem(
                    value: e['staff_id'] as int, child: Text(e['full_name'], style: TextStyle(color: s2.sub)))).toList(),
                onChanged: (v) => setSheet(() => executorId = v),
              ),
              const SizedBox(height: 12),
              TextField(controller: etaCtrl, keyboardType: TextInputType.number,
                  decoration: InputDecoration(hintText: lang.t('act.eta'))),
              const SizedBox(height: 12),
            ],
            if (needsPhoto) ...[
              GestureDetector(
                onTap: () async {
                  // In-app capture (never leaves the activity) — same
                  // restart-bug fix as the report page and registration.
                  final path = await Navigator.push<String>(
                    sheetCtx,
                    MaterialPageRoute(
                        builder: (_) => CameraCaptureScreen(
                            front: false, title: lang.t('det.resolutionPhoto'))),
                  );
                  if (path != null) setSheet(() => resolutionPhoto = File(path));
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: s2.fill,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: resolutionPhoto != null ? NSColors.mint : s2.line),
                  ),
                  child: Row(children: [
                    Icon(resolutionPhoto != null ? Icons.check_circle_rounded : Icons.add_a_photo_rounded,
                        color: resolutionPhoto != null ? NSColors.mint : s2.sub),
                    const SizedBox(width: 10),
                    Expanded(child: Text(
                      resolutionPhoto != null ? lang.t('det.resolutionPhoto') : lang.t('staff.proofRequired'),
                      style: TextStyle(color: s2.sub, fontSize: 12.5))),
                  ]),
                ),
              ),
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
        );
        },
      ),
    );
    if (ok != true) return;
    if (needsPhoto && resolutionPhoto == null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(lang.t('staff.proofRequired')), backgroundColor: NSColors.amber));
      return;
    }
    try {
      await api.workflowAction(
        c!.id, action,
        comment: commentCtrl.text,
        etaHours: action == 'wit_assign' ? int.tryParse(etaCtrl.text) : null,
        executorStaffId: action == 'wit_assign' ? executorId : null,
        resolutionPhoto: resolutionPhoto,
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
    final s = Theme.of(context).extension<NSScheme>()!;
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
                  color: dim ? s.faint : s.text,
                  fontWeight: FontWeight.w700, fontSize: 13.5)),
          if (date != null)
            Text(date, style: TextStyle(color: s.faint, fontSize: 11)),
          if (comment != null && comment.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(top: 4),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: s.fill,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: s.line),
              ),
              child: Text('“$comment”',
                  style: TextStyle(color: s.sub, fontSize: 11.5)),
            ),
          if (by != null)
            Padding(padding: const EdgeInsets.only(top: 3),
                child: Text(by, style: TextStyle(color: s.faint, fontSize: 10.5))),
        ])),
      ]),
    );
  }

  Widget _slaBadge(BuildContext context, String sla, bool overdue) {
    final lang = context.read<Lang>();
    final label = slaRemainingLabel(sla);
    final isOver = overdue || label.startsWith('Overdue');
    final color = isOver ? NSColors.rose : NSColors.amber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withOpacity(0.4)),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(isOver ? Icons.error_outline_rounded : Icons.schedule_rounded, size: 13, color: color),
        const SizedBox(width: 5),
        Text(isOver ? '${lang.t('det.sla.overdue')} · $label' : '$label ${lang.t('det.sla.left')}',
            style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w800)),
      ]),
    );
  }

  Widget _routePill(BuildContext context, IconData icon, String label, String value) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: s.fill,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: s.line),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: NSColors.accent),
        const SizedBox(width: 6),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(color: s.faint, fontSize: 9.5, fontWeight: FontWeight.w700)),
          Text(value, style: TextStyle(color: s.sub, fontSize: 11.5, fontWeight: FontWeight.w700)),
        ]),
      ]),
    );
  }

  String _authorityTypeLabel(String? type, Lang lang) {
    switch (type) {
      case 'CITY_CORPORATION':
        return lang.t('sub.cityCorp');
      case 'POUROSHOVA':
        return lang.t('sub.pouro');
      case 'UNION_PARISHAD':
        return lang.t('sub.union');
      default:
        return type ?? '—';
    }
  }

  // ---- Public authority performance (mirrors the web AuthorityStats block) ----
  Widget _authorityStats(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final metrics = authStats?['metrics'] as Map<String, dynamic>?;
    final authority = authStats?['authority'] as Map<String, dynamic>?;
    if (metrics == null) return const SizedBox.shrink();
    final total = (metrics['total_complaints'] as num?)?.toInt() ?? 0;
    if (total == 0) return const SizedBox.shrink();

    List<Widget> statRow(String label, String value, Color color) => [
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 19)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: s.sub, fontSize: 10.5, fontWeight: FontWeight.w600)),
        ];

    final byCat = (metrics['volume_by_category'] as List? ?? []).cast<Map<String, dynamic>>();
    final maxN = byCat.fold<int>(1, (m, e) => m > (e['total'] as num? ?? 0).toInt() ? m : (e['total'] as num? ?? 0).toInt());

    return GlassBox(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(lang.t('authstats.title'), style: whiteTitle(context, size: 16)),
        if (authority?['name'] != null) ...[
          const SizedBox(height: 4),
          Text('${authority!['name']} · ${authority['district'] ?? ''}',
              style: TextStyle(color: s.faint, fontSize: 11.5)),
        ],
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: statRow(
              lang.t('authstats.total'), '$total', NSColors.accent))),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: statRow(
              lang.t('authstats.resolved'), '${metrics['resolved'] ?? 0}', NSColors.mint))),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: statRow(
              lang.t('authstats.rejected'), '${metrics['rejected'] ?? 0}', NSColors.rose))),
        ]),
        const SizedBox(height: 12),
        Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: statRow(
              lang.t('authstats.avgDays'),
              metrics['avg_resolution_days'] != null ? '${metrics['avg_resolution_days']}d' : '—',
              NSColors.accent2))),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: statRow(
              lang.t('authstats.satisfaction'),
              metrics['avg_satisfaction'] != null ? '${metrics['avg_satisfaction']}★' : '—',
              NSColors.amber))),
        ]),
        if (byCat.isNotEmpty) ...[
          const SizedBox(height: 14),
          Text(lang.t('authstats.byCategory'),
              style: TextStyle(color: s.faint, fontSize: 11, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          ...byCat.map((e) {
            final n = (e['total'] as num? ?? 0).toDouble();
            final rate = (e['resolution_rate'] as num?)?.toDouble() ?? 0;
            return Padding(
              padding: const EdgeInsets.only(bottom: 7),
              child: Row(children: [
                SizedBox(width: 76, child: Text(lang.t('cat.${e['category'] ?? 'other'}'),
                    style: TextStyle(color: s.sub, fontSize: 11), overflow: TextOverflow.ellipsis)),
                const SizedBox(width: 8),
                Expanded(
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(5),
                    child: LinearProgressIndicator(
                      value: (n / maxN).clamp(0.0, 1.0),
                      minHeight: 8,
                      backgroundColor: s.fill,
                      color: NSColors.accent.withOpacity(0.7),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(width: 52, child: Text('${n.toInt()} · ${rate}%',
                    style: TextStyle(color: s.faint, fontSize: 10), textAlign: TextAlign.right)),
              ]),
            );
          }),
        ],
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
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
                          if (slaRemainingLabel(c!.slaDeadline).isNotEmpty) ...[
                            const SizedBox(height: 10),
                            _slaBadge(context, c!.slaDeadline!, c!.overdue),
                          ],
                          const SizedBox(height: 12),
                          Text(c!.title,
                              style: TextStyle(color: s.text, fontSize: 19, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 6),
                          Text(c!.description,
                              style: TextStyle(color: s.sub, fontSize: 13.5, height: 1.5)),
                          // ---- Evidence + resolution proof photos ----
                          if (c!.imageUrl != null || c!.resolutionImageUrl != null) ...[
                            const SizedBox(height: 14),
                            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              if (c!.imageUrl != null) ...[
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(lang.t('det.evidence'),
                                      style: TextStyle(color: s.faint, fontSize: 11, fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 6),
                                  NetImage(c!.imageUrl, height: 130),
                                ])),
                                if (c!.resolutionImageUrl != null) const SizedBox(width: 10),
                              ],
                              if (c!.resolutionImageUrl != null)
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(lang.t('det.resolutionPhoto'),
                                      style: TextStyle(color: NSColors.mint, fontSize: 11, fontWeight: FontWeight.w700)),
                                  const SizedBox(height: 6),
                                  NetImage(c!.resolutionImageUrl, height: 130),
                                ])),
                            ]),
                          ],
                          if (['assigned', 'in_process'].contains(c!.status)) ...[
                            const SizedBox(height: 12),
                            InfoBanner('${lang.t('det.locked')}'
                                '${c!.etaHours != null ? " · ${lang.t('det.eta')}${c!.etaHours}h" : ""}'),
                          ],
                          if (c!.status == 'resolved') ...[
                            const SizedBox(height: 12),
                            InfoBanner(lang.t('det.resolvedDone'), color: NSColors.mint),
                          ],
                          // ---- Citizen resolution feedback ----
                          if (c!.isMine && c!.status == 'resolved') ...[
                            const SizedBox(height: 14),
                            if (c!.satisfactionScore != null) ...[
                              InfoBanner(
                                  '${lang.t('sat.rated')} ${_emojis[c!.satisfactionScore! - 1]} ${c!.satisfactionScore}★',
                                  color: NSColors.amber),
                              if (c!.satisfactionComment != null &&
                                  c!.satisfactionComment!.isNotEmpty) ...[
                                const SizedBox(height: 8),
                                Text('“${c!.satisfactionComment}”',
                                    style: TextStyle(color: s.sub, fontSize: 12.5, fontStyle: FontStyle.italic)),
                              ],
                            ] else ...[
                              Align(
                                alignment: Alignment.centerLeft,
                                child: Text(lang.t('sat.title'),
                                    style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 14.5)),
                              ),
                              const SizedBox(height: 4),
                              Text(lang.t('sat.sub'), style: TextStyle(color: s.sub, fontSize: 11.5)),
                              const SizedBox(height: 10),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                children: List.generate(5, (i) {
                                  final value = i + 1;
                                  final selected = _score == value;
                                  return GestureDetector(
                                    onTap: () => setState(() => _score = value),
                                    child: AnimatedScale(
                                      scale: selected ? 1.25 : 1.0,
                                      duration: const Duration(milliseconds: 150),
                                      child: Opacity(
                                        opacity: _score == null || selected ? 1 : 0.4,
                                        child: Text(_emojis[i], style: const TextStyle(fontSize: 30)),
                                      ),
                                    ),
                                  );
                                }),
                              ),
                              const SizedBox(height: 10),
                              TextField(
                                controller: _satComment,
                                maxLines: 2,
                                decoration: InputDecoration(hintText: lang.t('sat.comment')),
                              ),
                              const SizedBox(height: 10),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton.icon(
                                  onPressed: (_score == null || satBusy) ? null : _submitSatisfaction,
                                  icon: satBusy
                                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                                      : const Icon(Icons.star_rounded),
                                  label: Text(lang.t('sat.submit')),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Row(children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: _confirm,
                                    icon: const Icon(Icons.check_rounded),
                                    label: Text(lang.t('sat.confirm'), style: const TextStyle(fontSize: 12)),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: _dispute,
                                    style: OutlinedButton.styleFrom(foregroundColor: NSColors.amber),
                                    icon: const Icon(Icons.undo_rounded),
                                    label: Text(lang.t('sat.dispute'), style: const TextStyle(fontSize: 12)),
                                  ),
                                ),
                              ]),
                            ],
                          ],
                          // ---- Public citizen rating (everyone sees it once resolved) ----
                          if (!c!.isMine &&
                              c!.status == 'resolved' &&
                              c!.satisfactionScore != null) ...[
                            const SizedBox(height: 14),
                            InfoBanner(
                                '${lang.t('sat.rated')} ${_emojis[c!.satisfactionScore! - 1]} ${c!.satisfactionScore}★',
                                color: NSColors.amber),
                            if (c!.satisfactionComment != null &&
                                c!.satisfactionComment!.isNotEmpty) ...[
                              const SizedBox(height: 8),
                              Text('“${c!.satisfactionComment}”',
                                  style: TextStyle(color: s.sub, fontSize: 12.5, fontStyle: FontStyle.italic)),
                            ],
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

                    // ---- Location & routing ----
                    GlassBox(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(lang.t('det.location'), style: whiteTitle(context, size: 16)),
                        const SizedBox(height: 10),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(14),
                          child: SizedBox(
                            height: 170,
                            child: NsMap(
                              layer: _layer,
                              initialCenter: LatLng(c!.latitude, c!.longitude),
                              initialZoom: 14,
                              children: [
                                MarkerLayer(markers: [
                                  Marker(point: LatLng(c!.latitude, c!.longitude), width: 40, height: 40,
                                      child: const Text('📍', style: TextStyle(fontSize: 28))),
                                ]),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        if ((c!.fullAddress ?? c!.addressText ?? '').isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text('${lang.t('det.address')}: ${c!.fullAddress ?? c!.addressText}',
                                style: TextStyle(color: s.sub, fontSize: 12, height: 1.5)),
                          ),
                        Text('GPS: ${c!.latitude.toStringAsFixed(5)}, ${c!.longitude.toStringAsFixed(5)}',
                            style: TextStyle(color: s.faint, fontSize: 11)),
                        const SizedBox(height: 12),
                        Text(lang.t('det.routing'), style: whiteTitle(context, size: 14)),
                        const SizedBox(height: 8),
                        Wrap(spacing: 8, runSpacing: 8, children: [
                          _routePill(context, Icons.account_balance_rounded,
                              lang.t('det.authority'), c!.authorityName ?? '—'),
                          _routePill(context, Icons.apartment_rounded,
                              lang.t('det.type'), _authorityTypeLabel(c!.authorityType, lang)),
                          _routePill(context, Icons.engineering_rounded,
                              lang.t('wf.executor'), c!.executorName ?? c!.staffName ?? '—'),
                          _routePill(context, Icons.bolt_rounded,
                              lang.t('det.priority'), 'P${c!.priorityScore.toStringAsFixed(0)}'),
                        ]),
                      ]),
                    ),
                    const SizedBox(height: 16),

                    // ---- Merged duplicate reports ----
                    if (duplicates.isNotEmpty)
                      GlassBox(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${lang.t('det.duplicates')} (${duplicates.length})',
                              style: whiteTitle(context, size: 16)),
                          const SizedBox(height: 4),
                          Text('${duplicates.length} ${duplicates.length == 1 ? lang.t('det.duplicate') : lang.t('det.duplicatesMany')}',
                              style: TextStyle(color: s.faint, fontSize: 11.5)),
                          const SizedBox(height: 10),
                          ...duplicates.map((d) => Padding(
                                padding: const EdgeInsets.only(bottom: 8),
                                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  const Text('🔀', style: TextStyle(fontSize: 14)),
                                  const SizedBox(width: 8),
                                  Expanded(child: Text('#${d.id} · ${d.title}',
                                      maxLines: 2, overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: s.sub, fontSize: 12.5))),
                                  Text(relativeTime(d.createdAt), style: TextStyle(color: s.faint, fontSize: 10.5)),
                                ]),
                              )),
                        ]),
                      ),
                    if (duplicates.isNotEmpty) const SizedBox(height: 16),

                    // ---- Workflow actions (role-aware) ----
                    if (myActions.isNotEmpty) ...[
                      GlassBox(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(lang.t('wf.role.${c!.stageOwnerRole ?? 'field'}'),
                              style: whiteTitle(context, size: 16)),
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
                        Text(lang.t('wf.title'), style: whiteTitle(context, size: 16)),
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
                          _lifecycleStep(icon: '⏳', color: s.faint,
                              title: lang.t('wf.awaiting'), dim: true),
                      ]),
                    ),
                    const SizedBox(height: 16),

                    GlassBox(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(lang.t('det.agents'), style: whiteTitle(context, size: 16)),
                        const SizedBox(height: 4),
                        Text(lang.t('det.agentsSub'),
                            style: TextStyle(color: s.faint, fontSize: 11.5)),
                        const SizedBox(height: 12),
                        ...agents.map((a) => Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                  color: s.fill,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: s.line)),
                              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                const Text('🤖', style: TextStyle(fontSize: 15)),
                                const SizedBox(width: 10),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(AgentLogItem.prettyNames[a.agentName] ?? a.agentName,
                                      style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w700, fontSize: 12.5)),
                                  if (a.output != null)
                                    Padding(padding: const EdgeInsets.only(top: 3),
                                        child: Text(a.output!,
                                            style: TextStyle(color: s.sub, fontSize: 11.5))),
                                ])),
                              ]),
                            )),
                        if (agents.isEmpty)
                          Text(lang.t('det.noAgents'),
                              style: TextStyle(color: s.faint, fontSize: 12.5)),
                      ]),
                    ),
                    const SizedBox(height: 16),

                    if (history.isNotEmpty)
                      GlassBox(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(lang.t('det.timeline'), style: whiteTitle(context, size: 16)),
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
                                    Container(width: 1.5, height: 26, color: s.line),
                                  ]),
                                  const SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text('${h.oldStatus.isEmpty ? "—" : h.oldStatus} → ${h.newStatus.replaceAll("_", " ")}',
                                        style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
                                    if (h.note != null && h.note!.isNotEmpty)
                                      Text(h.note!, style: TextStyle(color: s.sub, fontSize: 12)),
                                    Text(h.changedBy, style: TextStyle(color: s.faint, fontSize: 11)),
                                  ])),
                                ]),
                              )),
                        ]),
                      ),

                    const SizedBox(height: 16),

                    // ---- Public authority performance ----
                    _authorityStats(context),
                  ],
                ),
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
