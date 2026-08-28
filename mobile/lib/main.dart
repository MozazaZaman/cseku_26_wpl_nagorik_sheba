import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'auth_provider.dart';
import 'i18n.dart';
import 'screens/splash_screen.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NagorikShebaApp());
}

class NagorikShebaApp extends StatelessWidget {
  const NagorikShebaApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..bootstrap()),
        ChangeNotifierProvider(create: (_) => Lang()..load()),
      ],
      child: Consumer<Lang>(
        builder: (context, lang, _) {
          final base = buildTheme();
          if (!lang.ready) {
            return MaterialApp(
              title: 'Nagorik Sheba',
              debugShowCheckedModeBanner: false,
              theme: base,
              home: const SplashScreen(),
            );
          }
          final titleStyle = base.appBarTheme.titleTextStyle;
          return MaterialApp(
            title: 'Nagorik Sheba',
            debugShowCheckedModeBanner: false,
            theme: lang.isBn
                ? base.copyWith(
                    textTheme: base.textTheme.apply(fontFamily: 'NotoSansBengali'),
                    appBarTheme: base.appBarTheme.copyWith(
                      titleTextStyle: titleStyle?.copyWith(fontFamily: 'NotoSansBengali'),
                    ),
                  )
                : base,
            locale: lang.isBn ? const Locale('bn') : const Locale('en'),
            home: const SplashScreen(),
          );
        },
      ),
    );
  }
}
