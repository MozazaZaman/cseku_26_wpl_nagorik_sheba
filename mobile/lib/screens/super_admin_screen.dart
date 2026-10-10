import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

/// Platform Super Admin console (mobile subset).
/// Review-oriented actions work here: onboarding verification, manual
/// payment review, transaction lookup, analytics and audit.
/// Sensitive operations (plan editing, refunds, staff removal, LGI creation)
/// are intentionally web-only — noted inline where relevant.
class SuperAdminScreen extends StatefulWidget {
  const SuperAdminScreen({super.key});

  @override
  State<SuperAdminScreen> createState() => _SuperAdminScreenState();
}

class _SuperAdminScreenState extends State<SuperAdminScreen> with SingleTickerProviderStateMixin {
  final api = ApiService();
  late TabController _tabs;
  List<dynamic> orgs = [];
  List<dynamic> queue = [];
  Map<String, dynamic>? analytics;
  List<dynamic> audit = [];
  bool loading = true;
  String orgFilter = 'SUBMITTED';

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 4, vsync: this);
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final o = await api.rawGet('/billing/organizations?status=$orgFilter');
      final a = await api.billingAnalytics();
      final q = await api.rawGet('/billing/manual-queue');
      final au = await api.rawGet('/billing/audit?limit=50');
      if (!mounted) return;
      setState(() {
        orgs = (o['organizations'] as List? ?? []);
        analytics = a;
        queue = (q['queue'] as List? ?? []).where((m) => (m as Map)['status'] == 'UNDER_REVIEW').toList();
        audit = (au['audit'] as List? ?? []);
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<bool> _confirm(String message) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: context.ns.card,
        title: Text(message, style: TextStyle(color: context.ns.text, fontSize: 15)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('No')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Yes')),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _orgAction(int id, String status) async {
    final lang = context.read<Lang>();
    if (!await _confirm(lang.t('bill.confirmDefault'))) return;
    try {
      await api.rawPost('/billing/organizations/$id/status', {'status': status});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.done')), backgroundColor: NSColors.mint));
      _load();
    } catch (_) {}
  }

  Future<void> _manualAction(int id, bool verify) async {
    final lang = context.read<Lang>();
    if (!await _confirm(lang.t('bill.confirmDefault'))) return;
    try {
      await api.rawPost('/billing/manual/$id/${verify ? 'verify' : 'reject'}', {});
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.done')), backgroundColor: NSColors.mint));
      _load();
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = context.ns;
    if (context.watch<AuthProvider>().user?.role != 'super_admin') {
      return Scaffold(
          appBar: AppBar(title: Text(lang.t('bill.superTitle'))),
          body: Center(child: Text(lang.t('bill.superOnly'), style: TextStyle(color: s.sub))));
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(lang.t('bill.superTitle')),
        bottom: TabBar(controller: _tabs, isScrollable: true, tabs: [
          Tab(text: lang.t('bill.tab.orgs')),
          Tab(text: lang.t('bill.tab.finance')),
          Tab(text: lang.t('bill.tab.analytics')),
          Tab(text: lang.t('bill.tab.audit')),
        ]),
      ),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : TabBarView(controller: _tabs, children: [
              // ---- Organizations ----
              RefreshIndicator(
                color: NSColors.accent,
                onRefresh: _load,
                child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                  Wrap(
                    spacing: 8, runSpacing: 0,
                    children: ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ACTIVE', 'all'].map((st) => ChoiceChip(
                          label: Text(st, style: const TextStyle(fontSize: 12)),
                          selected: orgFilter == st,
                          onSelected: (_) => setState(() { orgFilter = st; _load(); }),
                        )).toList(),
                  ),
                  const SizedBox(height: 10),
                  const SizedBox(height: 6),
                  if (orgs.isEmpty) InfoBanner(lang.t('bill.empty'), color: NSColors.accent),
                  ...orgs.map((o) {
                    final m = (o as Map).cast<String, dynamic>();
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${m['name']}', style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 14)),
                          Text('${m['type']} · ${m['status']} · ${m['requested_seats']} seats',
                              style: TextStyle(color: s.faint, fontSize: 11.5)),
                          const SizedBox(height: 8),
                          Wrap(spacing: 8, runSpacing: 8, children: [
                            if (['SUBMITTED', 'NEEDS_INFORMATION'].contains(m['status']))
                              OutlinedButton(onPressed: () => _orgAction(m['org_id'] as int, 'UNDER_REVIEW'),
                                  child: Text(lang.t('bill.review'), style: const TextStyle(fontSize: 11.5))),
                            if (m['status'] == 'UNDER_REVIEW')
                              FilledButton(onPressed: () => _orgAction(m['org_id'] as int, 'VERIFIED'),
                                  style: FilledButton.styleFrom(minimumSize: const Size(0, 36)),
                                  child: Text(lang.t('bill.verify'), style: const TextStyle(fontSize: 11.5))),
                            if (!['REJECTED', 'ACTIVE', 'SUSPENDED', 'PENDING_PAYMENT'].contains(m['status']))
                              TextButton(onPressed: () => _orgAction(m['org_id'] as int, 'REJECTED'),
                                  child: Text(lang.t('bill.reject'),
                                      style: const TextStyle(fontSize: 11.5, color: NSColors.rose))),
                          ]),
                        ]),
                      ),
                    );
                  }),
                  const SizedBox(height: 8),
                  InfoBanner(lang.t('bill.mobileWebOnly'), color: NSColors.amber),
                ]),
              ),
              // ---- Finance ----
              RefreshIndicator(
                color: NSColors.accent,
                onRefresh: _load,
                child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                  Text(lang.t('bill.manualQueue'), style: whiteTitle(context, size: 16)),
                  const SizedBox(height: 10),
                  if (queue.isEmpty) InfoBanner(lang.t('bill.empty'), color: NSColors.accent),
                  ...queue.map((m) {
                    final q = (m as Map).cast<String, dynamic>();
                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${q['authority_name']} · ${q['invoice_no']}',
                              style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
                          Text('${q['reference']} · ${q['method'] ?? 'bank'}',
                              style: TextStyle(color: s.faint, fontSize: 11.5)),
                          const SizedBox(height: 8),
                          Row(children: [
                            Expanded(
                              child: FilledButton(onPressed: () => _manualAction(q['id'] as int, true),
                                  style: FilledButton.styleFrom(minimumSize: const Size(0, 36)),
                                  child: Text(lang.t('bill.verify'), style: const TextStyle(fontSize: 11.5))),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton(onPressed: () => _manualAction(q['id'] as int, false),
                                  style: OutlinedButton.styleFrom(
                                      minimumSize: const Size(0, 36),
                                      foregroundColor: NSColors.rose,
                                      side: BorderSide(color: NSColors.rose.withOpacity(0.4))),
                                  child: Text(lang.t('bill.reject'), style: const TextStyle(fontSize: 11.5))),
                            ),
                          ]),
                        ]),
                      ),
                    );
                  }),
                ]),
              ),
              // ---- Analytics ----
              RefreshIndicator(
                color: NSColors.accent,
                onRefresh: _load,
                child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                  if (analytics == null)
                    InfoBanner(lang.t('bill.empty'), color: NSColors.accent)
                  else ...[
                    _bigStat(context, lang.t('bill.orgs'),
                        '${(analytics!['subscriptions'] as Map?)?['active'] ?? 0}', NSColors.accent),
                    _bigStat(context, lang.t('bill.collected'),
                        _money(((analytics!['money'] as Map?)?['gross_collected'] as num?) ?? 0), NSColors.mint),
                    _bigStat(context, lang.t('bill.outstanding'),
                        _money(((analytics!['money'] as Map?)?['outstanding_invoices'] as num?) ?? 0), NSColors.amber),
                  ],
                ]),
              ),
              // ---- Audit ----
              RefreshIndicator(
                color: NSColors.accent,
                onRefresh: _load,
                child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                  if (audit.isEmpty) InfoBanner(lang.t('bill.empty'), color: NSColors.accent),
                  ...audit.map((a) {
                    final m = (a as Map).cast<String, dynamic>();
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: Text('${m['action']} · ${m['actor_type']}#${m['actor_id']} · ${m['created_at']}',
                          style: TextStyle(color: s.sub, fontSize: 11.5)),
                    );
                  }),
                ]),
              ),
            ]),
    );
  }

  String _money(num minor) => 'BDT ${(minor / 100).toStringAsFixed(2)}';

  Widget _bigStat(BuildContext context, String label, String value, Color color) {
    final s = context.ns;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
          color: s.fill, borderRadius: BorderRadius.circular(14), border: Border.all(color: s.line)),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 22)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: s.sub, fontSize: 11)),
      ]),
    );
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }
}
