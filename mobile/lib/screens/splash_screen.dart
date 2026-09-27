import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_provider.dart';
import '../theme.dart';
import 'home_shell.dart';
import 'login_screen.dart';

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
    if (!mounted) return;
    final auth = context.read<AuthProvider>();
    Navigator.pushReplacement(
      context,
      PageRouteBuilder(
        pageBuilder: (_, __, ___) =>
            (auth.ready && auth.user != null) ? const HomeShell(initialTab: 0) : const LoginScreen(),
        transitionsBuilder: (_, a, __, child) =>
            FadeTransition(opacity: CurvedAnimation(parent: a, curve: Curves.easeOut), child: child),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: FadeTransition(
          opacity: CurvedAnimation(parent: _c, curve: Curves.easeIn),
          child: ScaleTransition(
            scale: Tween(begin: 0.7, end: 1.0).animate(CurvedAnimation(parent: _c, curve: Curves.easeOutBack)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(gradient: NSGradient.box, borderRadius: BorderRadius.circular(26)),
                  child: const Icon(Icons.location_city_rounded, size: 48, color: Colors.white),
                ),
                const SizedBox(height: 20),
                RichText(
                  text: TextSpan(
                    style: DefaultTextStyle.of(context).style.copyWith(fontSize: 28, fontWeight: FontWeight.w800),
                    children: [
                      const TextSpan(text: 'Nagorik', style: TextStyle(color: Colors.white)),
                      TextSpan(text: 'Sheba', style: TextStyle(color: NSColors.accent)),
                    ],
                  ),
                ),
                const SizedBox(height: 6),
                Text('Your city, one complaint at a time',
                    style: TextStyle(color: Colors.white38, fontSize: 13)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
