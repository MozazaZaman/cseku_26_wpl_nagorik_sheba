import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../data/faq_data.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class FaqScreen extends StatefulWidget {
  const FaqScreen({super.key});

  @override
  State<FaqScreen> createState() => _FaqScreenState();
}

class _FaqScreenState extends State<FaqScreen> {
  final _search = TextEditingController();
  String query = '';

  @override
  void initState() {
    super.initState();
    _search.addListener(() => setState(() => query = _search.text.trim().toLowerCase()));
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final all = lang.isBn ? FaqData.bn : FaqData.en;
    final filtered = all.where((f) {
      if (query.isEmpty) return true;
      return f.question.toLowerCase().contains(query) || f.answer.toLowerCase().contains(query);
    }).toList();
    final categories = <String>[];
    for (final f in filtered) {
      if (!categories.contains(f.category)) categories.add(f.category);
    }

    return Scaffold(
      appBar: AppBar(title: Text(lang.t('faq.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
        children: [
          TextField(
            controller: _search,
            decoration: InputDecoration(
              hintText: lang.t('faq.search'),
              prefixIcon: const Icon(Icons.search_rounded),
            ),
          ),
          const SizedBox(height: 16),
          if (filtered.isEmpty)
            Center(child: Padding(padding: const EdgeInsets.only(top: 40), child: Text(lang.t('faq.empty'), style: TextStyle(color: s.faint))))
          else
            ...categories.map((cat) {
              final items = filtered.where((f) => f.category == cat).toList();
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Padding(
                  padding: const EdgeInsets.only(bottom: 10, top: 6),
                  child: Text(cat,
                      style: TextStyle(color: NSColors.accent, fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: .4)),
                ),
                ...items.map((f) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _FaqTile(item: f),
                    )),
              ]);
            }),
        ],
      ),
    );
  }
}

class _FaqTile extends StatefulWidget {
  final FaqItem item;
  const _FaqTile({required this.item});

  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> with SingleTickerProviderStateMixin {
  bool open = false;

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return GlassBox(
      padding: EdgeInsets.zero,
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 14),
          title: Text(widget.item.question,
              style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 14)),
          onExpansionChanged: (v) => setState(() => open = v),
          trailing: AnimatedRotation(
            turns: open ? 0.5 : 0,
            duration: const Duration(milliseconds: 200),
            child: const Icon(Icons.keyboard_arrow_down_rounded, color: NSColors.accent),
          ),
          children: [
            Text(widget.item.answer, style: TextStyle(color: s.sub, fontSize: 13, height: 1.55)),
          ],
        ),
      ),
    );
  }
}
