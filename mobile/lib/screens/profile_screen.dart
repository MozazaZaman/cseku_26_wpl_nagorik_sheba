import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'complaint_detail_screen.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final api = ApiService();
  List<Complaint> mine = [];
  List<NotificationItem> notifs = [];
  bool loading = true;
  bool showAll = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await api.myComplaints();
      final n = await api.notifications();
      if (!mounted) return;
      setState(() {
        mine = m;
        notifs = n;
        loading = false;
      });
    } catch (_) {
      setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    if (user == null) {
      return Center(child: Text(lang.t('prof.notLoggedIn'), style: TextStyle(color: s.sub)));
    }

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 90),
        children: [          GlassBox(
            child: Row(children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: NSColors.accent.withOpacity(0.25),
                child: Text(user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22)),
              ),
              const SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(user.name, style: whiteTitle(context, size: 18)),
                Text(user.email, style: TextStyle(color: s.sub, fontSize: 12.5)),
                if (user.authorityName != null)
                  Padding(padding: const EdgeInsets.only(top: 4),
                      child: Text('${user.authorityName} · ${lang.t('prof.general')}',
                          style: const TextStyle(color: NSColors.mint, fontSize: 11.5))),
              ])),
            ]),
          ),
          const SizedBox(height: 14),

          // ---- Stats cards (mirrors the web Dashboard) ----
          if (!loading)
            Row(children: [
              _stat(context, lang.t('prof.stat.total'), '${mine.length}', NSColors.accent),
              _stat(context, lang.t('prof.stat.process'),
                  '${mine.where((c) => ['assigned', 'in_process'].contains(c.status)).length}', NSColors.amber),
              _stat(context, lang.t('prof.stat.resolved'),
                  '${mine.where((c) => c.status == 'resolved').length}', NSColors.mint),
              _stat(context, lang.t('prof.stat.votes'),
                  '${mine.fold<int>(0, (s, c) => s + c.voteCount)}', NSColors.accent2),
            ]),
          const SizedBox(height: 20),

          if (!context.watch<AuthProvider>().isStaff) ...[
            Text(lang.t('prof.myComplaints'), style: whiteTitle(context, size: 17)),
            const SizedBox(height: 10),
            if (!loading && mine.isEmpty)
              InfoBanner(lang.t('prof.none'), color: NSColors.accent),
            ...(showAll ? mine : mine.take(5)).map((c) => ComplaintTile(
                  complaint: c,
                  onTap: () => Navigator.push(context,
                          MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: c.id)))
                      .then((_) => _load()),
                )),
            if (mine.length > 5)
              Center(
                child: TextButton(
                  onPressed: () => setState(() => showAll = !showAll),
                  child: Text(showAll
                      ? lang.t('prof.showLess')
                      : '${lang.t('prof.viewAllFull')} (${mine.length})'),
                ),
              ),
            const SizedBox(height: 12),
          ],

          Text(lang.t('prof.notifs'), style: whiteTitle(context, size: 17)),
          const SizedBox(height: 10),
          ...notifs.take(8).map((n) => Card(
                margin: const EdgeInsets.only(bottom: 10),
                child: ListTile(
                  title: Row(children: [
                    Expanded(child: Text(n.title,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontWeight: FontWeight.w700, color: s.text))),
                    Icon(Icons.chevron_right_rounded, size: 18, color: s.faint),
                  ]),
                  subtitle: Text(n.message,
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: s.sub, fontSize: 12.5)),
                  onTap: n.complaintId == null
                      ? null
                      : () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: n.complaintId!)))
                          .then((_) => _load()),
                ),
              )),

          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (!context.mounted) return;
              Navigator.pushAndRemoveUntil(context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
            },
            icon: const Icon(Icons.logout_rounded),
            label: Text(lang.t('prof.logout')),
            style: OutlinedButton.styleFrom(
              foregroundColor: NSColors.rose,
              side: BorderSide(color: NSColors.rose.withOpacity(0.4)),
              minimumSize: const Size.fromHeight(50),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String label, String value, Color color) {
    final s = Theme.of(context).extension<NSScheme>()!;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
        decoration: BoxDecoration(
          color: s.fill,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: s.line),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value, style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 20)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: s.sub, fontSize: 10, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}
