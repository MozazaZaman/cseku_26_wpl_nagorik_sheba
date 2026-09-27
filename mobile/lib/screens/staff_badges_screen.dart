import 'package:flutter/material.dart' hide Badge;
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

/// Achievement badges: own badges for staff, team roster + commendations for mayors.
/// Mirrors the web app's AchievementBadges + TeamBadges.
class StaffBadgesScreen extends StatefulWidget {
  const StaffBadgesScreen({super.key});

  @override
  State<StaffBadgesScreen> createState() => _StaffBadgesScreenState();
}

class _StaffBadgesScreenState extends State<StaffBadgesScreen> {
  final api = ApiService();
  List<Badge> myBadges = [];
  List<Recognition> myRecognitions = [];
  List<dynamic> team = [];
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final isMayor = context.read<AuthProvider>().user?.staffRole == 'mayor';
      if (isMayor) {
        final t = await api.teamBadges();
        if (!mounted) return;
        setState(() { team = t; loading = false; });
      } else {
        final r = await api.myBadges();
        if (!mounted) return;
        setState(() {
          myBadges = (r['badges'] as List? ?? []).map((b) => Badge.fromJson(b as Map<String, dynamic>)).toList();
          myRecognitions =
              (r['recognitions'] as List? ?? []).map((b) => Recognition.fromJson(b as Map<String, dynamic>)).toList();
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _commend(int staffId) async {
    final lang = context.read<Lang>();
    final ctrl = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
        title: Text(lang.t('badge.recognize'), style: TextStyle(color: Theme.of(context).extension<NSScheme>()!.text)),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(lang.t('badge.recognizeHint'), style: TextStyle(color: Theme.of(context).extension<NSScheme>()!.sub, fontSize: 12)),
          const SizedBox(height: 12),
          TextField(controller: ctrl, maxLines: 3, decoration: InputDecoration(hintText: lang.t('badge.noteLabel'))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: Text(lang.t('badge.recognize'))),
        ],
      ),
    );
    if (ok != true || ctrl.text.trim().isEmpty) return;
    try {
      await api.recognizeStaff(staffId, ctrl.text.trim());
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(lang.t('badge.recognizeDone')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Widget _badgeChip(Badge b) {
    final s = Theme.of(context).extension<NSScheme>()!;
    final tierIcon = Badge.tierIcons[b.tier] ?? '🏅';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
      decoration: BoxDecoration(
        color: (b.tier == 'gold'
                ? NSColors.amber
                : b.tier == 'silver'
                    ? Colors.grey
                    : b.tier == 'bronze'
                        ? const Color(0xFFCD7F32)
                        : NSColors.accent)
            .withOpacity(0.13),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: s.line),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Text(tierIcon, style: const TextStyle(fontSize: 13)),
        const SizedBox(width: 6),
        Flexible(
          child: Text(b.label,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: s.text, fontSize: 11.5, fontWeight: FontWeight.w700)),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final user = context.watch<AuthProvider>().user;
    final isMayor = user?.staffRole == 'mayor';

    return Scaffold(
      appBar: AppBar(title: Text(isMayor ? lang.t('menu.teamBadges') : lang.t('menu.myBadges'))),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : RefreshIndicator(
              color: NSColors.accent,
              onRefresh: _load,
              child: isMayor ? _teamView() : _myView(),
            ),
    );
  }

  Widget _myView() {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
      children: [
        Text(lang.t('badge.title'), style: whiteTitle(context, size: 18)),
        const SizedBox(height: 12),
        if (myBadges.isEmpty)
          InfoBanner(lang.t('badge.empty'), color: NSColors.accent)
        else
          Wrap(spacing: 8, runSpacing: 8, children: myBadges.map(_badgeChip).toList()),
        if (myRecognitions.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(lang.t('badge.recognitions'), style: whiteTitle(context, size: 18)),
          const SizedBox(height: 12),
          ...myRecognitions.map((r) => GlassBox(
                padding: const EdgeInsets.all(14),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('🎖️', style: TextStyle(fontSize: 20)),
                  const SizedBox(width: 10),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(r.note, style: TextStyle(color: s.text, fontSize: 13.5, height: 1.5)),
                    if (r.awardedByName != null)
                      Padding(padding: const EdgeInsets.only(top: 4),
                          child: Text('— ${r.awardedByName}', style: TextStyle(color: s.faint, fontSize: 11.5))),
                  ])),
                ]),
              )),
        ],
      ],
    );
  }

  Widget _teamView() {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
      children: [
        if (team.isEmpty)
          Center(child: Padding(padding: const EdgeInsets.only(top: 20), child: Text(lang.t('badge.empty'), style: TextStyle(color: s.faint))))
        else
          ...team.map((m) {
            final badges = (m['badges'] as List? ?? []).map((b) => Badge.fromJson(b as Map<String, dynamic>)).toList();
            final recogs = (m['recognitions'] as List? ?? []).map((b) => Recognition.fromJson(b as Map<String, dynamic>)).toList();
            final role = (m['staff_role'] ?? 'field').toString();
            return GlassBox(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  CircleAvatar(
                    radius: 20,
                    backgroundColor: NSColors.accent.withOpacity(0.2),
                    child: Text((m['full_name'] ?? '?')[0].toUpperCase(),
                        style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 16)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(m['full_name'] ?? '', style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 15)),
                    Text('${lang.t('wf.role.$role')} · ${m['department'] ?? ''}',
                        style: TextStyle(color: s.faint, fontSize: 11.5)),
                  ])),
                  TextButton.icon(
                    onPressed: () => _commend(m['staff_id'] as int),
                    icon: const Icon(Icons.military_tech_rounded, size: 16),
                    label: Text(lang.t('badge.recognize'), style: const TextStyle(fontSize: 12)),
                  ),
                ]),
                const SizedBox(height: 12),
                if (badges.isEmpty)
                  Text(lang.t('badge.noBadges'), style: TextStyle(color: s.faint, fontSize: 12))
                else
                  Wrap(spacing: 8, runSpacing: 8, children: badges.map(_badgeChip).toList()),
                if (recogs.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Wrap(spacing: 6, runSpacing: 6, children: recogs.map((r) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                        decoration: BoxDecoration(
                          color: NSColors.amber.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: NSColors.amber.withOpacity(0.3)),
                        ),
                        child: Text('🎖️ ${r.note}', style: TextStyle(color: NSColors.amber, fontSize: 10.5)),
                      );
                    }).toList()),
                  ),
              ]),
            );
          }),
      ],
    );
  }
}
