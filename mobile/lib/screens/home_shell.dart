import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../auth_provider.dart';
import '../i18n.dart';
import '../services/notify_center.dart';
import '../theme.dart';
import '../widgets/app_drawer.dart';
import '../widgets/assistant_widget.dart';
import '../widgets/notification_bell.dart';
import '../widgets/widgets.dart';
import 'complaint_detail_screen.dart';
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
  IncomingAlert? _floater;
  Timer? _floaterTimer;
  StreamSubscription<IncomingAlert>? _alertSub;
  StreamSubscription<int>? _tapSub;

  @override
  void initState() {
    super.initState();
    NotifyCenter.instance.start(isLoggedIn: () {
      try {
        return context.read<AuthProvider>().user != null;
      } catch (_) {
        return false;
      }
    });
    _alertSub = NotifyCenter.instance.alerts.listen(_showFloater);
    _tapSub = NotifyCenter.instance.taps.listen(_openComplaint);
  }

  @override
  void dispose() {
    _alertSub?.cancel();
    _tapSub?.cancel();
    _floaterTimer?.cancel();
    NotifyCenter.instance.stop();
    super.dispose();
  }

  void _showFloater(IncomingAlert a) {
    if (!mounted) return;
    _floaterTimer?.cancel();
    setState(() => _floater = a);
    _floaterTimer = Timer(const Duration(seconds: 4), () {
      if (mounted) setState(() => _floater = null);
    });
  }

  void _openComplaint(int id) {
    if (!mounted) return;
    _floaterTimer?.cancel();
    setState(() => _floater = null);
    Navigator.push(context, MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: id)));
  }

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
          if (_floater != null)
            Positioned(
              top: 10, left: 14, right: 14,
              child: GestureDetector(
                onTap: () {
                  final id = _floater!.complaintId;
                  _floaterTimer?.cancel();
                  setState(() => _floater = null);
                  if (id != null) _openComplaint(id);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    color: s.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: NSColors.accent.withOpacity(0.5)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.35), blurRadius: 14)],
                  ),
                  child: Row(children: [
                    const Icon(Icons.notifications_active_rounded, color: NSColors.accent, size: 22),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(_floater!.title,
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 13.5)),
                      const SizedBox(height: 2),
                      Text(_floater!.message,
                          maxLines: 2, overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: s.sub, fontSize: 12)),
                    ])),
                    GestureDetector(
                      onTap: () {
                        _floaterTimer?.cancel();
                        setState(() => _floater = null);
                      },
                      child: Icon(Icons.close_rounded, color: s.faint, size: 18),
                    ),
                  ]),
                ),
              ),
            ),
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
