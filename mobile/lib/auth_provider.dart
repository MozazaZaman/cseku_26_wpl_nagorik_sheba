import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_service.dart';
import 'models.dart';

/// Session behaviour mirrors the web app:
///  - a login survives app restarts (token persisted, re-validated via /auth/me)
///  - explicit logout clears the token immediately
///  - after [inactivityLimit] of not opening the app, the session expires and
///    the user must log in again
class AuthProvider extends ChangeNotifier with WidgetsBindingObserver {
  static const _lastActiveKey = 'ns_last_active';
  static const inactivityLimit = Duration(days: 30);

  final api = ApiService();
  User? user;
  bool ready = false;

  AuthProvider() {
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _checkInactivity();
  }

  Future<void> bootstrap() async {
    await _checkInactivity();
    final t = await api.loadToken();
    if (t != null) {
      try {
        final r = await httpGet('/auth/me');
        user = User.fromJson(r['user']);
        await _touchActive();
      } catch (_) {
        await api.clearToken();
      }
    }
    ready = true;
    notifyListeners();
  }

  /// Expires the session if the app has not been opened for [inactivityLimit].
  Future<void> _checkInactivity() async {
    final p = await SharedPreferences.getInstance();
    final last = p.getInt(_lastActiveKey);
    if (last == null) return;
    final elapsed = DateTime.now().millisecondsSinceEpoch - last;
    if (elapsed > inactivityLimit.inMilliseconds) {
      await api.clearToken();
      user = null;
      notifyListeners();
    }
  }

  Future<void> _touchActive() async {
    final p = await SharedPreferences.getInstance();
    await p.setInt(_lastActiveKey, DateTime.now().millisecondsSinceEpoch);
  }

  Future<dynamic> httpGet(String path) => api.rawGet(path);

  Future<void> login(String email, String password) async {
    user = await api.login(email, password);
    await _touchActive();
    notifyListeners();
  }

  Future<void> register(String name, String email, String phone, String password) async {
    user = await api.register(name, email, phone, password);
    await _touchActive();
    notifyListeners();
  }

  Future<void> registerWithFace({
    required String name,
    required String email,
    required String phone,
    required String password,
    required dynamic selfie,
    required dynamic idPhoto,
  }) async {
    user = await api.registerWithFace(
      name: name, email: email, phone: phone, password: password,
      selfie: selfie, idPhoto: idPhoto,
    );
    await _touchActive();
    notifyListeners();
  }

  Future<void> logout() async {
    await api.clearToken();
    final p = await SharedPreferences.getInstance();
    await p.remove(_lastActiveKey);
    user = null;
    notifyListeners();
  }

  bool get isStaff => user?.role == 'staff';

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
