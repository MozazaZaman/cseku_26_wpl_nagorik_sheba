import 'package:flutter/material.dart';

import 'api_service.dart';
import 'models.dart';

class AuthProvider extends ChangeNotifier {
  final api = ApiService();
  User? user;
  bool ready = false;

  Future<void> bootstrap() async {
    final t = await api.loadToken();
    if (t != null) {
      try {
        final r = await httpGet('/auth/me');
        user = User.fromJson(r['user']);
      } catch (_) {
        await api.clearToken();
      }
    }
    ready = true;
    notifyListeners();
  }

  Future<dynamic> httpGet(String path) async {
    // small helper reusing ApiService headers via public method
    return api.rawGet(path);
  }

  Future<void> login(String email, String password) async {
    user = await api.login(email, password);
    notifyListeners();
  }

  Future<void> register(String name, String email, String phone, String password) async {
    user = await api.register(name, email, phone, password);
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
    notifyListeners();
  }

  Future<void> logout() async {
    await api.clearToken();
    user = null;
    notifyListeners();
  }

  bool get isStaff => user?.role == 'staff';
}
