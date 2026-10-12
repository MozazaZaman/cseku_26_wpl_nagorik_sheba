import 'dart:async';
import 'dart:math';

import 'package:app_badge_plus/app_badge_plus.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_service.dart';
import '../models.dart';

/// A new notification worth interrupting the user for.
class IncomingAlert {
  final int id;
  final String title;
  final String message;
  final int? complaintId;
  const IncomingAlert({required this.id, required this.title, required this.message, this.complaintId});
}

/// Foreground notification hub. Mirrors the web bell's 30s poll, then:
/// - system banner / heads-up via flutter_local_notifications,
/// - app-icon badge via app_badge_plus,
/// - in-app floating banner via the [alerts] stream (HomeShell renders it).
class NotifyCenter {
  static final NotifyCenter instance = NotifyCenter._();
  NotifyCenter._();

  static const _channelId = 'nagorik_alerts';
  static const _lastKey = 'ns_last_notif_id';

  final FlutterLocalNotificationsPlugin _plugin = FlutterLocalNotificationsPlugin();
  final StreamController<IncomingAlert> _alerts = StreamController<IncomingAlert>.broadcast();
  final StreamController<int> _taps = StreamController<int>.broadcast();

  /// In-app floating banners.
  Stream<IncomingAlert> get alerts => _alerts.stream;

  /// System-notification taps carrying a complaint id.
  Stream<int> get taps => _taps.stream;

  Timer? _timer;
  bool _started = false;
  bool Function()? _isLoggedIn;

  Future<void> start({bool Function()? isLoggedIn}) async {
    _isLoggedIn = isLoggedIn;
    if (_started) return;
    _started = true;
    const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
    const darwinInit = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    await _plugin.initialize(
      settings: const InitializationSettings(android: androidInit, iOS: darwinInit, macOS: darwinInit),
      onDidReceiveNotificationResponse: (r) {
        final id = int.tryParse(r.payload ?? '');
        if (id != null) _taps.add(id);
      },
    );
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    await _plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(const AndroidNotificationChannel(
          _channelId, 'Complaint updates',
          description: 'Status updates on your complaints and votes',
          importance: Importance.max,
        ));
    await _poll();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _poll());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
    _started = false;
    _isLoggedIn = null;
    _setBadge(0);
  }

  Future<void> refreshBadge() => _poll();

  Future<void> _poll() async {
    try {
      if (_isLoggedIn != null && !_isLoggedIn!()) {
        await _setBadge(0);
        return;
      }
      final api = ApiService();
      final unread = await api.unreadCount();
      await _setBadge(unread);
      final prefs = await SharedPreferences.getInstance();
      final lastSeen = prefs.getInt(_lastKey) ?? 0;
      final items = await api.notifications();
      if (items.isEmpty) return;
      final maxId = items.map((e) => e.id).reduce(max);
      if (lastSeen == 0) {
        await prefs.setInt(_lastKey, maxId);
        return;
      }
      final fresh = items.where((e) => e.id > lastSeen).toList()
        ..sort((a, b) => a.id.compareTo(b.id));
      await prefs.setInt(_lastKey, maxId);
      for (final n in fresh.take(3)) {
        await _show(n);
        if (!_alerts.isClosed) {
          _alerts.add(IncomingAlert(
              id: n.id, title: n.title, message: n.message, complaintId: n.complaintId));
        }
      }
    } catch (_) {}
  }

  Future<void> _show(NotificationItem n) async {
    const android = AndroidNotificationDetails(
      _channelId, 'Complaint updates',
      importance: Importance.max,
      priority: Priority.high,
      ticker: 'Nagorik Sheba',
    );
    const darwin = DarwinNotificationDetails(
        presentAlert: true, presentBadge: true, presentSound: true);
    await _plugin.show(
      id: n.id,
      title: n.title,
      body: n.message,
      notificationDetails:
          const NotificationDetails(android: android, iOS: darwin, macOS: darwin),
      payload: '${n.complaintId ?? ''}',
    );
  }

  Future<void> _setBadge(int count) async {
    try {
      if (await AppBadgePlus.isSupported()) await AppBadgePlus.updateBadge(count);
    } catch (_) {}
  }
}
