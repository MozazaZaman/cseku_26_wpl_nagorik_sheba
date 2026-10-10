import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'complaint_detail_screen.dart';

class StaffScreen extends StatefulWidget {
  const StaffScreen({super.key});

  @override
  State<StaffScreen> createState() => _StaffScreenState();
}

class _StaffScreenState extends State<StaffScreen> {
  final api = ApiService();
  List<Complaint> queue = [];
  bool loading = true;
  String cat = 'all', status = 'all';
  String view = 'mine';
  String? banner;

  static const cats = ['all', 'road', 'electricity', 'water', 'gas', 'sanitation', 'encroachment', 'environment', 'public_assets', 'animals', 'markets', 'drugs', 'other'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _staffRole => context.read<AuthProvider>().user?.staffRole ?? 'junior';
  bool get _canOversight => _staffRole == 'senior' || _staffRole == 'mayor';

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final q = await api.staffQueue(category: cat, status: status, view: view);
      if (!mounted) return;
      setState(() {
        queue = q;
        loading = false;
      });
    } catch (_) {
      setState(() => loading = false);
    }
  }

  int _count(bool Function(Complaint) test) => queue.where(test).length;

  Widget _counter(String label, int value, Color color) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 10),
        decoration: BoxDecoration(
          color: s.fill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: s.line),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('$value', style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 19)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: s.sub, fontSize: 10.5, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final staffRole = _staffRole;

    final statusOptions = <(String, String)>[
      ('all', lang.t('staff.all')),
      if (staffRole == 'junior') ('verified', lang.t('st.verified')),
      if (staffRole == 'senior') ...[
        ('senior_review', lang.t('st.senior_review')),
        ('approved', lang.t('st.approved')),
      ],
      if (staffRole == 'mayor') ('mayor_review', lang.t('st.mayor_review')),
      if (staffRole == 'wit') ('wit_review', lang.t('st.wit_review')),
      if (staffRole == 'field') ...[
        ('assigned', lang.t('st.assigned')),
        ('in_process', lang.t('staff.inProcess')),
      ],
      ('rejected', lang.t('st.rejected')),
    ];

    return SafeArea(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Text(lang.t('staff.title'),
                  style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: s.text)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  gradient: NSGradient.box,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(lang.t('wf.role.$staffRole'),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)),
              ),
            ]),
            const SizedBox(height: 4),
            Text(
              staffRole == 'mayor'
                  ? lang.t('st.mayor_review')
                  : staffRole == 'senior'
                      ? lang.t('st.senior_review')
                      : staffRole == 'wit'
                          ? lang.t('st.wit_review')
                          : staffRole == 'field'
                              ? lang.t('st.assigned')
                              : lang.t('st.junior_review'),
              style: const TextStyle(color: NSColors.mint, fontSize: 12.5, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 12),
            // ---- Queue summary counters ----
            if (!loading)
              Row(children: [
                _counter(lang.t('staff.myQueue'), queue.length, NSColors.accent),
                _counter(
                    lang.t('staff.awaiting'),
                    _count((c) => ['verified', 'junior_review', 'senior_review', 'mayor_review', 'wit_review', 'approved']
                        .contains(c.status)),
                    NSColors.accent2),
                _counter(lang.t('staff.wip'), _count((c) => ['assigned', 'in_process'].contains(c.status)), NSColors.amber),
                _counter(lang.t('staff.overdue'), _count((c) => c.overdue), NSColors.rose),
              ]),
            if (_canOversight) ...[
              const SizedBox(height: 10),
              Row(children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() { view = 'mine'; _load(); }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: view == 'mine' ? NSColors.accent.withOpacity(0.25) : s.fill,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: view == 'mine' ? NSColors.accent : s.line),
                      ),
                      child: Center(child: Text(lang.t('staff.myQueue'),
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() { view = 'oversight'; _load(); }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 9),
                      decoration: BoxDecoration(
                        color: view == 'oversight' ? NSColors.accent2.withOpacity(0.25) : s.fill,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: view == 'oversight' ? NSColors.accent2 : s.line),
                      ),
                      child: Center(child: Text(lang.t('staff.oversight'),
                          style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
              ]),
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Text(lang.t('staff.oversightHint'), style: TextStyle(color: s.faint, fontSize: 10.5)),
              ),
            ],
          ]),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ...cats.map((k) => Padding(padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(k == 'all' ? lang.t('staff.all') : lang.t('cat.$k')),
                    selected: cat == k,
                    onSelected: (_) => setState(() { cat = k; _load(); })))),
          ]),
        ),
        const SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ...statusOptions.map((s) => Padding(padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(s.$2),
                    selected: status == s.$1,
                    onSelected: (_) => setState(() { status = s.$1; _load(); })))),
          ]),
        ),
        Expanded(
          child: loading
              ? Center(child: CircularProgressIndicator(color: NSColors.accent))
              : queue.isEmpty
                  ? Center(child: Text(lang.t('staff.clear'), style: TextStyle(color: s.faint)))
                  : RefreshIndicator(
                      color: NSColors.accent,
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: const EdgeInsets.fromLTRB(16, 10, 16, 90),
                        itemCount: queue.length,
                        itemBuilder: (_, i) {
                          final c = queue[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      gradient: NSGradient.box,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text('P${i + 1}',
                                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)),
                                  ),
                                  const SizedBox(width: 8),
                                  StatusChip(c.status),
                                  if (c.overdue) ...[
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: NSColors.rose.withOpacity(0.16),
                                        borderRadius: BorderRadius.circular(999),
                                        border: Border.all(color: NSColors.rose.withOpacity(0.45)),
                                      ),
                                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                                        const Icon(Icons.error_outline_rounded, size: 11, color: NSColors.rose),
                                        const SizedBox(width: 3),
                                        Text(lang.t('staff.overdue'),
                                            style: const TextStyle(color: NSColors.rose, fontSize: 10, fontWeight: FontWeight.w800)),
                                      ]),
                                    ),
                                  ],
                                  const Spacer(),
                                  Text('P${c.priorityScore}',
                                      style: TextStyle(color: NSColors.amber, fontWeight: FontWeight.w800, fontSize: 12)),
                                ]),
                                const SizedBox(height: 10),
                                GestureDetector(
                                  onTap: () => Navigator.push(context, MaterialPageRoute(
                                      builder: (_) => ComplaintDetailScreen(id: c.id))).then((_) => _load()),
                                  child: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 15)),
                                ),
                                const SizedBox(height: 4),
                                Text(c.description, maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: s.sub, fontSize: 12)),
                                const SizedBox(height: 6),
                                Text(
                                  '${c.addressText ?? ""} · ▲${c.voteCount} ${lang.t('exp.votes')} · ${lang.t('exp.by')} ${c.submitterName ?? "?"}'
                                  '${c.executorName != null ? " · ${lang.t('wf.executor')}: ${c.executorName}" : ""}',
                                  style: TextStyle(color: s.faint, fontSize: 11)),
                                const SizedBox(height: 10),
                                // Role-aware action buttons — the heavy actions
                                // (comment, executor pick, ETA) live in the detail sheet.
                                Row(children: [
                                  Expanded(
                                    child: FilledButton.icon(
                                      onPressed: () => Navigator.push(context, MaterialPageRoute(
                                          builder: (_) => ComplaintDetailScreen(id: c.id))).then((_) => _load()),
                                      icon: const Icon(Icons.rate_review_rounded, size: 17),
                                      label: Text(lang.t('det.review'), style: const TextStyle(fontSize: 12.5)),
                                    ),
                                  ),
                                ]),
                              ]),
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ]),
    );
  }
}
