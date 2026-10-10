import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

/// Analysis Issues — graphical monthly reported-vs-solved per category,
/// cross-category comparison, and the hottest place per category.
/// Citizens default to the whole country; staff default to their own LGI
/// and can switch to overall or a custom division/district.
/// Mirrors the web app's /analysis page.
class AnalysisScreen extends StatefulWidget {
  const AnalysisScreen({super.key});

  @override
  State<AnalysisScreen> createState() => _AnalysisScreenState();
}

class _AnalysisScreenState extends State<AnalysisScreen> {
  final api = ApiService();
  Map<String, dynamic>? data;
  bool loading = true;
  String cat = 'road';
  String scope = 'overall'; // mine | overall | custom
  String? division;
  String? district;
  List<Map<String, dynamic>> divisions = [];

  static const catColors = {
    'road': Color(0xFF5B8CFF),
    'electricity': Color(0xFFFBBF24),
    'water': Color(0xFF38BDF8),
    'gas': Color(0xFFFB7185),
    'sanitation': Color(0xFF2DD4BF),
    'encroachment': Color(0xFFF97316),
    'environment': Color(0xFF4ADE80),
    'public_assets': Color(0xFFA78BFA),
    'animals': Color(0xFFF472B6),
    'markets': Color(0xFFFACC15),
    'drugs': Color(0xFFE879F9),
    'other': Color(0xFF94A3B8),
  };
  static const catIcons = {
    'road': '🛣️', 'electricity': '⚡', 'water': '💧', 'gas': '🔥',
    'sanitation': '🧹', 'encroachment': '🚧', 'environment': '🌿',
    'public_assets': '🏞️', 'animals': '🐕', 'markets': '🏪',
    'drugs': '💊', 'other': '📌',
  };
  static const catKeys = [
    'road', 'electricity', 'water', 'gas', 'sanitation', 'encroachment',
    'environment', 'public_assets', 'animals', 'markets', 'drugs',
  ];

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthProvider>().user;
    if (user?.role == 'staff') scope = 'mine';
    api.divisions().then((d) {
      if (mounted) setState(() => divisions = d);
    }).catchError((_) {});
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final user = context.read<AuthProvider>().user;
      final r = await api.categoryTrends(
        authorityId: scope == 'mine' ? user?.authorityId : null,
        division: scope == 'custom' ? division : null,
        district: scope == 'custom' ? district : null,
      );
      if (!mounted) return;
      setState(() {
        data = r;
        loading = false;
        final cats = (r['categories'] as List? ?? []);
        if (cats.isNotEmpty && !cats.any((c) => (c as Map)['key'] == cat)) {
          cat = (cats.first as Map)['key'];
        }
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  String get _scopeLabel {
    final lang = context.read<Lang>();
    final s = data?['scope'] as Map?;
    if (s == null) return lang.t('ax.scope.overall');
    if (s['overall'] == true) return lang.t('ax.scope.overall');
    if (s['authority_id'] != null) {
      return context.read<AuthProvider>().user?.authorityName ?? lang.t('ax.scope.mine');
    }
    final parts = [s['division'], s['district']].where((x) => x != null && (x as String).isNotEmpty);
    return parts.isEmpty ? lang.t('ax.scope.overall') : parts.join(' · ');
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = context.ns;
    final auth = context.watch<AuthProvider>();
    final isStaff = auth.isStaff;
    final cats = (data?['categories'] as List? ?? []).cast<Map<String, dynamic>>();
    final active = cats.where((c) => c['key'] == cat).isNotEmpty
        ? cats.firstWhere((c) => c['key'] == cat)
        : (cats.isNotEmpty ? cats.first : null);
    final tops = (data?['top_places'] as List? ?? [])
        .cast<Map<String, dynamic>>()
        .where((p) => ((p['count'] as num?) ?? 0) > 0)
        .toList();
    final totalRep = cats.fold<int>(0, (a, c) => a + ((c['total_reported'] as num?)?.toInt() ?? 0));
    final totalSol = cats.fold<int>(0, (a, c) => a + ((c['total_solved'] as num?)?.toInt() ?? 0));
    final overallRate = totalRep > 0 ? (totalSol / totalRep * 1000).round() / 10 : 0;
    final sortedCats = [...cats]
      ..sort((a, b) => (((b['resolution_rate'] as num?) ?? 0)
          .compareTo((a['resolution_rate'] as num?) ?? 0)));

    return Scaffold(
      appBar: AppBar(title: Text(lang.t('ax.title'))),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : data == null
              ? Center(child: Text(lang.t('exp.none'), style: TextStyle(color: s.faint)))
              : RefreshIndicator(
                  color: NSColors.accent,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                    children: [
                      Text(lang.t('ax.sub'), style: TextStyle(color: s.sub, fontSize: 13)),
                      const SizedBox(height: 14),

                      // ---- Scope ----
                      GlassBox(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(children: [
                              if (isStaff)
                                Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: ChoiceChip(
                                    label: Text('🏛️ ${auth.user?.authorityName ?? lang.t('ax.scope.mine')}'),
                                    selected: scope == 'mine',
                                    onSelected: (_) => setState(() { scope = 'mine'; _load(); }),
                                  ),
                                ),
                              Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ChoiceChip(
                                  label: Text('🇧🇩 ${lang.t('ax.scope.overall')}'),
                                  selected: scope == 'overall',
                                  onSelected: (_) => setState(() { scope = 'overall'; _load(); }),
                                ),
                              ),
                              ChoiceChip(
                                label: Text('📍 ${lang.t('ax.scope.custom')}'),
                                selected: scope == 'custom',
                                onSelected: (_) => setState(() { scope = 'custom'; _load(); }),
                              ),
                            ]),
                          ),
                          if (scope == 'custom') ...[
                            const SizedBox(height: 10),
                            DropdownButtonFormField<String>(
                              value: division,
                              decoration: InputDecoration(hintText: lang.t('ax.allDivisions')),
                              items: [
                                DropdownMenuItem(value: null, child: Text(lang.t('ax.allDivisions'))),
                                ...divisions.map((d) => DropdownMenuItem(
                                    value: d['name'] as String, child: Text(d['name'] as String))),
                              ],
                              onChanged: (v) => setState(() { division = v; district = null; _load(); }),
                            ),
                            const SizedBox(height: 10),
                            DropdownButtonFormField<String>(
                              value: district,
                              decoration: InputDecoration(hintText: lang.t('ax.allDistricts')),
                              items: [
                                DropdownMenuItem(value: null, child: Text(lang.t('ax.allDistricts'))),
                                ...(() {
                                  final match = divisions.where((d) => d['name'] == division);
                                  if (match.isEmpty) return <DropdownMenuItem<String>>[];
                                  return (match.first['districts'] as List)
                                      .cast<String>()
                                      .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                                      .toList();
                                })(),
                              ],
                              onChanged: division == null
                                  ? null
                                  : (v) => setState(() { district = v; _load(); }),
                            ),
                          ],
                        ]),
                      ),
                      const SizedBox(height: 16),

                      // ---- Headline counters ----
                      Row(children: [
                        _headStat(context, lang.t('ax.totalReported'), '$totalRep', NSColors.accent),
                        _headStat(context, lang.t('ax.totalSolved'), '$totalSol', NSColors.mint),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        _headStat(context, lang.t('ax.overallRate'), '$overallRate%', NSColors.amber),
                        _headStat(context, _scopeLabel, '', NSColors.accent2, small: true),
                      ]),
                      const SizedBox(height: 20),

                      // ---- Category picker ----
                      Text(lang.t('ax.pickCategory'),
                          style: TextStyle(color: NSColors.accent, fontSize: 11, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8, runSpacing: 8,
                        children: catKeys.map((k) {
                          final inData = cats.any((c) => c['key'] == k);
                          if (!inData) return const SizedBox.shrink();
                          return ChoiceChip(
                            avatar: Text(catIcons[k] ?? '📌', style: const TextStyle(fontSize: 14)),
                            label: Text(lang.t('cat.$k')),
                            selected: cat == k,
                            onSelected: (_) => setState(() => cat = k),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),

                      // ---- Monthly trend ----
                      if (active != null)
                        GlassBox(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(children: [
                              Text(catIcons[active['key']] ?? '📌', style: const TextStyle(fontSize: 22)),
                              const SizedBox(width: 10),
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('${lang.t('cat.${active['key']}')} · ${lang.t('ax.monthly')}',
                                    style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 15)),
                                Text(_scopeLabel, style: TextStyle(color: s.faint, fontSize: 11)),
                              ])),
                            ]),
                            const SizedBox(height: 6),
                            Row(children: [
                              _legendDot(NSColors.accent, lang.t('ax.reported')),
                              const SizedBox(width: 14),
                              _legendDot(NSColors.mint, lang.t('ax.solved')),
                            ]),
                            const SizedBox(height: 12),
                            _monthBars(context, active),
                            const SizedBox(height: 14),
                            Row(children: [
                              _miniStat(context, lang.t('ax.reported'), '${active['total_reported'] ?? 0}',
                                  catColors[active['key']] ?? NSColors.accent),
                              _miniStat(context, lang.t('ax.solved'), '${active['total_solved'] ?? 0}', NSColors.mint),
                              _miniStat(context, lang.t('ax.rate'), '${active['resolution_rate'] ?? 0}%',
                                  NSColors.amber),
                            ]),
                          ]),
                        ),
                      const SizedBox(height: 20),

                      // ---- Comparison ----
                      Text(lang.t('ax.compare'), style: whiteTitle(context, size: 17)),
                      const SizedBox(height: 4),
                      Text(lang.t('ax.compareSub'), style: TextStyle(color: s.faint, fontSize: 11.5)),
                      const SizedBox(height: 12),
                      GlassBox(
                        padding: const EdgeInsets.all(16),
                        child: Column(children: [
                          ...sortedCats.map((c) {
                            final rate = ((c['resolution_rate'] as num?) ?? 0).toDouble();
                            final color = catColors[c['key']] ?? NSColors.accent;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(child: Text('${catIcons[c['key']] ?? '📌'} ${lang.t('cat.${c['key']}')}',
                                      style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13))),
                                  Text('$rate%',
                                      style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 14)),
                                ]),
                                const SizedBox(height: 5),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(5),
                                  child: TweenAnimationBuilder<double>(
                                    tween: Tween(begin: 0, end: (rate / 100).clamp(0.0, 1.0)),
                                    duration: const Duration(milliseconds: 800),
                                    curve: Curves.easeOutCubic,
                                    builder: (_, v, __) => LinearProgressIndicator(
                                      value: v,
                                      minHeight: 9,
                                      backgroundColor: s.fill,
                                      color: color,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 3),
                                Text('${c['total_reported'] ?? 0} ${lang.t('ax.reported')} · ${c['total_solved'] ?? 0} ${lang.t('ax.solved')}',
                                    style: TextStyle(color: s.faint, fontSize: 10.5)),
                              ]),
                            );
                          }),
                        ]),
                      ),
                      const SizedBox(height: 20),

                      // ---- Hottest places ----
                      Text(lang.t('ax.top'), style: whiteTitle(context, size: 17)),
                      const SizedBox(height: 4),
                      Text(lang.t('ax.topSub'), style: TextStyle(color: s.faint, fontSize: 11.5)),
                      const SizedBox(height: 12),
                      if (tops.isEmpty)
                        GlassBox(child: Center(child: Text(lang.t('ax.topNone'), style: TextStyle(color: s.faint)))),
                      ...tops.map((p) {
                        final color = catColors[p['category']] ?? NSColors.accent;
                        return GlassBox(
                          padding: const EdgeInsets.all(14),
                          child: Row(children: [
                            Container(
                              width: 44, height: 44,
                              decoration: BoxDecoration(
                                  color: color.withOpacity(0.13), borderRadius: BorderRadius.circular(12)),
                              child: Center(child: Text(catIcons[p['category']] ?? '📌',
                                  style: const TextStyle(fontSize: 20))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(lang.t('cat.${p['category']}'),
                                  style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 14)),
                              const SizedBox(height: 2),
                              Text('${p['district'] ?? ''}${p['division'] != null ? ' · ${p['division']}' : ''}',
                                  maxLines: 1, overflow: TextOverflow.ellipsis,
                                  style: TextStyle(color: s.faint, fontSize: 11.5)),
                              Text(lang.t('ax.topReports'),
                                  style: TextStyle(color: s.faint, fontSize: 10)),
                            ])),
                            Text('${p['count'] ?? 0}',
                                style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 22)),
                          ]),
                        );
                      }),
                    ],
                  ),
                ),
    );
  }

  Widget _headStat(BuildContext context, String label, String value, Color color, {bool small = false}) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
          color: s.fill, borderRadius: BorderRadius.circular(14), border: Border.all(color: s.line),
          boxShadow: [BoxShadow(color: color.withOpacity(0.12), blurRadius: 18, offset: const Offset(0, 4))],
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w900, fontSize: small ? 13 : 22)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: s.sub, fontSize: 10.5, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  Widget _miniStat(BuildContext context, String label, String value, Color color) {
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
        decoration: BoxDecoration(
          color: context.ns.fill,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: context.ns.line),
        ),
        child: Column(children: [
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 17)),
          const SizedBox(height: 2),
          Text(label,
              textAlign: TextAlign.center,
              style: TextStyle(color: context.ns.sub, fontSize: 9.5)),
        ]),
      ),
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
      const SizedBox(width: 5),
      Text(label,
          style: TextStyle(color: context.ns.sub, fontSize: 11)),
    ]);
  }

  /// Grouped monthly bars (reported vs solved) with animated growth.
  Widget _monthBars(BuildContext context, Map<String, dynamic> c) {
    final months = (data?['months'] as List? ?? []).cast<Map<String, dynamic>>();
    final rep = (c['reported'] as List? ?? []).map((e) => (e as num).toDouble()).toList();
    final sol = (c['solved'] as List? ?? []).map((e) => (e as num).toDouble()).toList();
    double maxV = 1;
    for (final v in [...rep, ...sol]) {
      if (v > maxV) maxV = v;
    }
    final color = catColors[c['key']] ?? NSColors.accent;
    return SizedBox(
      height: 190,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: List.generate(months.length, (i) {
          final r = i < rep.length ? rep[i] : 0.0;
          final q = i < sol.length ? sol[i] : 0.0;
          return Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2),
              child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _bar(r / maxV, color),
                    const SizedBox(width: 2),
                    _bar(q / maxV, NSColors.mint),
                  ],
                ),
                const SizedBox(height: 5),
                Text((months[i]['label'] ?? '').toString().split(' ').first,
                    style: TextStyle(color: context.ns.faint, fontSize: 8)),
              ]),
            ),
          );
        }),
      ),
    );
  }

  Widget _bar(double frac, Color color) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: frac.clamp(0.0, 1.0)),
      duration: const Duration(milliseconds: 700),
      curve: Curves.easeOutCubic,
      builder: (_, v, __) => Container(
        width: 7,
        height: (150 * v).clamp(3.0, 150.0),
        decoration: BoxDecoration(
          gradient: LinearGradient(
              colors: [color, color.withOpacity(0.35)],
              begin: Alignment.topCenter, end: Alignment.bottomCenter),
          borderRadius: BorderRadius.circular(4),
          boxShadow: [BoxShadow(color: color.withOpacity(0.35), blurRadius: 6)],
        ),
      ),
    );
  }
}
