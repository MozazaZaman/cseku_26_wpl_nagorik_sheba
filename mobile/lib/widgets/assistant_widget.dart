import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import 'widgets.dart';

/// Floating Nagorik Assistant — mirrors the web app's AssistantWidget.
/// Visible for logged-in citizens only (same scope rule as the web app).
class AssistantWidget extends StatelessWidget {
  const AssistantWidget({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isCitizen = auth.user?.role == 'citizen';
    if (!isCitizen) return const SizedBox.shrink();

    return FloatingActionButton(
      heroTag: 'assistant',
      backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
      elevation: 4,
      onPressed: () => showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        builder: (_) => const _AssistantChat(),
      ),
      child: const Text('🤖', style: TextStyle(fontSize: 24)),
    );
  }
}

class _AssistantChat extends StatefulWidget {
  const _AssistantChat();

  @override
  State<_AssistantChat> createState() => _AssistantChatState();
}

class _AssistantChatState extends State<_AssistantChat> {
  final api = ApiService();
  final _input = TextEditingController();
  final _scroll = ScrollController();
  final List<Map<String, String>> _messages = [];
  bool busy = false;

  @override
  void initState() {
    super.initState();
    final lang = context.read<Lang>();
    _messages.add({
      'role': 'assistant',
      'text': lang.isBn
          ? 'আসসালামু আলাইকুম! আমি নাগরিক অ্যাসিস্ট্যান্ট 🤖 অভিযোগ জমা দেওয়া, ভোট দেওয়া বা স্ট্যাটাস জানতে সাহায্য করতে পারি।'
          : 'Hello! I\'m the Nagorik Assistant 🤖 Ask me about reporting an issue, voting, or complaint statuses.',
    });
  }

  Future<void> _send() async {
    final lang = context.read<Lang>();
    final text = _input.text.trim();
    if (text.isEmpty || busy) return;
    setState(() {
      _messages.add({'role': 'user', 'text': text});
      busy = true;
    });
    _input.clear();
    _scrollToBottom();

    try {
      final history = _messages
          .map((m) => {'role': m['role'], 'content': m['text']})
          .toList();
      final reply = await api.assistantChat(text, history: history);
      if (!mounted) return;
      setState(() {
        _messages.add({'role': 'assistant', 'text': reply.isEmpty ? lang.t('asst.err') : reply});
        busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _messages.add({'role': 'assistant', 'text': lang.t('asst.err')});
        busy = false;
      });
    }
    _scrollToBottom();
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.animateTo(_scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250), curve: Curves.easeOut);
    });
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    return FractionallySizedBox(
      heightFactor: 0.85,
      child: Column(children: [
        // Header
        Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: s.line)),
          ),
          child: Row(children: [
            const Text('🤖', style: TextStyle(fontSize: 24)),
            const SizedBox(width: 10),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(lang.t('asst.title'), style: whiteTitle(context, size: 16.5)),
              Text(lang.t('asst.hint'), style: TextStyle(color: s.faint, fontSize: 11.5)),
            ])),
            IconButton(
              icon: Icon(Icons.close_rounded, color: s.sub),
              onPressed: () => Navigator.pop(context),
            ),
          ]),
        ),
        // Messages
        Expanded(
          child: ListView.builder(
            controller: _scroll,
            padding: const EdgeInsets.all(16),
            itemCount: _messages.length,
            itemBuilder: (_, i) {
              final m = _messages[i];
              final isUser = m['role'] == 'user';
              return Align(
                alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  decoration: BoxDecoration(
                    color: isUser ? NSColors.accent : s.fill,
                    borderRadius: BorderRadius.only(
                      topLeft: const Radius.circular(16),
                      topRight: const Radius.circular(16),
                      bottomLeft: Radius.circular(isUser ? 16 : 4),
                      bottomRight: Radius.circular(isUser ? 4 : 16),
                    ),
                    border: isUser ? null : Border.all(color: s.line),
                  ),
                  child: Text(m['text']!,
                      style: TextStyle(
                          color: isUser ? Colors.white : s.text, fontSize: 13.5, height: 1.45)),
                ),
              );
            },
          ),
        ),
        if (busy)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.more_horiz_rounded, color: s.faint),
              const SizedBox(width: 8),
              Text(lang.t('asst.sending'), style: TextStyle(color: s.faint, fontSize: 12)),
            ]),
          ),
        // Suggestions
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            'How do I report an issue?',
            'How does voting work?',
            'Track my complaints',
            'What do the agents do?',
          ].map((q) => Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ActionChip(
              label: Text(q, style: const TextStyle(fontSize: 11.5)),
              onPressed: () { _input.text = q; _send(); },
            ),
          )).toList()),
        ),
        // Input
        Padding(
          padding: EdgeInsets.fromLTRB(12, 8, 12, MediaQuery.of(context).viewInsets.bottom + 12),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _input,
                minLines: 1,
                maxLines: 4,
                onSubmitted: (_) => _send(),
                decoration: InputDecoration(
                  hintText: lang.t('asst.placeholder'),
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
              ),
            ),
            const SizedBox(width: 8),
            IconButton.filled(
              icon: const Icon(Icons.send_rounded, size: 18),
              onPressed: busy ? null : _send,
            ),
          ]),
        ),
      ]),
    );
  }
}
