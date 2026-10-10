import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

/// LGI Billing for Mayor/Chairman and Technical Admin: subscription summary,
/// seat requests, staff registration queue, invoices with secure checkout
/// handoff (gateway opens in the external browser; the app only trusts
/// backend-verified status via polling/reconcile — never the return URL).
class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key});

  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> with SingleTickerProviderStateMixin {
  final api = ApiService();
  late TabController _tabs;
  Map<String, dynamic>? summary;
  List<dynamic> seatReqs = [];
  List<dynamic> regs = [];
  bool loading = true;
  String? error;
  String regFilter = 'pending';
  final _qty = TextEditingController(text: '5');
  final _reason = TextEditingController();
  final _regPass = TextEditingController();

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
    _load();
  }

  bool get _isMayor => context.read<AuthProvider>().user?.staffRole == 'mayor';
  bool get _isAdmin => context.read<AuthProvider>().user?.staffRole == 'admin';

  Future<bool> _confirm(String message) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: context.ns.card,
        title: Text(message, style: TextStyle(color: context.ns.text, fontSize: 15)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: Text(context.read<Lang>().t('bill.cancel'))),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(context.read<Lang>().t('bill.confirmYes'))),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final s = await api.billingSummary();
      final q = await api.seatRequests();
      final r = await api.billingRegistrations(status: regFilter);
      if (!mounted) return;
      setState(() {
        summary = s;
        seatReqs = q;
        regs = r;
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

  Future<void> _seatAction(int id, String action) async {
    final lang = context.read<Lang>();
    final questions = {
      'submit': lang.t('bill.confirmSubmit'),
      'approve': lang.t('bill.confirmApprove'),
      'cancel': lang.t('bill.confirmCancelReq'),
    };
    if (!await _confirm(questions[action] ?? lang.t('bill.confirmDefault'))) return;
    try {
      await api.seatRequestTransition(id, action);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.done')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _regAction(int id, String action) async {
    final lang = context.read<Lang>();
    final questions = {
      'verify': lang.t('bill.confirmVerify'),
      'approve': lang.t('bill.confirmApproveStaff'),
      'activate': lang.t('bill.confirmActivate'),
      'reject': lang.t('bill.confirmRejectStaff'),
    };
    if (!await _confirm(questions[action] ?? lang.t('bill.confirmDefault'))) return;
    String? password;
    if (action == 'activate') {
      password = await _askPassword();
      if (password == null || password.isEmpty) return;
    }
    try {
      await api.registrationTransition(id, action, password: password);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.done')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<String?> _askPassword() async {
    final lang = context.read<Lang>();
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
        title: Text(lang.t('bill.setPassword'), style: TextStyle(color: Theme.of(context).extension<NSScheme>()!.text, fontSize: 15)),
        content: TextField(controller: ctrl, obscureText: true, decoration: const InputDecoration(hintText: '8+ characters')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, ctrl.text.trim()), child: const Text('OK')),
        ],
      ),
    );
  }

  Future<void> _payInvoice(Map<String, dynamic> inv) async {
    final lang = context.read<Lang>();
    final total = '${inv['currency'] ?? 'BDT'} ${(((inv['total'] as num?) ?? 0) / 100).toStringAsFixed(2)}';
    if (!await _confirm(lang.t('bill.confirmPay').replaceAll('{total}', total))) return;
    try {
      final c = await api.billingCheckout(inv['invoice_id'] as int);
      final url = (c['gateway_url'] ?? '').toString();
      if (url.isEmpty) return;
      final uri = Uri.parse(url);
      final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!ok && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(lang.t('bill.cannotOpen')), backgroundColor: NSColors.amber));
        return;
      }
      if (!mounted) return;
      // After the external checkout, poll backend-verified status.
      final pid = c['payment_id'] as int;
      await _pollPayment(pid);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  Future<void> _pollPayment(int paymentId) async {
    final lang = context.read<Lang>();
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => AlertDialog(
        backgroundColor: context.ns.card,
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          const CircularProgressIndicator(color: NSColors.accent),
          const SizedBox(height: 14),
          Text(lang.t('bill.payVerifying'), style: TextStyle(color: context.ns.text)),
        ]),
      ),
    );
    String status = 'PENDING';
    for (int i = 0; i < 20; i++) {
      await Future.delayed(const Duration(seconds: 3));
      try {
        final p = await api.billingPayment(paymentId);
        status = (p['status'] ?? '').toString();
        if (['SUCCESS', 'FAILED', 'CANCELLED', 'EXPIRED', 'REFUNDED'].contains(status)) break;
      } catch (_) {}
      if (!mounted) return;
    }
    if (!mounted) return;
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(status == 'SUCCESS' ? lang.t('bill.payOk') : '${lang.t('bill.payFail')} ($status)'),
      backgroundColor: status == 'SUCCESS' ? NSColors.mint : NSColors.amber,
    ));
    _load();
  }

  Future<void> _reconcile(int paymentId) async {
    try {
      await api.billingReconcile(paymentId);
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
    // Mayor watches money + approves purchases; the Technical Admin operates
    // payments and people. Citizens and regular staff never reach this page.
    if (role != 'mayor' && role != 'admin') {
      return Scaffold(
          appBar: AppBar(title: Text(lang.t('bill.title'))),
          body: Center(child: Text(lang.t('bill.onlySub'), style: TextStyle(color: s.sub))));
    }
    final seats = summary?['seats'] as Map?;
    final sub = summary?['subscription'] as Map?;
    final invoices = (summary?['recent_invoices'] as List? ?? []).cast<Map<String, dynamic>>();

    return Scaffold(
      appBar: AppBar(
        title: Text(lang.t('bill.title')),
        bottom: TabBar(controller: _tabs, tabs: [
          Tab(text: lang.t('bill.tab.overview')),
          Tab(text: lang.t('bill.tab.staff')),
          Tab(text: lang.t('bill.tab.invoices')),
        ]),
      ),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : error != null
              ? Center(child: ErrorBanner(error!))
              : TabBarView(controller: _tabs, children: [
                  // ---- Overview ----
                  RefreshIndicator(
                    color: NSColors.accent,
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                      Row(children: [
                        _stat(context, lang.t('bill.paid'), seats?['mode'] == 'legacy' ? '∞' : '${seats?['paid'] ?? 0}', NSColors.accent),
                        _stat(context, lang.t('bill.allocated'), '${seats?['allocated'] ?? 0}', NSColors.accent2),
                      ]),
                      const SizedBox(height: 10),
                      Row(children: [
                        _stat(context, lang.t('bill.available'),
                            seats?['mode'] == 'legacy' ? lang.t('bill.unlimited') : '${seats?['available'] ?? 0}',
                            NSColors.mint),
                        _stat(context, lang.t('bill.status'), '${sub?['status'] ?? lang.t('bill.legacy')}',
                            NSColors.amber),
                      ]),
                      if (sub != null) ...[
                        const SizedBox(height: 12),
                        GlassBox(
                          padding: const EdgeInsets.all(14),
                          child: Row(children: [
                            Expanded(child: Text('${lang.t('bill.expires')}: ${(sub['expires_at'] ?? '').toString().split(' ').first}',
                                style: TextStyle(color: s.sub, fontSize: 12.5))),
                            if (_isAdmin)
                              TextButton(
                                onPressed: () async {
                                  if (!await _confirm(lang.t('bill.confirmRenew'))) return;
                                  try {
                                    await api.billingRenew(sub['subscription_id'] as int);
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                        content: Text(lang.t('bill.renewInvoiced')),
                                        backgroundColor: NSColors.mint));
                                    _load();
                                  } on ApiException catch (e) {
                                    if (!mounted) return;
                                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                        content: Text(e.message), backgroundColor: NSColors.rose));
                                  }
                                },
                                child: Text(lang.t('bill.renew')),
                              ),
                          ]),
                        ),
                      ],
                      // Buying seats is the Technical Admin's job (with the Mayor's permission).
                      if (_isAdmin) ...[
                        const SizedBox(height: 12),
                        GlassBox(
                          padding: const EdgeInsets.all(14),
                          child: Row(children: [
                            Expanded(child: TextField(
                              controller: _qty,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(hintText: lang.t('bill.reqSeats')),
                            )),
                            const SizedBox(width: 10),
                            FilledButton(
                              onPressed: () async {
                                final q = int.tryParse(_qty.text.trim()) ?? 0;
                                if (q < 1) return;
                                if (!await _confirm(lang.t('bill.confirmBuy'))) return;
                                try {
                                  await api.createSeatRequest(quantity: q, reason: _reason.text.trim());
                                  _reason.clear();
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                      content: Text(lang.t('bill.reqCreated')), backgroundColor: NSColors.mint));
                                  _load();
                                } on ApiException catch (e) {
                                  if (!mounted) return;
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                      content: Text(e.message), backgroundColor: NSColors.rose));
                                }
                              },
                              child: Text(lang.t('bill.buySeats')),
                            ),
                          ]),
                        ),
                        const SizedBox(height: 8),
                        TextField(controller: _reason, decoration: InputDecoration(hintText: lang.t('bill.reasonPh'))),
                      ],
                    ]),
                  ),
                  // ---- Registrations (Technical Admin operates people) ----
                  // ---- Seat purchase requests (admin operates, mayor approves) ----
                  RefreshIndicator(
                    color: NSColors.accent,
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                      if (_isAdmin) ...[
                        Row(children: [
                          Text(lang.t('bill.regQueue'), style: whiteTitle(context, size: 16)),
                      const Spacer(),
                      DropdownButton<String>(
                        value: regFilter,
                        underline: const SizedBox(),
                        style: TextStyle(color: NSColors.accent, fontSize: 12, fontWeight: FontWeight.w700),
                        items: ['pending', 'verified', 'approved', 'all']
                            .map((v) => DropdownMenuItem(value: v, child: Text(lang.t('bill.reg.$v'))))
                            .toList(),
                        onChanged: (v) => setState(() { regFilter = v!; _load(); }),
                      ),
                    ]),
                    const SizedBox(height: 10),
                    if (regs.isEmpty)
                      InfoBanner(lang.t('bill.regEmpty'), color: NSColors.accent),
                    ...regs.map((r) {
                        final m = (r as Map).cast<String, dynamic>();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('${m['full_name']} · ${m['email']}',
                                  style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
                              const SizedBox(height: 3),
                              Text('${m['staff_role_requested']} · ${m['status']}',
                                  style: TextStyle(color: s.faint, fontSize: 11.5)),
                              const SizedBox(height: 8),
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                if (m['status'] == 'pending')
                                  OutlinedButton(onPressed: () => _regAction(m['reg_id'] as int, 'verify'),
                                      child: Text(lang.t('bill.verify'), style: const TextStyle(fontSize: 11.5))),
                                if (m['status'] == 'verified')
                                  FilledButton(onPressed: () => _regAction(m['reg_id'] as int, 'approve'),
                                      style: FilledButton.styleFrom(minimumSize: const Size(0, 36)),
                                      child: Text(lang.t('bill.approve'), style: const TextStyle(fontSize: 11.5))),
                                if (m['status'] == 'approved')
                                  FilledButton(onPressed: () => _regAction(m['reg_id'] as int, 'activate'),
                                      style: FilledButton.styleFrom(minimumSize: const Size(0, 36)),
                                      child: Text(lang.t('bill.activate'), style: const TextStyle(fontSize: 11.5))),
                                if (['pending', 'verified', 'approved'].contains(m['status']))
                                  TextButton(onPressed: () => _regAction(m['reg_id'] as int, 'reject'),
                                      child: Text(lang.t('bill.reject'),
                                          style: const TextStyle(fontSize: 11.5, color: NSColors.rose))),
                              ]),
                            ]),
                          ),
                        );
                      }),
                      ], // end admin-only registrations
                      const SizedBox(height: 16),
                      Text(lang.t('bill.seatReqs'), style: whiteTitle(context, size: 16)),
                      const SizedBox(height: 10),
                      if (seatReqs.isEmpty) InfoBanner(lang.t('bill.noSeatReqs'), color: NSColors.accent),
                      ...seatReqs.map((r) {
                        final m = (r as Map).cast<String, dynamic>();
                        return Card(
                          margin: const EdgeInsets.only(bottom: 10),
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text('+${m['quantity']} ${lang.t('bill.seats')} · ${m['status']}',
                                  style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 13.5)),
                              if ((m['reason'] ?? '').toString().isNotEmpty)
                                Text(m['reason'].toString(), style: TextStyle(color: s.faint, fontSize: 11.5)),
                              const SizedBox(height: 8),
                              Wrap(spacing: 8, runSpacing: 8, children: [
                                if (['REQUESTED', 'EMPLOYEE_VERIFICATION_PENDING'].contains(m['status']) && _isAdmin)
                                  OutlinedButton(onPressed: () => _seatAction(m['request_id'] as int, 'submit'),
                                      child: Text(lang.t('bill.submitApproval'), style: const TextStyle(fontSize: 11.5))),
                                if (m['status'] == 'AWAITING_FINANCIAL_APPROVAL' && _isMayor)
                                  FilledButton(onPressed: () => _seatAction(m['request_id'] as int, 'approve'),
                                      style: FilledButton.styleFrom(minimumSize: const Size(0, 36)),
                                      child: Text(lang.t('bill.approvePay'), style: const TextStyle(fontSize: 11.5))),
                                if (['REQUESTED', 'AWAITING_FINANCIAL_APPROVAL'].contains(m['status']) && _isAdmin)
                                  TextButton(onPressed: () => _seatAction(m['request_id'] as int, 'cancel'),
                                      child: Text(lang.t('bill.cancel'),
                                          style: const TextStyle(fontSize: 11.5, color: NSColors.rose))),
                              ]),
                            ]),
                          ),
                        );
                      }),
                    ]),
                  ),
                  // ---- Invoices ----
                  RefreshIndicator(
                    color: NSColors.accent,
                    onRefresh: _load,
                    child: ListView(padding: const EdgeInsets.fromLTRB(18, 12, 18, 40), children: [
                      if (invoices.isEmpty) InfoBanner(lang.t('bill.noInvoices'), color: NSColors.accent),
                      ...invoices.map((inv) => Card(
                            margin: const EdgeInsets.only(bottom: 10),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                InkWell(
                                  onTap: () => _showInvoiceDetail(inv),
                                  child: Row(children: [
                                    Expanded(child: Text('${inv['invoice_no']}',
                                        style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 14))),
                                    StatusPill(inv['status']?.toString() ?? ''),
                                    const SizedBox(width: 4),
                                    Icon(Icons.chevron_right_rounded, size: 18, color: s.faint),
                                  ]),
                                ),
                                const SizedBox(height: 4),
                                Text('${inv['currency'] ?? 'BDT'} ${(((inv['total'] as num?) ?? 0) / 100).toStringAsFixed(2)} · ${inv['type'] ?? ''}',
                                    style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 15)),
                                if (_isAdmin) ...[
                                  const SizedBox(height: 8),
                                  Wrap(spacing: 8, runSpacing: 8, children: [
                                    if (['issued', 'pending', 'failed'].contains(inv['status']))
                                      FilledButton.icon(
                                        onPressed: () => _payInvoice(inv),
                                        style: FilledButton.styleFrom(minimumSize: const Size(0, 38)),
                                        icon: const Icon(Icons.payment_rounded, size: 16),
                                        label: Text(lang.t('bill.pay'), style: const TextStyle(fontSize: 12)),
                                      ),
                                    if (['issued', 'pending', 'failed'].contains(inv['status']))
                                      OutlinedButton.icon(
                                        onPressed: () => _receiptSheet(inv),
                                        style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                                        icon: const Icon(Icons.receipt_long_rounded, size: 16),
                                        label: Text(lang.t('bill.bankReceipt'), style: const TextStyle(fontSize: 12)),
                                      ),
                                    OutlinedButton(
                                      onPressed: () => _reconcileByInvoice(inv),
                                      style: OutlinedButton.styleFrom(minimumSize: const Size(0, 38)),
                                      child: Text(lang.t('bill.checkStatus'), style: const TextStyle(fontSize: 12)),
                                    ),
                                  ]),
                                ],
                              ]),
                            ),
                          )),
                    ]),
                  ),
                ]),
    );
  }

  /// Bank / mobile-banking (bKash, Nagad, Rocket demo) receipt upload.
  Future<void> _receiptSheet(Map<String, dynamic> inv) async {
    final lang = context.read<Lang>();
    final s = context.ns;
    final ref = TextEditingController();
    final sender = TextEditingController();
    String method = 'bank';
    File? image;
    final picker = ImagePicker();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: s.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetCtx) => StatefulBuilder(
        builder: (sheetCtx, setSheet) => Padding(
          padding: EdgeInsets.fromLTRB(22, 22, 22, MediaQuery.of(sheetCtx).viewInsets.bottom + 22),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${lang.t('bill.bankReceipt')} · ${inv['invoice_no']}',
                style: TextStyle(color: s.text, fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 14),
            DropdownButtonFormField<String>(
              value: method,
              decoration: InputDecoration(hintText: lang.t('bill.payMethod')),
              items: const [
                DropdownMenuItem(value: 'bank', child: Text('🏦 Bank transfer')),
                DropdownMenuItem(value: 'bkash', child: Text('📱 bKash (demo)')),
                DropdownMenuItem(value: 'nagad', child: Text('📱 Nagad (demo)')),
                DropdownMenuItem(value: 'rocket', child: Text('📱 Rocket (demo)')),
              ],
              onChanged: (v) => setSheet(() => method = v!),
            ),
            const SizedBox(height: 10),
            TextField(controller: sender,
                decoration: InputDecoration(hintText: lang.t('bill.senderPh'))),
            const SizedBox(height: 10),
            TextField(controller: ref, decoration: InputDecoration(hintText: lang.t('bill.receiptRefPh'))),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () async {
                final x = await picker.pickImage(source: ImageSource.gallery, imageQuality: 70, maxWidth: 1600);
                if (x != null) setSheet(() => image = File(x.path));
              },
              icon: const Icon(Icons.photo_library_rounded, size: 16),
              label: Text(image != null ? lang.t('bill.photoAttached') : lang.t('bill.attachReceipt'),
                  style: const TextStyle(fontSize: 12)),
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () => Navigator.pop(sheetCtx, true),
              child: Text(lang.t('bill.submitReceipt')),
            ),
          ]),
        ),
      ),
    );
    if (ok != true) return;
    if (ref.text.trim().isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.receiptNeeded')), backgroundColor: NSColors.amber));
      return;
    }
    if (!await _confirm(lang.t('bill.confirmReceipt'))) return;
    try {
      await api.uploadReceipt(
        invoiceId: inv['invoice_id'] as int,
        reference: ref.text.trim(),
        method: method,
        senderAccount: sender.text.trim(),
        image: image,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(lang.t('bill.receiptDone')), backgroundColor: NSColors.mint));
      _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  /// Full payment/transaction details for an invoice (mayor's watch view).
  Future<void> _showInvoiceDetail(Map<String, dynamic> inv) async {
    final lang = context.read<Lang>();
    final s = context.ns;
    Map<String, dynamic>? detail;
    try {
      detail = await api.invoiceDetail(inv['invoice_id'] as int);
    } catch (_) {}
    if (!mounted) return;
    final lines = ((detail?['invoice'] as Map?)?['lines'] as List? ?? []).cast<Map<String, dynamic>>();
    final pays = (detail?['payments'] as List? ?? []).cast<Map<String, dynamic>>();
    final dInv = (detail?['invoice'] as Map?) ?? inv;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: s.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => FractionallySizedBox(
        heightFactor: 0.85,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(22, 18, 22, 22),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${dInv['invoice_no'] ?? ''}',
                  style: TextStyle(color: s.text, fontWeight: FontWeight.w900, fontSize: 18))),
              StatusPill('${dInv['status'] ?? ''}'),
            ]),
            const SizedBox(height: 4),
            Text('${dInv['currency'] ?? 'BDT'} ${(((dInv['total'] as num?) ?? 0) / 100).toStringAsFixed(2)} · ${dInv['type'] ?? ''}',
                style: const TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 16)),
            const SizedBox(height: 14),
            Expanded(
              child: ListView(children: [
                Text(lang.t('bill.desc'), style: TextStyle(color: s.faint, fontSize: 11, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                ...lines.map((l) => Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Row(children: [
                        Expanded(child: Text('${l['label'] ?? ''}',
                            style: TextStyle(color: s.sub, fontSize: 12.5))),
                        Text('${dInv['currency'] ?? ''} ${(((l['amount'] as num?) ?? 0) / 100).toStringAsFixed(2)}',
                            style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 12.5)),
                      ]),
                    )),
                const SizedBox(height: 12),
                Text(lang.t('bill.payments'), style: TextStyle(color: s.faint, fontSize: 11, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                if (pays.isEmpty)
                  Text(lang.t('bill.noPayments'), style: TextStyle(color: s.faint, fontSize: 12)),
                ...pays.map((p) => Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                          color: s.fill, borderRadius: BorderRadius.circular(10), border: Border.all(color: s.line)),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text('${p['txn_id'] ?? ''}',
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                              style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 12))),
                          StatusPill('${p['status'] ?? ''}'),
                        ]),
                        const SizedBox(height: 3),
                        Text('${p['gateway'] ?? ''} · ${p['currency'] ?? ''} ${(((p['amount'] as num?) ?? 0) / 100).toStringAsFixed(2)}${p['gateway_txn_id'] != null ? ' · ${p['gateway_txn_id']}' : ''}',
                            style: TextStyle(color: s.sub, fontSize: 11.5)),
                      ]),
                    )),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  Future<void> _reconcileByInvoice(Map<String, dynamic> inv) async {    try {
      final d = await api.invoiceDetail(inv['invoice_id'] as int);
      final pays = (d['payments'] as List? ?? []).cast<Map<String, dynamic>>();
      if (pays.isEmpty) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(context.read<Lang>().t('bill.noPayments')), backgroundColor: NSColors.amber));
        return;
      }
      await api.billingReconcile(pays.first['payment_id'] as int);
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

  Widget _stat(BuildContext context, String label, String value, Color color) {
    final s = context.ns;
    return Expanded(
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
        decoration: BoxDecoration(
            color: s.fill, borderRadius: BorderRadius.circular(14), border: Border.all(color: s.line)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(value,
              maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 20)),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(color: s.sub, fontSize: 10.5, fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }

  @override
  void dispose() {
    _tabs.dispose();
    _qty.dispose();
    _reason.dispose();
    _regPass.dispose();
    super.dispose();
  }
}

class StatusPill extends StatelessWidget {
  final String status;
  const StatusPill(this.status, {super.key});
  @override
  Widget build(BuildContext context) {
    final c = status == 'paid' || status == 'SUCCESS'
        ? NSColors.mint
        : status == 'failed' || status == 'FAILED'
            ? NSColors.rose
            : NSColors.amber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
          color: c.withOpacity(0.14),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: c.withOpacity(0.4))),
      child: Text(status, style: TextStyle(color: c, fontSize: 10.5, fontWeight: FontWeight.w800)),
    );
  }
}
