import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

/// LGI Staff Administration for the Technical Admin (and the Mayor).
/// People management only: create accounts, assign roles/departments,
/// reset passwords, deactivate leavers. No money moves here.
class StaffAdminScreen extends StatefulWidget {
  const StaffAdminScreen({super.key});

  @override
  State<StaffAdminScreen> createState() => _StaffAdminScreenState();
}

class _StaffAdminScreenState extends State<StaffAdminScreen> {
  final api = ApiService();
  List<dynamic> staff = [];
  Map<String, dynamic>? seats;
  bool loading = true;
  String? error;
  bool showInactive = false;
  String dept = 'all';

  final _name = TextEditingController();
  final _email = TextEditingController();
  final _pass = TextEditingController();
  final _deptNew = TextEditingController(text: 'general');
  String _roleNew = 'junior';
  bool creating = false;

  static const roles = ['junior', 'senior', 'mayor', 'wit', 'field', 'admin'];

  @override
  void initState() {
    super.initState();
    _load();
  }

  String get _myRole => context.read<AuthProvider>().user?.staffRole ?? '';
  bool get _isMayor => _myRole == 'mayor';

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final s = await api.billingStaffDirectory();
      final sum = await api.billingSummary();
      if (!mounted) return;
      setState(() {
        staff = s;
        seats = (sum['seats'] as Map?)?.cast<String, dynamic>();
        loading = false;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() {
        error = e.message;
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() {
        error = 'Network error';
        loading = false;
      });
    }
  }

  bool _canTouch(Map<String, dynamic> m) {
    if (!_isMayor && m['staff_role'] == 'mayor') return false;
    return true;
  }

  List<String> get _creatableRoles =>
      _isMayor ? roles : roles.where((r) => r != 'mayor' && r != 'admin').toList();

