import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../utils/location.dart';
import '../widgets/map_layers.dart';
import '../widgets/widgets.dart';

class ServicesScreen extends StatefulWidget {
  const ServicesScreen({super.key});

  @override
  State<ServicesScreen> createState() => _ServicesScreenState();
}

class _ServicesScreenState extends State<ServicesScreen> {
  final api = ApiService();
  List<ServiceItem> services = [];
  bool loading = true;
  String type = 'all';
  double lat = 23.7385, lng = 90.3965;
  String locationNote = 'Dhaka center (default)';
  String? placeName;
  final _layer = ValueNotifier<String>('map');

  static const types = [
    ('all', '🏙️ All'),
    ('fire_service', '🚒 Fire'),
    ('police_station', '🚓 Police'),
    ('wasa', '🚰 WASA'),
    ('lged', '🏗️ LGED'),
    ('desa', '💡 DESA'),
    ('titas_gas', '🔥 Titas'),
    ('public_toilet', '🚻 Toilet'),
  ];

  @override
  void initState() {
    super.initState();
    _locate();
  }

  bool _hasPhone(ServiceItem s) => s.phone.trim().isNotEmpty;

  /// Silent auto-locate on first open (mirrors the web app's Emergency page).
  Future<void> _locate() async {
    try {
      final pos = await getCurrentPosition();
      if (!mounted) return;
      setState(() {
        lat = pos.latitude;
        lng = pos.longitude;
        locationNote = 'GPS: ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
      });
      _resolvePlace();
    } catch (_) {}
    _load();
  }

  /// Turn the raw GPS fix into a readable address via server reverse geocoding.
  Future<void> _resolvePlace() async {
    final name = await api.reverseGeocode(lat, lng);
    if (!mounted) return;
    setState(() => placeName = name);
  }

