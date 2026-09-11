import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../api_service.dart';
import '../auth_provider.dart';
import '../config.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/camera_capture.dart';
import '../widgets/widgets.dart';
import 'home_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> _go() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await context.read<AuthProvider>().login(_email.text.trim(), _password.text);
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (_) => const HomeShell(initialTab: 0)),
      );
    } on ApiException catch (e) {
      setState(() => error = e.message);
    } catch (e) {
      setState(() => error = 'Network error — is the server running? ($kApiBase) ${e.toString().split('\n').first}');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: GlassBox(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(gradient: NSGradient.box, borderRadius: BorderRadius.circular(18)),
                    child: const Icon(Icons.location_city_rounded, color: Colors.white, size: 32),
                  ),
                  const SizedBox(height: 18),
                  Text(lang.t('login.welcome'), style: whiteTitle()),
                  Text(lang.t('login.sub'),
                      style: TextStyle(color: Colors.white38, fontSize: 13.5)),
                  const SizedBox(height: 22),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(hintText: lang.t('login.email')),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    decoration: InputDecoration(hintText: lang.t('login.password')),
                  ),
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    ErrorBanner(error!),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: busy ? null : _go,
                    child: busy
                        ? const SizedBox(height: 22, width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                        : Text(lang.t('login.btn')),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(lang.t('login.new'), style: TextStyle(color: Colors.white38, fontSize: 13)),
                      TextButton(
                        onPressed: () => Navigator.push(context,
                            MaterialPageRoute(builder: (_) => const RegisterScreen())),
                        child: Text(lang.t('login.create'),
                            style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w700)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _picker = ImagePicker();

  int step = 0;
  bool busy = false;
  String? error;
  File? selfie;
  File? idPhoto;

  /// In-app camera capture — never leaves the app, so Android cannot kill
  /// the activity while taking the photo (fixes the restart bug).
  Future<void> _take(bool forId) async {
    final lang = context.read<Lang>();
    try {
      final path = await Navigator.push<String>(
        context,
        MaterialPageRoute(builder: (_) => CameraCaptureScreen(front: !forId)),
      );
      if (path == null) return;
      setState(() {
        if (forId) {
          idPhoto = File(path);
        } else {
          selfie = File(path);
        }
        error = null;
      });
    } catch (_) {
      setState(() => error = lang.t('reg.err.camera'));
    }
  }

  /// Gallery fallback — picking from Photos is also safe from the restart bug.
  Future<void> _pickGallery(bool forId) async {
    try {
      final x = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 65,
        maxWidth: 1280,
      );
      if (x == null) return;
      setState(() {
        if (forId) {
          idPhoto = File(x.path);
        } else {
          selfie = File(x.path);
        }
        error = null;
      });
    } catch (_) {}
  }

  void _next() {
    final lang = context.read<Lang>();
    setState(() => error = null);
    if (step == 0) {
      if (_name.text.trim().isEmpty || _email.text.trim().isEmpty) {
        setState(() => error = lang.t('reg.err.nameEmail'));
        return;
      }
      if (_password.text.length < 6) {
        setState(() => error = lang.t('reg.err.pass'));
        return;
      }
      setState(() => step = 1);
    } else if (step == 1) {
      if (selfie == null) {
        setState(() => error = lang.t('reg.err.selfie'));
        return;
      }
      setState(() => step = 2);
    }
  }

  Future<void> _submit() async {
    final lang = context.read<Lang>();
    if (idPhoto == null) {
      setState(() => error = lang.t('reg.err.id'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await context.read<AuthProvider>().registerWithFace(
            name: _name.text.trim(),
            email: _email.text.trim(),
            phone: _phone.text.trim(),
            password: _password.text,
            selfie: selfie!,
            idPhoto: idPhoto!,
          );
      if (!mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const HomeShell(initialTab: 0)),
        (_) => false,
      );
    } on ApiException catch (e) {
      setState(() {
        busy = false;
        step = 1;
        selfie = null;
        idPhoto = null;
        error = e.message;
      });
    } catch (e) {
      setState(() {
        busy = false;
        error = lang.t('reg.err.network');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Scaffold(
      appBar: AppBar(title: Text(step == 0 ? lang.t('reg.title') : lang.t('reg.step'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: GlassBox(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: List.generate(3, (i) {
                return Expanded(
                  child: Container(
                    height: 4,
                    margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                    decoration: BoxDecoration(
                      gradient: i <= step ? NSGradient.box : null,
                      color: i <= step ? null : Colors.white10,
                      borderRadius: BorderRadius.circular(4),
                    ),
                  ),
                );
              })),
              const SizedBox(height: 16),
              if (step == 0) ...[
                Text(lang.t('reg.title'), style: whiteTitle()),
                Text(lang.t('reg.sub'),
                    style: TextStyle(color: Colors.white38, fontSize: 13)),
                const SizedBox(height: 18),
                TextField(controller: _name, decoration: InputDecoration(hintText: lang.t('reg.name'))),
                const SizedBox(height: 12),
                TextField(controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(hintText: lang.t('reg.email'))),
                const SizedBox(height: 12),
                TextField(controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(hintText: lang.t('reg.phone'))),
                const SizedBox(height: 12),
                TextField(controller: _password, obscureText: true,
                    decoration: InputDecoration(hintText: lang.t('reg.password'))),
              ],
              if (step == 1) ...[
                Text(lang.t('reg.selfieStep'), style: whiteTitle(size: 18)),
                Text(lang.t('reg.selfieHint'),
                    style: TextStyle(color: Colors.white38, fontSize: 12.5)),
                const SizedBox(height: 14),
                Center(
                  child: GestureDetector(
                    onTap: () => _take(false),
                    child: Container(
                      width: 180, height: 180,
                      decoration: glassDecoration(border: NSColors.accent.withOpacity(0.4)),
                      child: selfie != null
                          ? ClipRRect(borderRadius: BorderRadius.circular(18),
                              child: Image.file(selfie!, fit: BoxFit.cover, width: 180, height: 180))
                          : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.photo_camera_front_rounded, size: 44, color: NSColors.accent),
                              SizedBox(height: 8),
                              Text(lang.t('reg.takeSelfie'), style: TextStyle(color: Colors.white60, fontSize: 12.5)),
                            ]),
                    ),
                  ),
                ),
                if (selfie != null)
                  TextButton(onPressed: () => _take(false), child: Text(lang.t('reg.retake'))),
                TextButton(
                  onPressed: () => _pickGallery(false),
                  child: Text(lang.t('reg.uploadInstead'),
                      style: TextStyle(color: Colors.white38, fontSize: 12)),
                ),
              ],
              if (step == 2) ...[
                Text(lang.t('reg.idStep'), style: whiteTitle(size: 18)),
                Text(lang.t('reg.idHint'),
                    style: TextStyle(color: Colors.white38, fontSize: 12.5)),
                const SizedBox(height: 14),
                Center(
                  child: GestureDetector(
                    onTap: () => _take(true),
                    child: Container(
                      width: 240, height: 150,
                      decoration: glassDecoration(border: NSColors.accent2.withOpacity(0.4)),
                      child: idPhoto != null
                          ? ClipRRect(borderRadius: BorderRadius.circular(18),
                              child: Image.file(idPhoto!, fit: BoxFit.cover, width: 240, height: 150))
                          : Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.badge_rounded, size: 44, color: NSColors.accent2),
                              SizedBox(height: 8),
                              Text(lang.t('reg.takeId'), style: TextStyle(color: Colors.white60, fontSize: 12.5)),
                            ]),
                    ),
                  ),
                ),
                if (idPhoto != null)
                  TextButton(onPressed: () => _take(true), child: Text(lang.t('reg.retakeId'))),
                TextButton(
                  onPressed: () => _pickGallery(true),
                  child: Text(lang.t('reg.uploadInstead'),
                      style: TextStyle(color: Colors.white38, fontSize: 12)),
                ),
                const SizedBox(height: 10),
                InfoBanner(lang.t('reg.note'), color: NSColors.amber),
              ],
              if (error != null) ...[
                const SizedBox(height: 14),
                ErrorBanner(error!),
              ],
              const SizedBox(height: 20),
              if (step < 2)
                FilledButton(onPressed: _next, child: Text(step == 0 ? lang.t('reg.continue') : lang.t('reg.next')))
              else
                FilledButton(
                  onPressed: busy ? null : _submit,
                  child: busy
                      ? SizedBox(height: 22, width: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                      : Text(busy ? lang.t('reg.verifying') : lang.t('reg.btn')),
                ),
              if (step > 0 && !busy)
                TextButton(
                  onPressed: () => setState(() { step -= 1; error = null; }),
                  child: Text(lang.t('reg.back'), style: TextStyle(color: Colors.white38)),
                ),
              if (step == 0)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(lang.t('reg.unchanged'),
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white24, fontSize: 11)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
