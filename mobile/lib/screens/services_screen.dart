import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../utils/location.dart';
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
    _load();
  }

  bool _hasPhone(ServiceItem s) => s.phone.trim().isNotEmpty;

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
    return SafeArea(
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 12, 0),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(lang.t('em.title'),
                    style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
                SizedBox(height: 4),
                Text(locationNote, style: TextStyle(color: Colors.white38, fontSize: 12)),
              ]),
            ),
            IconButton(
              onPressed: _useGps,
              style: IconButton.styleFrom(backgroundColor: NSColors.accent.withOpacity(0.15)),
              icon: Icon(Icons.my_location_rounded, color: NSColors.accent),
            ),
          ]),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Row(children: [
            ...types.map((t) => Padding(padding: EdgeInsets.only(right: 8), child: ChoiceChip(
              label: Text(t.$2), selected: type == t.$1,
              onSelected: (_) => setState(() { type = t.$1; _load(); }),
            ))),
          ]),
        ),
        const SizedBox(height: 8),
        Expanded(
          child: loading
              ? Center(child: CircularProgressIndicator(color: NSColors.accent))
              : services.isEmpty
                  ? Center(child: Text(lang.t('em.none'), style: TextStyle(color: Colors.white24)))
                  : ListView.builder(
                      padding: EdgeInsets.fromLTRB(16, 8, 16, 90),
                      itemCount: services.length,
                      itemBuilder: (_, i) {
                        final s = services[i];
                        final dist = s.distanceM >= 1000
                            ? '${(s.distanceM / 1000).toStringAsFixed(1)} km'
                            : '${s.distanceM} m';
                        final hasPhone = _hasPhone(s);
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            child: Row(children: [
                              Text(ServiceItem.typeIcons[s.type] ?? '🏢',
                                  style: TextStyle(fontSize: 26)),
                              SizedBox(width: 12),
                              Expanded(
                                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(s.name,
                                      maxLines: 1, overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                                  Text(s.address ?? '',
                                      maxLines: 1, overflow: TextOverflow.ellipsis,
                                      style: TextStyle(color: Colors.white38, fontSize: 11.5)),
                                  SizedBox(height: 6),
                                  Row(children: [
                                    FilledButton.icon(
                                      onPressed: () => _openDirections(s),
                                      style: FilledButton.styleFrom(
                                        padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        minimumSize: Size(0, 32),
                                        textStyle: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                                      ),
                                      icon: Icon(Icons.directions_rounded, size: 14),
                                      label: Text('Directions'),
                                    ),
                                    if (hasPhone) ...[
                                      SizedBox(width: 8),
                                      OutlinedButton.icon(
                                        onPressed: () => showCallDialog(context, s),
                                        style: OutlinedButton.styleFrom(
                                          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                          minimumSize: Size(0, 32),
                                          side: BorderSide(color: NSColors.mint.withOpacity(0.5)),
                                          foregroundColor: NSColors.mint,
                                          textStyle: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                                        ),
                                        icon: Icon(Icons.call_rounded, size: 14),
                                        label: Text('Call'),
                                      ),
                                    ],
                                  ]),
                                ]),
                              ),
                              SizedBox(width: 8),
                              Text(dist,
                                  style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 12)),
                            ]),
                          ),
                        );
                      },
                    ),
        ),
      ]),
    );
  }

  void showCallDialog(BuildContext context, ServiceItem s) {
    final lang = context.read<Lang>();
    final hasPhone = _hasPhone(s);
    showModalBottomSheet(
      context: context,
      backgroundColor: NSColors.card,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
            children: [
          Row(children: [
            Text(ServiceItem.typeIcons[s.type] ?? '🏢',
                style: TextStyle(fontSize: 30)),
            SizedBox(width: 12),
            Expanded(child: Text(s.name,
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white))),
          ]),
          SizedBox(height: 10),
          Text(s.address ?? '', style: TextStyle(color: Colors.white38, fontSize: 13)),
          SizedBox(height: 14),
          FilledButton.icon(
            onPressed: () => _openDirections(s),
            icon: Icon(Icons.directions_rounded, size: 18),
            label: Text('Get Directions'),
          ),
          if (hasPhone) ...[
            SizedBox(height: 10),
            InfoBanner('${lang.t('em.hotline')}${s.phone}', color: NSColors.mint),
            SizedBox(height: 12),
            FilledButton.icon(
              onPressed: () async {
                final num = s.phone.split('/').first.trim();
                final uri = Uri(scheme: 'tel', path: num);
                try {
                  final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
                  if (!ok && context.mounted) Navigator.pop(context);
                } catch (_) {
                  if (context.mounted) Navigator.pop(context);
                }
              },
              icon: Icon(Icons.call_rounded, size: 18),
              label: Text('${lang.t('em.call')} ${s.phone.split('/').first.trim()}'),
            ),
          ],
        ]),
      ),
    );
  }
}
