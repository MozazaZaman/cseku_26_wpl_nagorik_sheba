import 'package:flutter/material.dart';

import 'models.dart';
import 'screens/home_shell.dart';
import 'screens/landing_screen.dart';
import 'screens/super_admin_screen.dart';

/// Single destination rule for every entry point (splash, login, drawer
/// switch): super admins land on their console, everyone signed in lands in
/// the app shell, guests land on the landing page. One path, no duplicates.
Widget homeForRole(User? user) {
  if (user == null) return const LandingScreen();
  if (user.role == 'super_admin') return const SuperAdminScreen();
  return const HomeShell(initialTab: 0);
}
