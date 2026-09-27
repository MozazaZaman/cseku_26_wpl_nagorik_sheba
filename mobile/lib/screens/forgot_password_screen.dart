import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final api = ApiService();
  final _email = TextEditingController();
  final _otp = TextEditingController();
  final _pass = TextEditingController();
  int step = 0;
  bool busy = false;
  bool _showPass = false;
  String? error;
  String? info;
  String? resetToken;

  Future<void> _next() async {
    final lang = context.read<Lang>();
    setState(() { busy = true; error = null; info = null; });
    try {
      if (step == 0) {
        if (!_email.text.trim().contains('@')) {
          setState(() { error = lang.t('fp.email'); busy = false; });
          return;
        }
        await api.forgotPassword(_email.text.trim());
        if (!mounted) return;
        setState(() { step = 1; info = lang.t('fp.sent'); });
      } else if (step == 1) {
        if (_otp.text.trim().length != 6) {
          setState(() { error = lang.t('fp.mismatch'); busy = false; });
          return;
        }
        final token = await api.verifyOtp(_email.text.trim(), _otp.text.trim());
        if (!mounted) return;
        if (token.isEmpty) {
          setState(() { error = lang.t('fp.mismatch'); busy = false; });
          return;
        }
        setState(() { resetToken = token; step = 2; });
      } else {
        if (_pass.text.length < 6) {
          setState(() { error = lang.t('reg.err.pass'); busy = false; });
          return;
        }
        await api.resetPassword(resetToken!, _pass.text);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(lang.t('fp.done')), backgroundColor: NSColors.mint));
        Navigator.pop(context);
      }
    } on ApiException catch (e) {
      setState(() { error = e.message; });
    } catch (_) {
      setState(() { error = context.read<Lang>().t('fp.err'); });
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Scaffold(
      appBar: AppBar(title: Text(lang.t('fp.title'))),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: GlassBox(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(children: List.generate(3, (i) {
                    return Expanded(
                      child: Container(
                        height: 4,
                        margin: EdgeInsets.only(right: i < 2 ? 6 : 0),
                        decoration: BoxDecoration(
                          gradient: i <= step ? NSGradient.box : null,
                          color: i <= step ? null : Theme.of(context).extension<NSScheme>()!.line,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                    );
                  })),
                  const SizedBox(height: 16),
                  Text(
                    step == 0 ? lang.t('fp.sub') : step == 1 ? lang.t('fp.otpHint') : lang.t('fp.newPass'),
                    style: whiteTitle(context, size: 16),
                  ),
                  const SizedBox(height: 18),
                  if (step == 0)
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      decoration: InputDecoration(hintText: lang.t('fp.email')),
                    ),
                  if (step == 1) ...[
                    TextField(
                      controller: _otp,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      decoration: InputDecoration(hintText: lang.t('fp.otp')),
                    ),
                  ],
                  if (step == 2)
                    TextField(
                      controller: _pass,
                      obscureText: !_showPass,
                      decoration: InputDecoration(
                        hintText: lang.t('fp.newPass'),
                        suffixIcon: IconButton(
                          icon: Icon(_showPass ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                              color: Theme.of(context).extension<NSScheme>()!.faint, size: 19),
                          onPressed: () => setState(() => _showPass = !_showPass),
                        ),
                      ),
                    ),
                  if (info != null) ...[
                    const SizedBox(height: 12),
                    InfoBanner(info!, color: NSColors.mint),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 12),
                    ErrorBanner(error!),
                  ],
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: busy ? null : _next,
                    child: busy
                        ? const SizedBox(height: 22, width: 22, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                        : Text(step == 0 ? lang.t('fp.send') : step == 1 ? lang.t('fp.verify') : lang.t('fp.reset')),
                  ),
                  if (step > 0 && !busy)
                    TextButton(
                      onPressed: () => setState(() { step -= 1; error = null; }),
                      child: Text(lang.t('reg.back')),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