  Future<void> _create() async {
    final lang = context.read<Lang>();
    if (_name.text.trim().isEmpty || !_email.text.contains('@') || _pass.text.length < 8) {
      setState(() => error = lang.t('sadmin.invalidForm'));
      return;
    }
    setState(() {
      creating = true;
      error = null;
    });
    try {
      await api.createStaffAccount(
        name: _name.text.trim(), email: _email.text.trim(), password: _pass.text,
        role: _roleNew, department: _deptNew.text.trim().isEmpty ? 'general' : _deptNew.text.trim(),
      );
      _name.clear();
      _email.clear();
      _pass.clear();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('sadmin.created')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => creating = false);
    }
  }

  Future<void> _changeRole(Map<String, dynamic> m, String role) async {
    try {
      await api.updateStaffAccount(m['staff_id'] as int, role: role);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<Lang>().t('bill.done')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _resetPw(Map<String, dynamic> m) async {
    final lang = context.read<Lang>();
    final ctrl = TextEditingController();
    final pw = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: context.ns.card,
        title: Text(lang.t('sadmin.newPass'), style: TextStyle(color: context.ns.text, fontSize: 15)),
        content: TextField(controller: ctrl, obscureText: true, decoration: const InputDecoration(hintText: '8+ characters')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text.trim()), child: const Text('OK')),
        ],
      ),
    );
    if (pw == null || pw.length < 8) return;
    try {
      await api.resetStaffPassword(m['staff_id'] as int, pw);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.done')), backgroundColor: NSColors.mint));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _toggleActive(Map<String, dynamic> m) async {
    final active = (m['is_active'] as int) == 1;
    try {
      await api.setStaffActive(m['staff_id'] as int, !active);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(context.read<Lang>().t('bill.done')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = context.ns;
    final role = context.watch<AuthProvider>().user?.staffRole ?? '';
    if (role != 'admin') {
      return Scaffold(
          appBar: AppBar(title: Text(lang.t('sadmin.title'))),
          body: Center(child: Text(lang.t('sadmin.onlySub'), style: TextStyle(color: s.sub))));
    }
    final depts = {for (final x in staff) ((x as Map)['department'] ?? 'general').toString()};
    final visible = staff.where((x) {
      final m = (x as Map).cast<String, dynamic>();
      if (!showInactive && (m['is_active'] as int) != 1) return false;
      if (dept != 'all' && (m['department'] ?? 'general') != dept) return false;
      return true;
    }).toList();

    return Scaffold(
      appBar: AppBar(title: Text(lang.t('sadmin.title'))),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : RefreshIndicator(
              color: NSColors.accent,
              onRefresh: _load,
              child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                if (error != null) ...[ErrorBanner(error!), const SizedBox(height: 12)],
                if (seats != null)
                  InfoBanner(
                      '${lang.t('bill.available')}: ${seats!['mode'] == 'legacy' ? lang.t('bill.unlimited') : '${seats!['available']} / ${seats!['paid']}'}',
                      color: NSColors.accent),
                const SizedBox(height: 16),
                Text(lang.t('sadmin.create'), style: whiteTitle(context, size: 16)),
                const SizedBox(height: 10),
                GlassBox(
                  padding: const EdgeInsets.all(14),
                  child: Column(children: [
                    TextField(controller: _name, decoration: InputDecoration(hintText: lang.t('reg.name'))),
                    const SizedBox(height: 10),
                    TextField(controller: _email,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(hintText: lang.t('reg.email'))),
                    const SizedBox(height: 10),
                    TextField(controller: _pass,
                        obscureText: true, decoration: InputDecoration(hintText: lang.t('sadmin.tempPass'))),
                    const SizedBox(height: 10),
                    Row(children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _roleNew,
                          decoration: InputDecoration(hintText: lang.t('bill.reqRole')),
                          items: _creatableRoles
                              .map((r) => DropdownMenuItem(value: r, child: Text(r, style: const TextStyle(fontSize: 13))))
                              .toList(),
                          onChanged: (v) => setState(() => _roleNew = v!),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(controller: _deptNew,
                            decoration: InputDecoration(hintText: lang.t('sadmin.department'))),
                      ),
                    ]),
                    const SizedBox(height: 12),
                    FilledButton(
                      onPressed: creating ? null : _create,
                      child: creating
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                          : Text(lang.t('sadmin.createBtn')),
                    ),
                  ]),
                ),
                const SizedBox(height: 20),
                Row(children: [
                  Text(lang.t('sadmin.directory'), style: whiteTitle(context, size: 16)),
                  const Spacer(),
                  DropdownButton<String>(
                    value: dept,
                    underline: const SizedBox(),
                    style: TextStyle(color: NSColors.accent, fontSize: 12, fontWeight: FontWeight.w700),
                    items: [
                      DropdownMenuItem(value: 'all', child: Text(lang.t('sadmin.allDepts'))),
                      ...depts.map((d) => DropdownMenuItem(value: d, child: Text(d))),
                    ],
                    onChanged: (v) => setState(() => dept = v!),
                  ),
                  TextButton(
                    onPressed: () => setState(() => showInactive = !showInactive),
                    child: Text(lang.t('sadmin.showInactive'), style: const TextStyle(fontSize: 11.5)),
                  ),
                ]),
                const SizedBox(height: 10),
                ...visible.map((x) {
                  final m = (x as Map).cast<String, dynamic>();
                  final active = (m['is_active'] as int) == 1;
                  return Opacity(
                    opacity: active ? 1 : 0.55,
                    child: Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${m['full_name']}',
                              style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 14)),
                          Text('${m['email']} · ${m['staff_role']} · ${m['department'] ?? 'general'}${active ? '' : ' · ' + lang.t('sadmin.inactive')}',
                              style: TextStyle(color: s.faint, fontSize: 11.5)),
                          if (_canTouch(m)) ...[
                            const SizedBox(height: 8),
                            Wrap(spacing: 8, runSpacing: 8, children: [
                              DropdownButton<String>(
                                value: (m['staff_role'] ?? 'junior').toString(),
                                underline: const SizedBox(),
                                style: TextStyle(color: NSColors.accent, fontSize: 12, fontWeight: FontWeight.w700),
                                items: _creatableRoles
                                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                                    .toList(),
                                onChanged: (v) => _changeRole(m, v!),
                              ),
                              OutlinedButton(
                                  onPressed: () => _resetPw(m),
                                  style: OutlinedButton.styleFrom(minimumSize: const Size(0, 34)),
                                  child: Text(lang.t('sadmin.resetPw'), style: const TextStyle(fontSize: 11.5))),
                              TextButton(
                                  onPressed: () => _toggleActive(m),
                                  child: Text(
                                      active ? lang.t('sadmin.deactivate') : lang.t('sadmin.reactivate'),
                                      style: TextStyle(
                                          fontSize: 11.5,
                                          color: active ? NSColors.rose : NSColors.mint))),
                            ]),
                          ],
                        ]),
                      ),
                    ),
                  );
                }),
              ]),
            ),
    );
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _pass.dispose();
    _deptNew.dispose();
    super.dispose();
  }
}
