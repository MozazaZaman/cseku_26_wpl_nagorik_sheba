import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/app_drawer.dart';
import '../widgets/assistant_widget.dart';
import '../widgets/notification_bell.dart';
import '../widgets/widgets.dart';
import 'explore_screen.dart';
import 'profile_screen.dart';
import 'services_screen.dart';
import 'staff_screen.dart';
import 'submit_screen.dart';

class HomeShell extends StatefulWidget {
  final int initialTab;
  const HomeShell({super.key, this.initialTab = 0});

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _tab = widget.initialTab;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final t = (String k) => lang.t(k);
    final isStaff = auth.isStaff;

    final pages = isStaff
        ? [const StaffScreen(), const ProfileScreen()]
        : [
            const ExploreScreen(),
            const ServicesScreen(),
            const SubmitScreen(),
            const ProfileScreen(),
          ];

    final destinations = isStaff
        ? [
            NavigationDestination(icon: const Icon(Icons.engineering_rounded), label: t('nav.queue')),
            NavigationDestination(icon: const Icon(Icons.person_rounded), label: t('nav.profile')),
          ]
        : [
            NavigationDestination(icon: const Icon(Icons.explore_rounded), label: t('nav.explore')),
            NavigationDestination(icon: const Icon(Icons.emergency_rounded), label: t('nav.emergency')),
            NavigationDestination(icon: const Icon(Icons.add_circle_outline_rounded), label: t('nav.submit')),
            NavigationDestination(icon: const Icon(Icons.person_rounded), label: t('nav.profile')),
          ];

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        leading: Builder(builder: (ctx) => IconButton(
          tooltip: lang.t('menu.explore'),
          icon: const Icon(Icons.menu_rounded),
          onPressed: () => Scaffold.of(ctx).openDrawer(),
        )),
        title: Row(children: [
          const AppLogo(size: 30, radius: 8),
          const SizedBox(width: 9),
          RichText(
            text: TextSpan(
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: s.text),
              children: [
                const TextSpan(text: 'Nagorik'),
                TextSpan(text: 'Sheba', style: TextStyle(color: NSColors.accent)),
              ],
            ),
          ),
        ]),
        actions: const [NotificationBell()],
      ),
      body: Stack(
        children: [
          IndexedStack(index: _tab.clamp(0, pages.length - 1), children: pages),
          if (!isStaff)
            Positioned(
              bottom: 18,
              right: 16,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const AssistantWidget(),
                  const SizedBox(height: 12),
                  FloatingActionButton.extended(
                    heroTag: 'report',
                    backgroundColor: NSColors.accent2,
                    onPressed: () => setState(() => _tab = 2),
                    icon: const Icon(Icons.campaign_rounded),
                    label: Text(t('nav.report'), style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        height: 68,
        selectedIndex: _tab.clamp(0, pages.length - 1),
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: s.nav,
        indicatorColor: NSColors.accent.withOpacity(0.25),
        destinations: destinations,
      ),
    );
  }
}
