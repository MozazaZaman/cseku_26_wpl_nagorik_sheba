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
    // geolocator is used here to fetch live position
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
              label: Text(t.$2), selected: type == t.key,
              onSelected: (_) => setState(() { type = t.key; _load(); }),
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
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: ListTile(
                            contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            leading: Text(ServiceItem.typeIcons[s.type] ?? '🏢',
                                style: TextStyle(fontSize: 26)),
                            title: Text(s.name,
                                maxLines: 1, overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white)),
                            subtitle: Text('${s.phone} · $dist${lang.t('em.away')}',
                                style: TextStyle(color: Colors.white38, fontSize: 12.5)),
                            trailing: Container(
                              padding: EdgeInsets.all(9),
                              decoration: BoxDecoration(
                                gradient: NSGradient.box,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(Icons.call_rounded, size: 18, color: Colors.white),
                            ),
                            onTap: () => showCallDialog(context, s),
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
          InfoBanner('${lang.t('em.hotline')}${s.phone}', color: NSColors.mint),
          SizedBox(height: 16),
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
        ]),
      ),
    );
  }
}
