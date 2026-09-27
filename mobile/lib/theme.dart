import 'package:flutter/material.dart';

class NSColors {
  static const bg = Color(0xFF05070F);
  static const card = Color(0xFF0B1020);
  static const accent = Color(0xFF5B8CFF);
  static const accent2 = Color(0xFFA76CFF);
  static const accent3 = Color(0xFFFF6CB5);
  static const mint = Color(0xFF2DD4BF);
  static const amber = Color(0xFFFBBF24);
  static const rose = Color(0xFFFB7185);

  static const gradient = LinearGradient(
    colors: [accent, accent2, accent3],
  );
}

ThemeData buildTheme() {
  final base = ThemeData.dark(useMaterial3: true);
  return base.copyWith(
    scaffoldBackgroundColor: NSColors.bg,
    colorScheme: const ColorScheme.dark(
      primary: NSColors.accent,
      secondary: NSColors.accent2,
      error: NSColors.rose,
      surface: NSColors.card,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: Colors.white,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white.withOpacity(0.04),
      hintStyle: TextStyle(color: Colors.white38),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.white10),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: Colors.white10),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: NSColors.accent),
      ),
      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NSColors.accent,
        foregroundColor: Colors.white,
        minimumSize: Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: Colors.white.withOpacity(0.04),
      selectedColor: NSColors.accent.withOpacity(0.25),
      labelStyle: TextStyle(color: Colors.white70, fontSize: 12.5),
      side: BorderSide(color: Colors.white12),
      shape: StadiumBorder(),
    ),
    cardTheme: CardThemeData(
      color: Colors.white.withOpacity(0.04),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: Colors.white10),
      ),
      elevation: 0,
    ),
  );
}

class NSGradient {
  static const box = LinearGradient(
    colors: [NSColors.accent, NSColors.accent2, NSColors.accent3],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

BoxDecoration glassDecoration({Color? border}) => BoxDecoration(
      color: Colors.white.withOpacity(0.04),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: border ?? Colors.white10),
    );