  Future<void> _openDirections(ServiceItem s) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&origin=$lat,$lng&destination=${s.lat},${s.lng}',
    );
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {}
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final list = await api.nearbyServices(lat, lng, type: type);
      if (!mounted) return;
      setState(() {
        services = list;
        loading = false;
      });
    } catch (_) {
      setState(() => loading = false);
    }
  }

  Future<void> _useGps() async {
    final lang = context.read<Lang>();
    ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(lang.t('em.gpsGetting')), duration: const Duration(seconds: 1)));
    try {
      final pos = await getCurrentPosition();
      if (!mounted) return;
      setState(() {
        lat = pos.latitude;
        lng = pos.longitude;
        locationNote = '${lang.t('em.gps')}${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}';
      });
      _load();
    } catch (_) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(lang.t('em.gpsFail')),
          backgroundColor: NSColors.amber));
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
              padding: const EdgeInsets.fromLTRB(20, 12, 12, 0),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(lang.t('em.title'),
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: s.text)),
                    const SizedBox(height: 4),
                    Text(placeName ?? locationNote,
                        maxLines: 2, overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: s.sub, fontSize: 12)),
                  ]),
                ),
                IconButton(
                  onPressed: _useGps,
                  style: IconButton.styleFrom(backgroundColor: NSColors.accent.withOpacity(0.15)),
                  icon: Icon(Icons.my_location_rounded, color: NSColors.accent),
                ),
              ]),
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.only(top: 12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Row(children: [
                  ...types.map((t) => Padding(padding: const EdgeInsets.only(right: 8), child: ChoiceChip(
                    label: Text(t.$2), selected: type == t.$1,
                    onSelected: (_) => setState(() { type = t.$1; _load(); }),
                  ))),
                ]),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 10)),

          // ---- Map preview (scrolls with the page now) ----
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(18),
                child: SizedBox(
                  height: 220,
                  child: loading
                      ? Container(color: s.fill, child: Center(child: CircularProgressIndicator(color: NSColors.accent)))
                      : NsMap(
                          layer: _layer,
                          initialCenter: LatLng(lat, lng),
                          initialZoom: services.isEmpty ? 12 : 13,
                          children: [
                            CircleLayer(circles: [
                              CircleMarker(
                                point: LatLng(lat, lng),
                                radius: 14,
                                color: NSColors.accent.withOpacity(0.18),
                                borderColor: NSColors.accent,
                                borderStrokeWidth: 1.5,
                              ),
                            ]),
                            MarkerLayer(markers: [
                              Marker(
                                point: LatLng(lat, lng),
                                width: 40, height: 40,
                                child: const Text('🧍', style: TextStyle(fontSize: 24)),
                              ),
                              ...services.map((sv) => Marker(
                                    point: LatLng(sv.lat, sv.lng),
                                    width: 38, height: 38,
                                    child: Text(ServiceItem.typeIcons[sv.type] ?? '🏢',
                                        style: const TextStyle(fontSize: 22)),
                                  )),
                            ]),
                          ],
                        ),
                ),
              ),
            ),
          ),
          const SliverToBoxAdapter(child: SizedBox(height: 10)),

          if (loading)
            const SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: CircularProgressIndicator(color: NSColors.accent)),
            )
          else if (services.isEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(child: Text(lang.t('em.none'), style: TextStyle(color: s.faint))),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 120),
              sliver: SliverList.builder(
                itemCount: services.length,
                itemBuilder: (_, i) {
                  final sv = services[i];
                  final dist = sv.distanceM >= 1000
                      ? '${(sv.distanceM / 1000).toStringAsFixed(1)} km'
                      : '${sv.distanceM} m';
                  final hasPhone = _hasPhone(sv);
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      child: Row(children: [
                        Text(ServiceItem.typeIcons[sv.type] ?? '🏢',
                            style: const TextStyle(fontSize: 26)),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(sv.name,
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontWeight: FontWeight.w700, color: s.text)),
                            Text(sv.address ?? '',
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: s.sub, fontSize: 11.5)),
                            const SizedBox(height: 6),
                            Row(children: [
                              FilledButton.icon(
                                onPressed: () => _openDirections(sv),
                                style: FilledButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  minimumSize: const Size(0, 32),
                                  textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                                ),
                                icon: const Icon(Icons.directions_rounded, size: 14),
                                label: Text(lang.t('em.directions')),
                              ),
                              if (hasPhone) ...[
                                const SizedBox(width: 8),
                                OutlinedButton.icon(
                                  onPressed: () => showCallDialog(context, sv),
                                  style: OutlinedButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                    minimumSize: const Size(0, 32),
                                    side: BorderSide(color: NSColors.mint.withOpacity(0.5)),
                                    foregroundColor: NSColors.mint,
                                    textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                                  ),
                                  icon: const Icon(Icons.call_rounded, size: 14),
                                  label: Text(lang.t('em.call')),
                                ),
                              ],
                            ]),
                          ]),
                        ),
                        const SizedBox(width: 8),
                        Text(dist,
                            style: const TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 12)),
                      ]),
                    ),
                  );
                },
              ),
            ),
        ],
      ),
    );
  }

  void showCallDialog(BuildContext context, ServiceItem sv) {
    final lang = context.read<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final hasPhone = _hasPhone(sv);
    showModalBottomSheet(
      context: context,
      backgroundColor: s.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
            children: [
          Row(children: [
            Text(ServiceItem.typeIcons[sv.type] ?? '🏢',
                style: const TextStyle(fontSize: 30)),
            const SizedBox(width: 12),
            Expanded(child: Text(sv.name,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: s.text))),
          ]),
          const SizedBox(height: 10),
          Text(sv.address ?? '', style: TextStyle(color: s.sub, fontSize: 13)),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () => _openDirections(sv),
            icon: const Icon(Icons.directions_rounded, size: 18),
            label: Text(lang.t('em.getDirections')),
          ),
          if (hasPhone) ...[
            const SizedBox(height: 10),
            InfoBanner('${lang.t('em.hotline')}${sv.phone}', color: NSColors.mint),
            const SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () async {
                final num = sv.phone.split('/').first.trim();
                final uri = Uri(scheme: 'tel', path: num);
                try {
                  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
                  if (!ok && context.mounted) Navigator.pop(context);
                } catch (_) {
                  if (context.mounted) Navigator.pop(context);
                }
              },
              icon: const Icon(Icons.call_rounded, size: 18),
              label: Text('${lang.t('em.call')} ${sv.phone.split('/').first.trim()}'),
            ),
          ],
        ]),
      ),
    );
  }
}
