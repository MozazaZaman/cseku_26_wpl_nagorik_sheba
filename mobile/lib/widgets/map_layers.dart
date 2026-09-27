import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../theme.dart';

/// Base-layer switcher (Map / Satellite / Dark [+ optional 🔥 heat toggle]) —
/// mirrors the web app's MapPanel layer control so every map in the app
/// looks and behaves the same.
class MapLayerButton extends StatelessWidget {
  final ValueNotifier<String> layer;
  final ValueNotifier<bool>? heat;
  const MapLayerButton({super.key, required this.layer, this.heat});

  static const _options = [
    ('map', '🗺️'),
    ('satellite', '🛰️'),
    ('dark', '🌙'),
  ];

  static String urlFor(String layer) {
    switch (layer) {
      case 'satellite':
        return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      case 'dark':
        return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
      default:
        return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Container(
      decoration: BoxDecoration(
        color: s.card.withOpacity(0.92),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: s.line),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2))],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 3),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        for (final o in _options) ...[
          if (o != _options.first)
            Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: Text('·', style: TextStyle(color: s.faint, fontSize: 12))),
          ValueListenableBuilder<String>(
            valueListenable: layer,
            builder: (_, v, __) {
              final selected = v == o.$1;
              return GestureDetector(
                onTap: () => layer.value = o.$1,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                  decoration: BoxDecoration(
                    color: selected ? NSColors.accent.withOpacity(0.22) : Colors.transparent,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(o.$2,
                      style: TextStyle(fontSize: 14, decoration: selected ? TextDecoration.underline : TextDecoration.none)),
                ),
              );
            },
          ),
        ],
        if (heat != null) ...[
          Padding(padding: const EdgeInsets.symmetric(horizontal: 2), child: Text('·', style: TextStyle(color: s.faint, fontSize: 12))),
          ValueListenableBuilder<bool>(
            valueListenable: heat!,
            builder: (_, on, __) => GestureDetector(
              onTap: () => heat!.value = !on,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
                decoration: BoxDecoration(
                  color: on ? NSColors.rose.withOpacity(0.22) : Colors.transparent,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text('🔥',
                    style: TextStyle(
                        fontSize: 14,
                        decoration: on ? TextDecoration.underline : TextDecoration.none,
                        color: on ? null : Colors.grey)),
              ),
            ),
          ),
        ],
      ]),
    );
  }
}

/// Standard map used across the app: tile layer follows the selected base,
/// with a small floating layer switcher in the top-right corner.
/// [overlay] is painted above the tiles/markers (but below the switcher) —
/// used for the smooth heat layer. It must not intercept gestures.
class NsMap extends StatelessWidget {
  final MapController? controller;
  final LatLng initialCenter;
  final double initialZoom;
  final ValueNotifier<String> layer;
  final ValueNotifier<bool>? heat;
  final Widget? overlay;
  final List<Widget> children;
  final void Function(TapPosition, LatLng)? onTap;

  const NsMap({
    super.key,
    this.controller,
    required this.initialCenter,
    required this.layer,
    this.heat,
    this.overlay,
    this.initialZoom = 14,
    this.children = const [],
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(children: [
      ValueListenableBuilder<String>(
        valueListenable: layer,
        builder: (_, v, __) => FlutterMap(
          mapController: controller,
          options: MapOptions(
            initialCenter: initialCenter,
            initialZoom: initialZoom,
            onTap: onTap,
          ),
          children: [
            TileLayer(
              urlTemplate: MapLayerButton.urlFor(v),
              subdomains: const ['a', 'b', 'c', 'd'],
              userAgentPackageName: 'bd.nagorik.sheba',
            ),
            ...children,
          ],
        ),
      ),
      if (overlay != null) Positioned.fill(child: IgnorePointer(child: overlay!)),
      Positioned(top: 8, right: 8, child: MapLayerButton(layer: layer, heat: heat)),
    ]);
  }
}

