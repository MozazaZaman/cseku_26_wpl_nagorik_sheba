import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import '../widgets/app_drawer.dart';
import '../widgets/assistant_widget.dart';
import '../widgets/notification_bell.dart';
import 'services_screen.dart';
import 'explore_screen.dart';
import 'home_shell.dart';
import 'login_screen.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  final api = ApiService();
  Map<String, dynamic>? stats;
  bool loadingStats = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final s = await api.stats();
      if (mounted) setState(() { stats = s; loadingStats = false; });
    } catch (_) {
      if (mounted) setState(() => loadingStats = false);
    }
  }

  /// Explore and Emergency are tab pages (no AppBar of their own), so when
  /// opened standalone from the landing page they get a proper Scaffold
  /// with a back button — otherwise guests land on a page they cannot leave.
  void _openExplore(BuildContext context) {
    final lang = context.read<Lang>();
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(title: Text(lang.t('exp.title'))),
        body: const ExploreScreen(),
      ),
    ));
  }

  void _openEmergency(BuildContext context) {
    final lang = context.read<Lang>();
    Navigator.push(context, MaterialPageRoute(
      builder: (_) => Scaffold(
        appBar: AppBar(title: Text(lang.t('em.title'))),
        body: const ServicesScreen(),
      ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final auth = context.watch<AuthProvider>();

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        leading: Builder(builder: (ctx) => IconButton(
          icon: const Icon(Icons.menu_rounded),
          onPressed: () => Scaffold.of(ctx).openDrawer(),
        )),
        actions: const [NotificationBell()],
      ),
      // Nagorik assistant floats here too (citizens only), like the web landing.
      floatingActionButton: const AssistantWidget(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(22, 8, 22, 40),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          // ---- Hero ----
          Center(child: Column(children: [
            const AppLogo(size: 104, radius: 26),
            const SizedBox(height: 18),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
              decoration: BoxDecoration(
                color: NSColors.accent.withOpacity(0.14),
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: NSColors.accent.withOpacity(0.4)),
              ),
              child: Text(lang.t('land.badge'),
                  style: const TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 13)),
            ),
            const SizedBox(height: 14),
            RichText(
              text: TextSpan(
                style: TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: s.text, height: 1.1),
                children: [
                  const TextSpan(text: 'Nagorik'),
                  TextSpan(text: 'Sheba', style: TextStyle(color: NSColors.accent)),
                ],
              ),
            ),
            const SizedBox(height: 8),
            Text(lang.t('land.tagline'),
                style: TextStyle(color: NSColors.accent2, fontWeight: FontWeight.w700, fontSize: 15)),
            const SizedBox(height: 12),
            Text(lang.t('land.sub'),
                textAlign: TextAlign.center,
                style: TextStyle(color: s.sub, fontSize: 13.5, height: 1.55)),
          ])),
          const SizedBox(height: 22),

          // ---- CTAs ----
          // Logged-in users get a direct way back into the app console.
          if (auth.user != null) ...[
            FilledButton.icon(
              onPressed: () => Navigator.pushAndRemoveUntil(
                context,
                MaterialPageRoute(builder: (_) => const HomeShell(initialTab: 0)),
                (_) => false,
              ),
              icon: Icon(auth.isStaff ? Icons.engineering_rounded : Icons.dashboard_rounded),
              label: Text(lang.t('land.goApp')),
            ),
            const SizedBox(height: 6),
            Center(child: Text(lang.t('land.goAppSub'),
                style: TextStyle(color: s.faint, fontSize: 11.5))),
            const SizedBox(height: 10),
          ] else ...[
            FilledButton.icon(
              onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen())),
              icon: const Icon(Icons.login_rounded),
              label: Text(lang.t('land.login')),
            ),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const RegisterScreen())),
                  icon: const Icon(Icons.person_add_rounded),
                  label: Text(lang.t('land.register')),
                ),
              ),
            ]),
            const SizedBox(height: 10),
          ],
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _openExplore(context),
                icon: const Icon(Icons.explore_rounded),
                label: Text(lang.t('land.browse')),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _openEmergency(context),
                icon: const Icon(Icons.emergency_rounded),
                label: Text(lang.t('land.emergency')),
              ),
            ),
          ]),
          const SizedBox(height: 26),

          // ---- Live stats ----
          if (!loadingStats && stats != null)
            Row(children: [
              _stat(context, lang.t('land.stat.complaints'), '${stats!['total'] ?? 0}'),
              _stat(context, lang.t('land.stat.resolved'), '${stats!['resolved'] ?? 0}'),
            ]),
          if (!loadingStats && stats != null) const SizedBox(height: 10),
          if (!loadingStats && stats != null)
            Row(children: [
              _stat(context, lang.t('land.stat.authorities'), '${stats!['authorities'] ?? 0}'),
              _stat(context, lang.t('land.stat.citizens'), '${stats!['citizens'] ?? 0}'),
            ]),
          const SizedBox(height: 26),

          // ---- Agent pipeline ----
          Text(lang.t('land.agents.title'), style: whiteTitle(context, size: 19)),
          const SizedBox(height: 4),
          Text(lang.t('land.agents.sub'), style: TextStyle(color: s.faint, fontSize: 12)),
          const SizedBox(height: 14),
          ...[
            ('🛡️', lang.t('land.agent1'), NSColors.accent),
            ('🏷️', lang.t('land.agent2'), NSColors.accent2),
            ('🔀', lang.t('land.agent3'), NSColors.accent3),
            ('📊', lang.t('land.agent4'), NSColors.mint),
            ('🎯', lang.t('land.agent5'), NSColors.amber),
          ].map((a) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassBox(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
              child: Row(children: [
                Text(a.$1, style: const TextStyle(fontSize: 22)),
                const SizedBox(width: 12),
                Expanded(child: Text(a.$2,
                    style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 14))),
                Icon(Icons.arrow_forward_rounded, color: a.$3, size: 18),
              ]),
            ),
          )),
          const SizedBox(height: 26),

          // ---- Features ----
          ...[
            (Icons.face_retouching_natural_rounded, lang.t('land.feat1t'), lang.t('land.feat1s'), NSColors.accent),
            (Icons.merge_rounded, lang.t('land.feat2t'), lang.t('land.feat2s'), NSColors.accent2),
            (Icons.public_rounded, lang.t('land.feat3t'), lang.t('land.feat3s'), NSColors.mint),
            (Icons.timer_outlined, lang.t('land.feat4t'), lang.t('land.feat4s'), NSColors.amber),
          ].map((f) => Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: GlassBox(
              padding: const EdgeInsets.all(16),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Container(
                  width: 40, height: 40,
                  decoration: BoxDecoration(color: f.$4.withOpacity(0.15), borderRadius: BorderRadius.circular(12)),
                  child: Icon(f.$1, color: f.$4, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(f.$2, style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 14.5)),
                  const SizedBox(height: 4),
                  Text(f.$3, style: TextStyle(color: s.sub, fontSize: 12.5, height: 1.5)),
                ])),
              ]),
            ),
          )),
        ]),
      ),
    );
  }

  Widget _stat(BuildContext context, String label, String value) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Expanded(
      child: GlassBox(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 14),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w900, fontSize: 24)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: s.sub, fontSize: 12, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}
