import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

/// A grid cell for the heat layer: averaged position + normalized weight 0..1.
class HeatCell {
  final double lat;
  final double lng;
  final double weight;
  const HeatCell(this.lat, this.lng, this.weight);
}

/// True smooth heat overlay that mirrors the web app's leaflet.heat layer:
/// every cell is painted as a soft radial-gradient blob weighted by
/// priority intensity, re-projected on every pan/zoom via the map camera.
class HeatmapOverlay extends StatefulWidget {
  final MapController mapController;
  final List<HeatCell> cells;
  const HeatmapOverlay({super.key, required this.mapController, required this.cells});

  @override
  State<HeatmapOverlay> createState() => _HeatmapOverlayState();
}

class _HeatmapOverlayState extends State<HeatmapOverlay> {
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    _sub = widget.mapController.mapEventStream.listen((_) {
      if (mounted) setState(() {});
    });
    // First paint happens before the controller is attached; repaint once
    // the map has laid out so blobs appear immediately with the tiles.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void didUpdateWidget(covariant HeatmapOverlay old) {
    super.didUpdateWidget(old);
    if (old.mapController != widget.mapController) {
      _sub?.cancel();
      _sub = widget.mapController.mapEventStream.listen((_) {
        if (mounted) setState(() {});
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.cells.isEmpty) return const SizedBox.shrink();
    return RepaintBoundary(
      child: LayoutBuilder(
        builder: (_, constraints) => CustomPaint(
          size: Size(constraints.maxWidth, constraints.maxHeight),
          painter: _HeatPainter(
            controller: widget.mapController,
            cells: widget.cells,
          ),
        ),
      ),
    );
  }
}

class _HeatPainter extends CustomPainter {
  final MapController controller;
  final List<HeatCell> cells;
  _HeatPainter({required this.controller, required this.cells});

  /// Same ramp as the web heat layer: mint -> blue -> amber -> red.
  static Color heatColor(double t) {
    const mint = Color(0xFF2DD4BF);
    const blue = Color(0xFF3B82F6);
    const amber = Color(0xFFF59E0B);
    const red = Color(0xFFEF4444);
    if (t < 0.33) return Color.lerp(mint, blue, t / 0.33)!;
    if (t < 0.66) return Color.lerp(blue, amber, (t - 0.33) / 0.33)!;
    return Color.lerp(amber, red, (t - 0.66) / 0.34)!;
  }

  @override
  void paint(Canvas canvas, Size size) {
    MapCamera camera;
    try {
      camera = controller.camera;
    } catch (_) {
      return;
    }
    // Faint cells first so hot spots glow on top.
    final sorted = [...cells]..sort((a, b) => a.weight.compareTo(b.weight));
    for (final c in sorted) {
      final t = c.weight.clamp(0.0, 1.0);
      if (t <= 0.01) continue;
      final pt = camera.latLngToScreenPoint(LatLng(c.lat, c.lng));
      final dx = pt.x.toDouble();
      final dy = pt.y.toDouble();
      final radius = 26 + t * 46;
      if (dx < -radius || dy < -radius || dx > size.width + radius || dy > size.height + radius) {
        continue;
      }
      final color = heatColor(t);
      final center = Offset(dx, dy);
      final paint = Paint()
        ..shader = RadialGradient(
          colors: [
            color.withOpacity(0.50 * t + 0.14),
            color.withOpacity(0.26 * t + 0.07),
            color.withOpacity(0.0),
          ],
          stops: const [0.0, 0.45, 1.0],
        ).createShader(Rect.fromCircle(center: center, radius: radius));
      canvas.drawCircle(center, radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _HeatPainter old) => true;
}
