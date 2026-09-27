import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Accent palette — identical in dark and light themes.
class NSColors {
  static const accent = Color(0xFF5B8CFF);
  static const accent2 = Color(0xFFA76CFF);
  static const accent3 = Color(0xFFFF6CB5);
  static const mint = Color(0xFF2DD4BF);
  static const amber = Color(0xFFFBBF24);
  static const rose = Color(0xFFFB7185);
}

/// Surface/text colors that flip with the theme (like the web app's CSS tokens).
@immutable
class NSScheme extends ThemeExtension<NSScheme> {
  final Color bg;
  final Color card;
  final Color text;
  final Color sub;
  final Color faint;
  final Color line;
  final Color fill;
  final Color nav;

  const NSScheme({
    required this.bg,
    required this.card,
    required this.text,
    required this.sub,
    required this.faint,
    required this.line,
    required this.fill,
    required this.nav,
  });

  static const dark = NSScheme(
    bg: Color(0xFF05070F),
    card: Color(0xFF0B1020),
    text: Colors.white,
    sub: Color(0x62FFFFFF), // white38
    faint: Color(0x40FFFFFF), // white24
    line: Color(0x1AFFFFFF), // white10
    fill: Color(0x0AFFFFFF),
    nav: Color(0xFF0B1020),
  );

  static const light = NSScheme(
    bg: Color(0xFFF4F6FB),
    card: Color(0xFFFFFFFF),
    text: Color(0xFF0B1020),
    sub: Color(0xFF475569),
    faint: Color(0xFF94A3B8),
    line: Color(0xFFE2E8F0),
    fill: Color(0x080B1020),
    nav: Color(0xFFFFFFFF),
  );

  @override
  NSScheme copyWith({
    Color? bg,
    Color? card,
    Color? text,
    Color? sub,
    Color? faint,
    Color? line,
    Color? fill,
    Color? nav,
  }) =>
      NSScheme(
        bg: bg ?? this.bg,
        card: card ?? this.card,
        text: text ?? this.text,
        sub: sub ?? this.sub,
        faint: faint ?? this.faint,
        line: line ?? this.line,
        fill: fill ?? this.fill,
        nav: nav ?? this.nav,
      );

  @override
  ThemeExtension<NSScheme> lerp(ThemeExtension<NSScheme>? other, double t) {
    if (other is! NSScheme) return this;
    return NSScheme(
      bg: Color.lerp(bg, other.bg, t)!,
      card: Color.lerp(card, other.card, t)!,
      text: Color.lerp(text, other.text, t)!,
      sub: Color.lerp(sub, other.sub, t)!,
      faint: Color.lerp(faint, other.faint, t)!,
      line: Color.lerp(line, other.line, t)!,
      fill: Color.lerp(fill, other.fill, t)!,
      nav: Color.lerp(nav, other.nav, t)!,
    );
  }
}

extension NSSchemeX on BuildContext {
  NSScheme get ns => Theme.of(this).extension<NSScheme>()!;
}

class NSGradient {
  static const box = LinearGradient(
    colors: [NSColors.accent, NSColors.accent2, NSColors.accent3],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

BoxDecoration glassDecoration(BuildContext context) {
  final s = Theme.of(context).extension<NSScheme>()!;
  return BoxDecoration(
    color: s.fill,
    borderRadius: BorderRadius.circular(18),
    border: Border.all(color: s.line),
  );
}

ThemeData buildTheme(bool dark) {
  final scheme = dark ? NSScheme.dark : NSScheme.light;
  final base = ThemeData(
    useMaterial3: true,
    brightness: dark ? Brightness.dark : Brightness.light,
    extensions: [scheme],
  );
  final onSurface = scheme.text;
  return base.copyWith(
    scaffoldBackgroundColor: scheme.bg,
    colorScheme: (dark ? const ColorScheme.dark() : const ColorScheme.light()).copyWith(
      primary: NSColors.accent,
      secondary: NSColors.accent2,
      error: NSColors.rose,
      surface: scheme.card,
      onSurface: onSurface,
    ),
    iconTheme: IconThemeData(color: onSurface),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      centerTitle: false,
      iconTheme: IconThemeData(color: onSurface),
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w800,
        color: onSurface,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: scheme.nav,
      indicatorColor: NSColors.accent.withOpacity(0.25),
      labelTextStyle: WidgetStateProperty.all(
        TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: scheme.sub),
      ),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(color: selected ? NSColors.accent : scheme.faint);
      }),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: scheme.fill,
      hintStyle: TextStyle(color: scheme.faint),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: scheme.line),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: scheme.line),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: NSColors.accent),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NSColors.accent,
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: scheme.fill,
      selectedColor: NSColors.accent.withOpacity(0.25),
      labelStyle: TextStyle(color: scheme.sub, fontSize: 12.5),
      side: BorderSide(color: scheme.line),
      shape: const StadiumBorder(),
    ),
    cardTheme: CardThemeData(
      color: scheme.fill,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(18),
        side: BorderSide(color: scheme.line),
      ),
      elevation: 0,
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: NSColors.accent),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: scheme.card,
      contentTextStyle: TextStyle(color: onSurface),
    ),
    dividerTheme: DividerThemeData(color: scheme.line),
  );
}

/// Dark/light mode provider — mirrors the web app's ThemeProvider.
class ThemeProvider extends ChangeNotifier {
  static const _key = 'ns_theme';
  ThemeMode _mode = ThemeMode.dark;
  bool _ready = false;

  ThemeMode get mode => _mode;
  bool get isDark => _mode != ThemeMode.light;
  bool get ready => _ready;

  Future<void> load() async {
    final p = await SharedPreferences.getInstance();
    final v = p.getString(_key);
    if (v == 'light') _mode = ThemeMode.light;
    _ready = true;
    notifyListeners();
  }

  Future<void> setMode(ThemeMode m) async {
    _mode = m;
    final p = await SharedPreferences.getInstance();
    await p.setString(_key, m == ThemeMode.light ? 'light' : 'dark');
    notifyListeners();
  }

  Future<void> toggle() => setMode(isDark ? ThemeMode.light : ThemeMode.dark);
}
