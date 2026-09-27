import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'home_shell.dart';
import 'landing_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1200))..forward();

  @override
  void initState() {
    super.initState();
    _route();
  }

  Future<void> _route() async {
    await Future.delayed(const Duration(milliseconds: 1500));
    final auth = context.read<AuthProvider>();
    // Wait (briefly) for the saved session to be re-validated before deciding
    // the first screen, so a slow network never sends a logged-in user to login.
    for (int i = 0; i < 30 && !auth.ready; i++) {
      await Future.delayed(const Duration(milliseconds: 100));
    }
    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        // Web-like flow: logged-in users land in the app, guests land on the
        // landing page (which holds login / register / browse actions).
        pageBuilder: (_, __, ___) =>
            (auth.ready && auth.user != null) ? const HomeShell(initialTab: 0) : const LandingScreen(),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut), child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Scaffold(
      body: Center(
        child: FadeTransition(
          opacity: CurvedAnimation(parent: _c, curve: Curves.easeIn),
          child: ScaleTransition(
            scale: Tween(begin: 0.7, end: 1.0).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutBack)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const AppLogo(size: 96, radius: 26),
                const SizedBox(height: 20),
                RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: s.text),
                    children: [
                      const TextSpan(text: 'Nagorik'),
                      TextSpan(text: 'Sheba', style: const TextStyle(color: NSColors.accent)),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text(context.read<Lang>().t('land.tagline'),
                    style: TextStyle(color: s.faint, fontSize: 13)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
