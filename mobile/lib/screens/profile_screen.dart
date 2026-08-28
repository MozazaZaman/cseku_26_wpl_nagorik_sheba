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
    if (user == null) {
      return Center(child: Text(lang.t('prof.notLoggedIn'), style: TextStyle(color: Colors.white38)));
    }

    return SafeArea(
      child: ListView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 90),
        children: [
          GlassBox(
            child: Row(children: [
              CircleAvatar(
                radius: 28,
                backgroundColor: NSColors.accent.withOpacity(0.25),
                child: Text(user.name.isNotEmpty ? user.name[0].toUpperCase() : '?',
                    style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 22)),
              ),
              SizedBox(width: 14),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(user.name, style: whiteTitle(size: 18)),
                Text(user.email, style: TextStyle(color: Colors.white38, fontSize: 12.5)),
                if (user.authorityName != null)
                  Padding(padding: EdgeInsets.only(top: 4),
                      child: Text('${user.authorityName} · ${lang.t('prof.general')}',
                          style: TextStyle(color: NSColors.mint, fontSize: 11.5))),
              ])),
            ]),
          ),
          SizedBox(height: 14),

          // Language toggle row
          GlassBox(
            child: Row(children: [
              Icon(Icons.translate_rounded, color: NSColors.accent2),
              SizedBox(width: 12),
              Expanded(child: Text(lang.t('lang.row'),
                  style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 14))),
              TextButton(
                onPressed: () => lang.toggle(),
                child: Text(lang.toggleLabel(),
                    style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 12.5)),
              ),
            ]),
          ),
          SizedBox(height: 20),

          if (!context.watch<AuthProvider>().isStaff) ...[
            Text(lang.t('prof.myComplaints'), style: whiteTitle(size: 17)),
            SizedBox(height: 10),
            if (!loading && mine.isEmpty)
              InfoBanner(lang.t('prof.none'), color: NSColors.accent),
            ...mine.take(5).map((c) => ComplaintTile(
                  complaint: c,
                  onTap: () => Navigator.push(context,
                          MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: c.id)))
                      .then((_) => _load()),
                )),
            if (mine.length > 5)
              Center(child: TextButton(onPressed: () {}, child: Text('${lang.t('prof.viewAll')}${mine.length})'))),
            SizedBox(height: 12),
          ],

          Text(lang.t('prof.notifs'), style: whiteTitle(size: 17)),
          SizedBox(height: 10),
          ...notifs.take(8).map((n) => Card(
                margin: EdgeInsets.only(bottom: 10),
                child: ListTile(
                  title: Row(children: [
                    Expanded(child: Text(n.title,
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white))),
                    Icon(Icons.chevron_right_rounded, size: 18, color: Colors.white24),
                  ]),
                  subtitle: Text(n.message,
                      maxLines: 2, overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white38, fontSize: 12.5)),
                  onTap: n.complaintId == null
                      ? null
                      : () => Navigator.push(context,
                              MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: n.complaintId!)))
                          .then((_) => _load()),
                ),
              )),

          SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: () async {
              await context.read<AuthProvider>().logout();
              if (!context.mounted) return;
              Navigator.pushAndRemoveUntil(context,
                  MaterialPageRoute(builder: (_) => const LoginScreen()), (_) => false);
            },
            icon: Icon(Icons.logout_rounded),
            label: Text(lang.t('prof.logout')),
            style: OutlinedButton.styleFrom(
              foregroundColor: NSColors.rose,
              side: BorderSide(color: NSColors.rose.withOpacity(0.4)),
              minimumSize: Size.fromHeight(50),
            ),
          ),
        ],
      ),
    );
  }
}
