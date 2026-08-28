import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
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
  String? banner;

  static const cats = ['all', 'road', 'electricity', 'water', 'gas', 'sanitation', 'other'];
  static const statuses = [('all', 'All'), ('verified', 'New'), ('in_process', 'In Process'), ('resolved', 'Done')];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final q = await api.staffQueue(category: cat, status: status);
      if (!mounted) return;
      setState(() {
        queue = q;
        loading = false;
      });
    } catch (_) {
      setState(() => loading = false);
    }
  }

  Future<void> _startProcess(Complaint c) async {
    final lang = context.read<Lang>();
    final etaCtrl = TextEditingController(text: '48');
    final noteCtrl = TextEditingController();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      backgroundColor: NSColors.card,
      isScrollControlled: true,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetCtx) => Padding(
        padding: EdgeInsets.fromLTRB(22, 22, 22, MediaQuery.of(sheetCtx).viewInsets.bottom + 22),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${lang.t('staff.modalTitle')}${c.id}', style: whiteTitle(size: 18)),
          SizedBox(height: 6),
          Text(lang.t('staff.modalSub'), style: TextStyle(color: Colors.white38, fontSize: 12.5)),
          SizedBox(height: 16),
          TextField(controller: etaCtrl, keyboardType: TextInputType.number,
              decoration: InputDecoration(hintText: lang.t('staff.eta'))),
          SizedBox(height: 12),
          TextField(controller: noteCtrl,
              decoration: InputDecoration(hintText: lang.t('staff.note'))),
          SizedBox(height: 18),
          FilledButton(
            onPressed: () => Navigator.pop(sheetCtx, true),
            child: Text(lang.t('staff.confirm')),
          ),
        ]),
      ),
    );
    if (ok != true) return;
    try {
      await api.updateStatus(c.id, 'in_process',
          etaHours: int.tryParse(etaCtrl.text) ?? 48, note: noteCtrl.text);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('#${c.id}${lang.t('staff.doneMsg')}'),
          backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _setStatus(Complaint c, String s) async {
    final lang = context.read<Lang>();
    try {
      await api.updateStatus(c.id, s);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('#${c.id}${lang.t('staff.statusMsg')}${lang.t('st.$s')}'),
          backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return SafeArea(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(lang.t('staff.title'),
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
            SizedBox(height: 4),
            InfoBanner(lang.t('staff.ranked'), color: NSColors.mint),
          ]),
        ),
        SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ...cats.map((k) => Padding(padding: EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(k == 'all' ? lang.t('staff.all') : lang.t('cat.$k')),
                    selected: cat == k,
                    onSelected: (_) => setState(() { cat = k; _load(); })))),
          ]),
        ),
        SizedBox(height: 8),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ...statuses.map((s) => Padding(padding: EdgeInsets.only(right: 8),
                child: ChoiceChip(label: Text(lang.t('staff.${s.$1 == "all" ? "all" : s.$1}')),
                    selected: status == s.$1,
                    onSelected: (_) => setState(() { status = s.$1; _load(); })))),
          ]),
        ),
        Expanded(
          child: loading
              ? Center(child: CircularProgressIndicator(color: NSColors.accent))
              : queue.isEmpty
                  ? Center(child: Text(lang.t('staff.clear'), style: TextStyle(color: Colors.white24)))
                  : RefreshIndicator(
                      color: NSColors.accent,
                      onRefresh: _load,
                      child: ListView.builder(
                        padding: EdgeInsets.fromLTRB(16, 10, 16, 90),
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
                                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      gradient: NSGradient.box,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text('P${i + 1}',
                                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 11)),
                                  ),
                                  SizedBox(width: 8),
                                  StatusChip(c.status),
                                  Spacer(),
                                  Text('P${c.priorityScore}',
                                      style: TextStyle(color: NSColors.amber, fontWeight: FontWeight.w800, fontSize: 12)),
                                ]),
                                SizedBox(height: 10),
                                GestureDetector(
                                  onTap: () => Navigator.push(context, MaterialPageRoute(
                                      builder: (_) => ComplaintDetailScreen(id: c.id))).then((_) => _load()),
                                  child: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
                                ),
                                SizedBox(height: 4),
                                Text(c.description, maxLines: 1, overflow: TextOverflow.ellipsis,
                                    style: TextStyle(color: Colors.white38, fontSize: 12)),
                                SizedBox(height: 6),
                                Text('${c.addressText ?? ""} · ▲${c.voteCount} ${lang.t('exp.votes')} · ${lang.t('exp.by')} ${c.submitterName ?? "?"}',
                                    style: TextStyle(color: Colors.white24, fontSize: 11)),
                                SizedBox(height: 12),
                                Row(children: [
                                  if (c.status == 'verified')
                                    Expanded(child: FilledButton.icon(
                                      onPressed: () => _startProcess(c),
                                      icon: Icon(Icons.play_arrow_rounded, size: 18),
                                      label: Text(lang.t('staff.start')),
                                    )),
                                  if (['verified', 'in_process'].contains(c.status)) ...[
                                    if (c.status == 'verified') SizedBox(width: 8),
                                    Expanded(child: OutlinedButton.icon(
                                      onPressed: () => _setStatus(c, 'resolved'),
                                      icon: Icon(Icons.check_rounded, size: 18),
                                      label: Text(lang.t('staff.done')),
                                      style: OutlinedButton.styleFrom(foregroundColor: NSColors.mint),
                                    )),
                                    SizedBox(width: 8),
                                    Expanded(child: OutlinedButton.icon(
                                      onPressed: () => _setStatus(c, 'rejected'),
                                      icon: Icon(Icons.close_rounded, size: 18),
                                      label: Text(lang.t('staff.reject')),
                                      style: OutlinedButton.styleFrom(foregroundColor: NSColors.rose),
                                    )),
                                  ],
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
