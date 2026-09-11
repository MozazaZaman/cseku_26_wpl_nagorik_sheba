import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
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
      body: Stack(
        children: [
          IndexedStack(index: _tab.clamp(0, pages.length - 1), children: pages),
          Positioned(
            top: 10,
            right: 12,
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => lang.toggle(),
                borderRadius: BorderRadius.circular(999),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
                  decoration: BoxDecoration(
                    gradient: NSGradient.box,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.35), blurRadius: 10)],
                  ),
                  child: Text(
                    lang.toggleLabel(),
                    style: const TextStyle(color: Colors.white, fontSize: 11.5, fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
      floatingActionButton: isStaff
          ? null
          : FloatingActionButton.extended(
              onPressed: () => setState(() => _tab = 2),
              backgroundColor: NSColors.accent2,
              icon: const Icon(Icons.campaign_rounded),
              label: Text(t('nav.report'), style: const TextStyle(fontWeight: FontWeight.w800)),
            ),
      bottomNavigationBar: NavigationBar(
        height: 68,
        selectedIndex: _tab.clamp(0, pages.length - 1),
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: NSColors.card,
        indicatorColor: NSColors.accent.withOpacity(0.25),
        destinations: destinations,
      ),
    );
  }
}
