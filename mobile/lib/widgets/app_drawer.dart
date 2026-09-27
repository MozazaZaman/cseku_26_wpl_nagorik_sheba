import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import '../screens/about_screen.dart';
import '../screens/faq_screen.dart';
import '../screens/leaderboard_screen.dart';
import '../screens/login_screen.dart';
import '../screens/staff_badges_screen.dart';
import '../screens/staff_reviews_screen.dart';
import '../screens/landing_screen.dart';

class AppDrawer extends StatelessWidget {
  const AppDrawer({super.key});

  Widget _sectionHeader(BuildContext context, String text) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Padding(
      padding: const EdgeInsets.fromLTRB(22, 18, 22, 6),
      child: Text(text.toUpperCase(),
          style: TextStyle(color: s.faint, fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 1.2)),
    );
  }

  Widget _tile(BuildContext context, IconData icon, String label, VoidCallback onTap,
      {Color? iconColor, bool danger = false}) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return ListTile(
      leading: Icon(icon, color: danger ? NSColors.rose : (iconColor ?? s.sub), size: 21),
      title: Text(label,
          style: TextStyle(color: danger ? NSColors.rose : s.text, fontSize: 14.5, fontWeight: FontWeight.w600)),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final lang = context.watch<Lang>();
    final theme = context.watch<ThemeProvider>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final user = auth.user;
    final isMayor = user?.role == 'staff' && user?.staffRole == 'mayor';

    void close() => Navigator.of(context).pop();

    return Drawer(
      backgroundColor: s.bg,
      child: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: 12),
          children: [
            // ---- Header ----
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 8, 18, 4),
              child: Row(children: [
                const AppLogo(size: 52, radius: 14),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  RichText(
                    text: TextSpan(
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: s.text),
                      children: [
                        const TextSpan(text: 'Nagorik'),
                        TextSpan(text: 'Sheba', style: TextStyle(color: NSColors.accent)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    user != null
                        ? '${user.name} · ${auth.isStaff ? (user.staffRole ?? 'staff') : 'citizen'}'
                        : lang.t('menu.login'),
                    style: TextStyle(color: s.sub, fontSize: 12),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  if (user?.authorityName != null)
                    Text(user!.authorityName!,
                        style: TextStyle(color: NSColors.mint, fontSize: 11),
                        maxLines: 1, overflow: TextOverflow.ellipsis),
                ])),
              ]),
            ),
            Divider(color: s.line, height: 20),

            // ---- Browse ----
            _sectionHeader(context, lang.t('menu.explore')),
            _tile(context, Icons.home_rounded, lang.t('menu.home'), () {
              close();
              Navigator.push(context, MaterialPageRoute(builder: (_) => const LandingScreen()));
            }),
            _tile(context, Icons.emoji_events_rounded, lang.t('menu.leaderboard'), () {
              close();
              Navigator.push(context, MaterialPageRoute(builder: (_) => const LeaderboardScreen()));
            }),
            _tile(context, Icons.quiz_rounded, lang.t('menu.faq'), () {
              close();
              Navigator.push(context, MaterialPageRoute(builder: (_) => const FaqScreen()));
            }),
            _tile(context, Icons.info_rounded, lang.t('menu.about'), () {
              close();
              Navigator.push(context, MaterialPageRoute(builder: (_) => const AboutScreen()));
            }),

            // ---- Staff ----
            if (auth.isStaff && user != null) ...[
              Divider(color: s.line, height: 20),
              _sectionHeader(context, lang.t('menu.staffConsole')),
              _tile(context, Icons.badge_rounded, lang.t('menu.myBadges'), () {
                close();
                Navigator.push(context, MaterialPageRoute(builder: (_) => const StaffBadgesScreen()));
              }, iconColor: NSColors.amber),
              if (isMayor) ...[
                _tile(context, Icons.reviews_rounded, lang.t('menu.reviews'), () {
                  close();
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const StaffReviewsScreen()));
                }, iconColor: NSColors.mint),
                _tile(context, Icons.groups_rounded, lang.t('menu.teamBadges'), () {
                  close();
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const StaffBadgesScreen()));
                }, iconColor: NSColors.accent2),
              ],
            ],

            Divider(color: s.line, height: 20),

            // ---- Preferences ----
            _sectionHeader(context, lang.t('menu.appearance')),
            SwitchListTile(
              secondary: Icon(theme.isDark ? Icons.dark_mode_rounded : Icons.light_mode_rounded,
                  color: NSColors.amber, size: 21),
              title: Text(lang.t('menu.appearance.dark'),
                  style: TextStyle(color: s.text, fontSize: 14.5, fontWeight: FontWeight.w600)),
              value: theme.isDark,
              activeColor: NSColors.accent,
              contentPadding: const EdgeInsets.symmetric(horizontal: 18),
              onChanged: (_) => theme.toggle(),
            ),
            _tile(context, Icons.translate_rounded, lang.t('menu.language'), () => lang.toggle(),
                iconColor: NSColors.accent2),
            Padding(
              padding: const EdgeInsets.only(left: 18, right: 18, top: 2),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(lang.isBn ? 'বর্তমান: বাংলা' : 'Current: English',
                    style: TextStyle(color: s.faint, fontSize: 11.5)),
              ),
            ),

            const SizedBox(height: 8),
            // ---- Account ----
            if (user != null)
              _tile(context, Icons.logout_rounded, lang.t('menu.logout'), () async {
                close();
                await auth.logout();
                if (!context.mounted) return;
                Navigator.pushAndRemoveUntil(
                    context, MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
              }, danger: true)
            else
              _tile(context, Icons.login_rounded, lang.t('menu.login'), () {
                close();
                Navigator.push(context, MaterialPageRoute(builder: (_) => const LoginScreen()));
              }, iconColor: NSColors.mint),
          ],
        ),
      ),
    );
  }
}
