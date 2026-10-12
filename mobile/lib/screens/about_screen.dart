import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'faq_screen.dart';

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  static const _tech = [
    'Flutter (mobile)', 'React + Vite (web)', 'Node.js + Express',
    'PostgreSQL (Neon)', 'face-api.js + TensorFlow', 'Gemini AI', 'OpenStreetMap',
  ];

  static const _steps = [
    ('📝', 'about.step1', 'about.step1s'),
    ('🤖', 'about.step2', 'about.step2s'),
    ('🏛️', 'about.step3', 'about.step3s'),
    ('⭐', 'about.step4', 'about.step4s'),
  ];

  static const _emails = [
    'mozazaalzaman@gmail.com',
    'riantoufik897@gmail.com',
  ];
  static const _github = 'https://github.com/MozazaZaman/WPL_Project';

  Widget _para(BuildContext context, String text) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return GlassBox(
        child: Text(text, style: TextStyle(color: s.sub, fontSize: 13.5, height: 1.6)));
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    return Scaffold(
      appBar: AppBar(title: Text(lang.t('about.title'))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
        children: [
          Center(child: Column(children: [
            const AppLogo(size: 88, radius: 22),
            const SizedBox(height: 14),
            RichText(
              text: TextSpan(
                style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: s.text),
                children: [
                  const TextSpan(text: 'Nagorik'),
                  TextSpan(text: 'Sheba', style: TextStyle(color: NSColors.accent)),
                ],
              ),
            ),
            const SizedBox(height: 4),
            Text(lang.t('land.badge'), style: TextStyle(color: NSColors.accent2, fontWeight: FontWeight.w700, fontSize: 14)),
            const SizedBox(height: 8),
            Text(lang.t('about.sub'),
                textAlign: TextAlign.center,
                style: TextStyle(color: s.sub, fontSize: 13, height: 1.5)),
          ])),
          const SizedBox(height: 24),
          Text(lang.t('about.mission'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          _para(context, lang.t('about.missionBody')),
          const SizedBox(height: 10),
          _para(context, lang.t('about.missionBody2')),
          const SizedBox(height: 22),
          Text(lang.t('about.problem'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          _para(context, lang.t('about.problemBody1')),
          const SizedBox(height: 10),
          _para(context, lang.t('about.problemBody2')),
          const SizedBox(height: 22),
          Text(lang.t('about.howTitle'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          ..._steps.map((st) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: GlassBox(
                  padding: const EdgeInsets.all(14),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(st.$1, style: const TextStyle(fontSize: 20)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(lang.t(st.$2),
                          style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 14)),
                      const SizedBox(height: 3),
                      Text(lang.t(st.$3), style: TextStyle(color: s.sub, fontSize: 12.5, height: 1.5)),
                    ])),
                  ]),
                ),
              )),
          GlassBox(
            padding: const EdgeInsets.all(14),
            child: Row(children: [
              Expanded(child: Text(lang.t('about.faqNote'), style: TextStyle(color: s.sub, fontSize: 12.5))),
              const SizedBox(width: 10),
              FilledButton(
                onPressed: () => Navigator.push(
                    context, MaterialPageRoute(builder: (_) => const FaqScreen())),
                child: Text(lang.t('about.faqLink'),
                    textAlign: TextAlign.center, style: const TextStyle(fontSize: 12)),
              ),
            ]),
          ),
          const SizedBox(height: 22),
          Text(lang.t('about.team'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          GlassBox(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(lang.t('about.teamBody'), style: TextStyle(color: s.sub, fontSize: 13, height: 1.6)),
              const SizedBox(height: 10),
              Text('• ${lang.t('about.teamM1')}',
                  style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
              Text('• ${lang.t('about.teamM2')}',
                  style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
              const SizedBox(height: 10),
              Text(
                '${lang.t('about.teamInstructor')} ${lang.t('about.teamInstructorName')}, ${lang.t('about.teamAffil')}',
                style: TextStyle(color: s.sub, fontSize: 12.5, height: 1.6)),
              const SizedBox(height: 10),
              Text(lang.t('about.teamClosing'), style: TextStyle(color: s.sub, fontSize: 12.5, height: 1.6)),
            ]),
          ),
          const SizedBox(height: 22),
          Text(lang.t('about.coverage'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          GlassBox(
            padding: const EdgeInsets.all(14),
            child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('🇧🇩', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(lang.t('about.coverageBody'),
                    style: TextStyle(color: s.sub, fontSize: 13, height: 1.5)),
                const SizedBox(height: 8),
                Text(lang.t('about.coverageBody2'),
                    style: TextStyle(color: s.sub, fontSize: 13, height: 1.5)),
              ])),
            ]),
          ),
          const SizedBox(height: 22),
          Text(lang.t('about.techTitle'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8, runSpacing: 8,
            children: _tech.map((t) => Chip(
                  label: Text(t, style: TextStyle(color: s.sub, fontSize: 12)),
                )).toList(),
          ),
          const SizedBox(height: 22),
          Text(lang.t('about.contact'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          GlassBox(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(lang.t('about.contactBody'), style: TextStyle(color: s.sub, fontSize: 13, height: 1.5)),
              const SizedBox(height: 10),
              ..._emails.map((e) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: GestureDetector(
                      onTap: () => launchUrl(Uri.parse('mailto:$e')),
                      child: Text('✉️ $e',
                          style: TextStyle(color: NSColors.accent, fontSize: 13, fontWeight: FontWeight.w600)),
                    ),
                  )),
              GestureDetector(
                onTap: () => launchUrl(Uri.parse(_github), mode: LaunchMode.externalApplication),
                child: Text('⌨️ GitHub repository',
                    style: TextStyle(color: NSColors.accent, fontSize: 13, fontWeight: FontWeight.w600)),
              ),
            ]),
          ),
          const SizedBox(height: 18),
          Center(child: Text(lang.t('about.noteBody'),
              textAlign: TextAlign.center,
              style: TextStyle(color: s.faint, fontSize: 11.5, height: 1.5))),
        ],
      ),
    );
  }
}
