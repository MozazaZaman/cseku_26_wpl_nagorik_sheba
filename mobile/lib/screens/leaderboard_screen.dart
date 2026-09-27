import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class LeaderboardScreen extends StatefulWidget {
  const LeaderboardScreen({super.key});

  @override
  State<LeaderboardScreen> createState() => _LeaderboardScreenState();
}

class _LeaderboardScreenState extends State<LeaderboardScreen> {
  final api = ApiService();
  List<LeaderboardEntry> ranked = [];
  List<LeaderboardEntry> insufficient = [];
  List<String> divisions = [];
  String? division;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final r = await api.leaderboard(division: division);
      if (!mounted) return;
      setState(() {
        ranked = (r['ranked'] as List? ?? []).map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>)).toList();
        insufficient =
            (r['insufficient'] as List? ?? []).map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>)).toList();
        divisions = (r['divisions'] as List? ?? []).map((e) => e.toString()).toList();
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  static const medals = ['🥇', '🥈', '🥉'];

  Widget _entryCard(int index, LeaderboardEntry e, bool rankedList) {
    final s = Theme.of(context).extension<NSScheme>()!;
    final typeLabel = e.type == 'CITY_CORPORATION'
        ? 'City Corporation'
        : e.type == 'POUROSHOVA'
            ? 'Pouroshova'
            : 'Union Parishad';
    return GlassBox(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(
          width: 34,
          child: rankedList && index < 3
              ? Text(medals[index], style: const TextStyle(fontSize: 22))
              : Text('${rankedList ? index + 1 : '•'}',
                  style: TextStyle(color: s.faint, fontWeight: FontWeight.w800, fontSize: 15)),
        ),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(e.name, style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: 2),
          Text('$typeLabel · ${e.district ?? ''}${e.division != null ? ", ${e.division}" : ""}',
              style: TextStyle(color: s.faint, fontSize: 11.5)),
          const SizedBox(height: 8),
          Wrap(spacing: 10, runSpacing: 4, children: [
            _pill(langLabel('lb.rate'), '${e.resolutionRate.toStringAsFixed(0)}%', NSColors.mint),
            _pill(langLabel('lb.avgDays'), e.avgDays != null ? '${e.avgDays}' : '—', NSColors.accent),
            _pill(langLabel('lb.sat'), e.avgSatisfaction != null ? '${e.avgSatisfaction}★' : '—', NSColors.amber),
            _pill(langLabel('lb.score'), e.score != null ? '${e.score}' : '—', NSColors.accent2),
          ]),
        ])),
      ]),
    );
  }

  String langLabel(String k) => context.read<Lang>().t(k);

  Widget _pill(String label, String value, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text('$label: $value', style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w700)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    return Scaffold(
      appBar: AppBar(title: Text(lang.t('lb.title'))),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : RefreshIndicator(
              color: NSColors.accent,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                children: [
                  Text(lang.t('lb.sub'), style: TextStyle(color: s.sub, fontSize: 13)),
                  const SizedBox(height: 14),
                  if (divisions.isNotEmpty)
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(children: [
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(lang.t('lb.allDivisions')),
                            selected: division == null,
                            onSelected: (_) => setState(() { division = null; _load(); }),
                          ),
                        ),
                        ...divisions.map((d) => Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(d),
                                selected: division == d,
                                onSelected: (_) => setState(() { division = d; _load(); }),
                              ),
                            )),
                      ]),
                    ),
                  const SizedBox(height: 16),
                  if (ranked.isEmpty && insufficient.isEmpty)
                    Center(child: Padding(padding: const EdgeInsets.only(top: 40), child: Text(lang.t('lb.empty'), style: TextStyle(color: s.faint))))
                  else ...[
                    ...ranked.asMap().entries.map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _entryCard(e.key, e.value, true),
                        )),
                    if (insufficient.isNotEmpty) ...[
                      const SizedBox(height: 14),
                      Text(lang.t('lb.insufficient'),
                          style: TextStyle(color: s.faint, fontSize: 13, fontWeight: FontWeight.w700)),
                      const SizedBox(height: 10),
                      ...insufficient.map((e) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: _entryCard(0, e, false),
                          )),
                    ],
                  ],
                ],
              ),
            ),
    );
  }
}
