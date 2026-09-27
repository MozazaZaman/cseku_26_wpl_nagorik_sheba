import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/heatmap_layer.dart';
import '../widgets/map_layers.dart';
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
  final _heatMapCtl = MapController();
  List<Complaint> items = [];
  List<dynamic> heatPoints = [];
  bool loading = true;
  String cat = 'all';
  String status = 'all';
  String sort = 'newest';
  // Dark base by default, like the web density map; the switcher can change it.
  final _layer = ValueNotifier<String>('dark');
  final _heatVisible = ValueNotifier<bool>(true);
  final cats = ['all', 'road', 'electricity', 'water', 'gas', 'sanitation', 'other'];
  final statuses = ['all', 'submitted', 'review', 'process', 'resolved'];
  final sorts = ['newest', 'priority', 'votes'];

  @override
  void initState() {
    super.initState();
    _load();
    _loadHeat();
    _search.addListener(_load);
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final list = await api.complaints(q: _search.text, category: cat, status: status, sort: sort);
      if (!mounted) return;
      setState(() {
        items = list;
        loading = false;
      });
    } catch (e) {
      setState(() => loading = false);
    }
  }

  /// Nationwide density points, loaded once on open — like the web app,
  /// which renders the heatmap unconditionally above the complaint list.
  Future<void> _loadHeat() async {
    try {
      final pts = await api.heatmapPoints();
      if (!mounted) return;
      setState(() => heatPoints = pts);
    } catch (_) {}
  }

  /// Aggregate raw points into a fine grid of intensity-weighted cells for
  /// the smooth heat overlay. Weight = priority-scaled intensity, exactly
  /// like the web heat layer (intensity = min(1, priority_score / 100)).
  List<HeatCell> _heatCells() {
    // key -> [latSum, lngSum, weightSum, count]
    final grid = <String, List<double>>{};
    for (final p in heatPoints) {
      final lat = (p['latitude'] as num?)?.toDouble() ?? 0;
      final lng = (p['longitude'] as num?)?.toDouble() ?? 0;
      if (lat == 0 && lng == 0) continue;
      final intensity =
          (((p['priority_score'] as num?)?.toDouble() ?? 30) / 100).clamp(0.0, 1.0);
      final key = '${(lat * 25).round()}:${(lng * 25).round()}';
      final cell = grid.putIfAbsent(key, () => [0, 0, 0, 0]);
      cell[0] += lat;
      cell[1] += lng;
      cell[2] += intensity;
      cell[3] += 1;
    }
    double maxW = 0.01;
    for (final c in grid.values) {
      if (c[2] > maxW) maxW = c[2];
    }
    return grid.values.map((c) {
      final n = c[3] < 1 ? 1.0 : c[3];
      return HeatCell(c[0] / n, c[1] / n, (c[2] / maxW).clamp(0.0, 1.0));
    }).toList();
  }

  Future<void> _vote(Complaint c) async {
    final lang = context.read<Lang>();
    if (['assigned', 'in_process'].contains(c.status)) {
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
    final s = Theme.of(context).extension<NSScheme>()!;
    return SafeArea(
      child: CustomScrollView(
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(lang.t('exp.title'),
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: s.text)),
                const SizedBox(height: 4),
                Text(lang.t('exp.sub'), style: TextStyle(color: s.sub, fontSize: 13)),
                const SizedBox(height: 14),
                TextField(
                  controller: _search,
                  decoration: InputDecoration(
                    hintText: lang.t('exp.search'),
                    prefixIcon: const Icon(Icons.search_rounded),
                  ),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    ...cats.map((k) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                      label: Text(k == 'all' ? lang.t('staff.all') : lang.t('cat.$k')),
                      selected: cat == k,
                      onSelected: (_) => setState(() { cat = k; _load(); }),
                    ))),
                  ]),
                ),
                const SizedBox(height: 8),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(children: [
                    ...statuses.map((k) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                      label: Text(lang.t('exp.status.$k')),
                      selected: status == k,
                      onSelected: (_) => setState(() { status = k; _load(); }),
                    ))),
                    const SizedBox(width: 6),
                    ...sorts.map((k) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                      avatar: Icon(k == 'newest'
                          ? Icons.access_time_rounded
                          : k == 'priority'
                              ? Icons.bolt_rounded
                              : Icons.arrow_upward_rounded,
                          size: 15, color: s.sub),
                      label: Text(lang.t('exp.sort.$k')),
                      selected: sort == k,
                      onSelected: (_) => setState(() { sort = k; _load(); }),
                    ))),
                  ]),
                ),
              ]),
            ),
          ),
          // ---- Problem density heatmap (always visible, like the web app) ----
          if (heatPoints.isNotEmpty)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(lang.t('exp.heatTitle').toUpperCase(),
                      style: TextStyle(
                          color: s.faint, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.1)),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(18),
                    child: SizedBox(
                      height: 320,
                      child: NsMap(
                        controller: _heatMapCtl,
                        layer: _layer,
                        heat: _heatVisible,
                        initialCenter: const LatLng(23.6850, 90.3563),
                        initialZoom: 6.5,
                        overlay: ValueListenableBuilder<bool>(
                          valueListenable: _heatVisible,
                          builder: (_, on, __) => on
                              ? HeatmapOverlay(
                                  mapController: _heatMapCtl,
                                  cells: _heatCells(),
                                )
                              : const SizedBox.shrink(),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(lang.t('exp.heatSub'), style: TextStyle(color: s.faint, fontSize: 10.5)),
                ]),
              ),
            ),
          if (loading)
            const SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: CircularProgressIndicator(color: NSColors.accent)))
          else if (items.isEmpty)
            SliverFillRemaining(
                hasScrollBody: false,
                child: Center(child: Text(lang.t('exp.none'), style: TextStyle(color: s.faint))))
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
              sliver: SliverList(
                delegate: SliverChildBuilderDelegate(
                  (context, i) => ComplaintTile(
                    complaint: items[i],
                    voted: items[i].votedByMe,
                    onVote: () => _vote(items[i]),
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
    _heatMapCtl.dispose();
    _layer.dispose();
    _heatVisible.dispose();
    super.dispose();
  }
}
