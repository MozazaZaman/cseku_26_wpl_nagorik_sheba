import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';

import '../theme.dart';

/// In-app camera capture. Unlike image_picker's system-camera intent,
/// this never leaves the Flutter activity — so Android cannot kill the
/// app while taking a selfie/ID photo (fixes the "app reopens and
/// photo is lost" bug).
class CameraCaptureScreen extends StatefulWidget {
  final bool front;
  const CameraCaptureScreen({super.key, required this.front});

  @override
  State<CameraCaptureScreen> createState() => _CameraCaptureScreenState();
}

class _CameraCaptureScreenState extends State<CameraCaptureScreen> {
  CameraController? _controller;
  List<CameraDescription> _cameras = [];
  int _index = 0;
  bool _ready = false;
  bool _shooting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final status = await Permission.camera.request();
    if (!status.isGranted) {
      setState(() => _error = 'Camera permission denied. Enable it in Settings → Apps → Nagorik Sheba.');
      return;
    }
    try {
      _cameras = await availableCameras();
      if (_cameras.isEmpty) {
        setState(() => _error = 'No camera found on this device.');
        return;
      }
      final wanted = widget.front ? CameraLensDirection.front : CameraLensDirection.back;
      _index = _cameras.indexWhere((c) => c.lensDirection == wanted);
      if (_index < 0) _index = 0;
      await _start(_cameras[_index]);
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  Future<void> _start(CameraDescription cam) async {
    final previous = _controller;
    final controller = CameraController(cam, ResolutionPreset.medium, enableAudio: false);
    _controller = controller;
    setState(() { _ready = false; _error = null; });
    try {
      await controller.initialize();
      previous?.dispose();
      if (!mounted) return;
      setState(() => _ready = true);
    } catch (e) {
      await controller.dispose();
      if (previous != null && previous.value.isInitialized) {
        _controller = previous;
        setState(() { _ready = true; });
        return;
      }
      if (!mounted) return;
      setState(() => _error = e.toString());
    }
  }

  Future<void> _flip() async {
    if (_cameras.length < 2) return;
    _index = (_index + 1) % _cameras.length;
    await _start(_cameras[_index]);
  }

  Future<void> _shoot() async {
    if (_controller == null || !_ready || _shooting) return;
    setState(() => _shooting = true);
    try {
      final file = await _controller!.takePicture();
      if (!mounted) return;
      Navigator.pop(context, file.path);
    } catch (_) {
      if (mounted) setState(() => _shooting = false);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Column(children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
              ),
              Text(
                widget.front ? 'Selfie' : 'ID Card',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
              ),
              IconButton(
                onPressed: _flip,
                icon: const Icon(Icons.flip_camera_android_rounded, color: Colors.white, size: 26),
              ),
            ]),
          ),
          Expanded(child: _body()),
        ]),
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
            const Icon(Icons.no_photography_rounded, color: NSColors.rose, size: 48),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 13)),
            const SizedBox(height: 18),
            FilledButton(onPressed: _init, child: const Text('Retry')),
          ]),
        ),
      );
    }
    if (!_ready) {
      return const Center(child: CircularProgressIndicator(color: NSColors.accent));
    }
    final preview = CameraPreview(_controller!);
    return Stack(children: [
      Positioned.fill(child: preview),
      Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: const EdgeInsets.only(bottom: 30),
          child: GestureDetector(
            onTap: _shoot,
            child: Container(
              width: 78, height: 78,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 4),
                gradient: NSGradient.box,
              ),
              child: _shooting
                  ? const Padding(padding: EdgeInsets.all(26),
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.camera_alt_rounded, color: Colors.white, size: 32),
            ),
          ),
        ),
      ),
    ]);
  }
}
