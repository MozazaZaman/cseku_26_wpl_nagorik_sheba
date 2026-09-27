import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../screens/complaint_detail_screen.dart';
import 'widgets.dart';

/// Bell icon with a live unread badge. Mirrors the web app's NotificationBell:
/// polls the unread count, opens a panel with the full list, mark-read / clear.
class NotificationBell extends StatefulWidget {
  final bool compact;
  const NotificationBell({super.key, this.compact = false});

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> with WidgetsBindingObserver {
  final api = ApiService();
  int unread = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _refresh();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _refresh());
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _refresh();
  }

  Future<void> _refresh() async {
    if (!context.mounted) return;
    final auth = context.read<AuthProvider>();
    if (auth.user == null) return;
    try {
      final n = await api.unreadCount();
      if (mounted) setState(() => unread = n);
    } catch (_) {}
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _openPanel() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => const _NotificationsPanel(),
    ).then((_) => _refresh());
  }

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return IconButton(
      icon: Stack(clipBehavior: Clip.none, alignment: Alignment.center, children: [
        Icon(Icons.notifications_rounded, color: s.text, size: widget.compact ? 20 : 23),
        if (unread > 0)
          Positioned(
            right: -4, top: -4,
            child: Container(
              padding: const EdgeInsets.all(3.5),
              decoration: const BoxDecoration(color: NSColors.rose, shape: BoxShape.circle),
              constraints: const BoxConstraints(minWidth: 16, minHeight: 16),
              child: Text('$unread',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white, fontSize: 9.5, fontWeight: FontWeight.w800)),
            ),
          ),
      ]),
      onPressed: _openPanel,
    );
  }
}

class _NotificationsPanel extends StatefulWidget {
  const _NotificationsPanel();

  @override
  State<_NotificationsPanel> createState() => _NotificationsPanelState();
}

class _NotificationsPanelState extends State<_NotificationsPanel> {
  final api = ApiService();
  List<NotificationItem> items = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final list = await api.notifications();
      if (!mounted) return;
      setState(() {
        items = list;
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    return FractionallySizedBox(
      heightFactor: 0.8,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
          child: Row(children: [
            Text(lang.t('notif.title'), style: whiteTitle(context, size: 18)),
            const Spacer(),
            TextButton(
              onPressed: () async {
                await api.markAllNotificationsRead();
                _load();
              },
              child: Text(lang.t('notif.markAll'), style: const TextStyle(fontSize: 12.5)),
            ),
            TextButton(
              onPressed: () async {
                final ok = await showDialog<bool>(
                  context: context,
                  builder: (_) => AlertDialog(
                    backgroundColor: s.card,
                    title: Text(lang.t('notif.clear'), style: TextStyle(color: s.text)),
                    content: Text(lang.t('notif.clearConfirm'), style: TextStyle(color: s.sub)),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
                      TextButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: Text(lang.t('notif.clear'), style: const TextStyle(color: NSColors.rose))),
                    ],
                  ),
                );
                if (ok == true) {
                  await api.clearAllNotifications();
                  _load();
                }
              },
              child: Text(lang.t('notif.clear'), style: const TextStyle(fontSize: 12.5, color: NSColors.rose)),
            ),
          ]),
        ),
        Divider(color: s.line, height: 1),
        Expanded(
          child: loading
              ? Center(child: CircularProgressIndicator(color: NSColors.accent))
              : items.isEmpty
                  ? Center(child: Text(lang.t('notif.empty'), style: TextStyle(color: s.faint)))
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: items.length,
                      separatorBuilder: (_, __) => Divider(color: s.line, height: 1, indent: 16, endIndent: 16),
                      itemBuilder: (_, i) {
                        final n = items[i];
                        return Dismissible(
                          key: ValueKey('notif-${n.id}'),
                          direction: DismissDirection.endToStart,
                          background: Container(
                            alignment: Alignment.centerRight,
                            padding: const EdgeInsets.only(right: 20),
                            color: NSColors.rose.withOpacity(0.18),
                            child: const Icon(Icons.delete_outline_rounded, color: NSColors.rose),
                          ),
                          onDismissed: (_) async {
                            await api.deleteNotification(n.id);
                            if (!mounted) return;
                            setState(() => items.removeAt(i));
                          },
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
                            leading: Stack(children: [
                              const Icon(Icons.circle_notifications_rounded, color: NSColors.accent, size: 26),
                              if (!n.isRead)
                                Positioned(right: 1, top: 1,
                                    child: Container(width: 8, height: 8,
                                        decoration: const BoxDecoration(color: NSColors.rose, shape: BoxShape.circle))),
                            ]),
                            title: Row(children: [
                              Expanded(child: Text(n.title,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                      color: s.text,
                                      fontWeight: n.isRead ? FontWeight.w600 : FontWeight.w800,
                                      fontSize: 13.5))),
                              const SizedBox(width: 6),
                              Text(relativeTime(n.createdAt), style: TextStyle(color: s.faint, fontSize: 10)),
                            ]),
                            subtitle: Text(n.message,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: s.sub, fontSize: 12.5)),
                            onTap: () async {
                              if (n.complaintId == null) return;
                              await api.markNotificationRead(n.id);
                              if (!context.mounted) return;
                              Navigator.pop(context);
                              Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                      builder: (_) => ComplaintDetailScreen(id: n.complaintId!)));
                            },
                          ),
                        );
                      },
                    ),
        ),
      ]),
    );
  }
}
