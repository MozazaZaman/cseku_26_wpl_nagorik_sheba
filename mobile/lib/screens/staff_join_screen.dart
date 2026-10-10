import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

/// Public staff join request — creates a pending registration, grants nothing.
/// The LGI admin verifies, the mayor approves, a free license activates.
class StaffJoinScreen extends StatefulWidget {
  const StaffJoinScreen({super.key});

  @override
  State<StaffJoinScreen> createState() => _StaffJoinScreenState();
}

class _StaffJoinScreenState extends State<StaffJoinScreen> {
  final api = ApiService();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _empRef = TextEditingController();
  List<Map<String, dynamic>> divisions = [];
  List<dynamic> authorities = [];
  String? division;
  String? district;
  int? authorityId;
  String role = 'junior';
  bool busy = false;
  String? error;
  bool done = false;

  static const roles = ['junior', 'senior', 'mayor', 'wit', 'field'];

  @override
  void initState() {
    super.initState();
    api.divisions().then((d) {
      if (mounted) setState(() => divisions = d);
    }).catchError((_) {});
  }

  Future<void> _loadAuthorities() async {
    if (district == null) return;
    try {
      final list = await api.authorities(district: district);
      if (mounted) setState(() => authorities = list);
    } catch (_) {}
  }

  Future<void> _submit() async {
    final lang = context.read<Lang>();
    if (authorityId == null || _name.text.trim().isEmpty || !_email.text.contains('@')) {
      setState(() => error = lang.t('bill.joinInvalid'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await api.staffJoinRequest(
        authorityId: authorityId!,
        name: _name.text.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim(),
        role: role,
        employeeRef: _empRef.text.trim(),
      );
      if (!mounted) return;
      setState(() {
        busy = false;
        done = true;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() {
        busy = false;
        error = e.message;
      });
    } catch (_) {
      if (mounted) setState(() {
        busy = false;
        error = lang.t('sub.err.network');
      });
    }
  }

  InputDecoration _dec(String hint) => InputDecoration(hintText: hint);

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = context.ns;
    return Scaffold(
      appBar: AppBar(title: Text(lang.t('bill.joinTitle'))),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 40),
        child: done
            ? GlassBox(
                child: Column(children: [
                  const Icon(Icons.mark_email_read_rounded, size: 52, color: NSColors.mint),
                  const SizedBox(height: 14),
                  Text(lang.t('bill.joinDone'),
                      textAlign: TextAlign.center,
                      style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 16)),
                  const SizedBox(height: 18),
                  FilledButton(
                      onPressed: () => Navigator.pop(context), child: Text(lang.t('res.tryAgain'))),
                ]),
              )
            : GlassBox(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Text(lang.t('bill.joinSub'), style: TextStyle(color: s.sub, fontSize: 13)),
                  const SizedBox(height: 16),
                  DropdownButtonFormField<String>(
                    value: division,
                    decoration: _dec(lang.t('sub.division')),
                    items: divisions
                        .map((d) => DropdownMenuItem(value: d['name'] as String, child: Text(d['name'] as String)))
                        .toList(),
                    onChanged: (v) => setState(() {
                      division = v;
                      district = null;
                      authorityId = null;
                      authorities = [];
                    }),
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: district,
                    decoration: _dec(lang.t('sub.district')),
                    items: (() {
                      final match = divisions.where((d) => d['name'] == division);
                      if (match.isEmpty) return <DropdownMenuItem<String>>[];
                      return (match.first['districts'] as List)
                          .cast<String>()
                          .map((d) => DropdownMenuItem(value: d, child: Text(d)))
                          .toList();
                    })(),
                    onChanged: division == null
                        ? null
                        : (v) {
                            setState(() {
                              district = v;
                              authorityId = null;
                            });
                            _loadAuthorities();
                          },
                  ),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<int>(
                    value: authorityId,
                    decoration: _dec(lang.t('bill.organization')),
                    items: authorities
                        .map((a) => DropdownMenuItem(
                            value: a['authority_id'] as int,
                            child: Text(a['name'] as String, overflow: TextOverflow.ellipsis)))
                        .toList(),
                    onChanged: district == null ? null : (v) => setState(() => authorityId = v),
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _name, decoration: _dec(lang.t('reg.name'))),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: _dec(lang.t('reg.email'))),
                  const SizedBox(height: 10),
                  TextField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      decoration: _dec(lang.t('reg.phone'))),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: role,
                    decoration: _dec(lang.t('bill.reqRole')),
                    items: roles.map((r) => DropdownMenuItem(value: r, child: Text(r))).toList(),
                    onChanged: (v) => setState(() => role = v!),
                  ),
                  const SizedBox(height: 10),
                  TextField(controller: _empRef, decoration: _dec(lang.t('bill.empRef'))),
                  if (error != null) ...[const SizedBox(height: 12), ErrorBanner(error!)],
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: busy ? null : _submit,
                    child: busy
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(lang.t('bill.submitJoin')),
                  ),
                ]),
              ),
      ),
    );
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _phone.dispose();
    _empRef.dispose();
    super.dispose();
  }
}
