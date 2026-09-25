import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'complaint_detail_screen.dart';

class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final api = ApiService();
  final _search = TextEditingController();
  List<Complaint> items = [];
  bool loading = true;
  String cat = 'all';
  final cats = ['all', 'road', 'electricity', 'water', 'gas', 'sanitation', 'other'];
  String? banner;

  @override
  void initState() {
    super.initState();
    _load();
    _search.addListener(_load);
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final list = await api.complaints(q: _search.text, category: cat);
      if (!mounted) return;
      setState(() {
        items = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
    }
  }

  Future<void> _vote(Complaint c) async {
    final lang = context.read<Lang>();
    if (c.status == 'in_process') {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(lang.t('exp.voted.locked')),
        backgroundColor: NSColors.amber,
      ));
      return;
    }
    try {
      await api.vote(c.id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text('${lang.t('exp.voted.ok')} #${c.id}'),
        backgroundColor: NSColors.mint,
      ));
      _load();
    } on ApiException catch (e) {
      if (e.body['redirect_complaint_id'] != null) {
        Navigator.push(context, MaterialPageRoute(
            builder: (_) => ComplaintDetailScreen(id: e.body['redirect_complaint_id'])));
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 20, 20, 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(lang.t('exp.title'),
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
                SizedBox(height: 4),
                Text(lang.t('exp.sub'),
                    style: TextStyle(color: Colors.white38, fontSize: 13)),
                SizedBox(height: 14),
                TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: lang.t('exp.search'),
                    prefixIcon: Icon(Icons.search, color: Colors.white38),
                  ),
                ),
                SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    ...cats.map((k) => Padding(padding: EdgeInsets.only(right: 8), child: ChoiceChip(
                      label: Text(k == 'all' ? lang.t('staff.all') : lang.t('cat.$k')),
                      selected: cat == k,
                      onSelected: (_) => setState(() => cat = k),
                    ))),
                  ]),
                ),
              ]),
            ),
          ),
          if (loading)
            SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator(color: NSColors.accent)))
          else if (items.isEmpty)
            SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: Text(lang.t('exp.none'), style: TextStyle(color: Colors.white24))))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => ComplaintTile(
                    complaint: items[i],
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: items[i].id))),
                  ),
                  childCount: items.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }
}
