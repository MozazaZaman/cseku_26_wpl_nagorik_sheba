import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets/widgets.dart';

class ComplaintDetailScreen extends StatefulWidget {
  final int id;
  const ComplaintDetailScreen({super.key, required this.id});

  @override
  State<ComplaintDetailScreen> createState() => _ComplaintDetailScreenState();
}

class _ComplaintDetailScreenState extends State<ComplaintDetailScreen> {
  final api = ApiService();
  bool loading = true;
  String? error;
  Complaint? c;
  List<HistoryItem> history = [];
  List<AgentLogItem> agents = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final d = await api.complaintDetail(widget.id);
      if (!mounted) return;
      setState(() {
        c = d['complaint'];
        history = d['history'];
        agents = d['agents'];
        loading = false;
      });
    } catch (e) {
      setState(() {
        error = 'Could not load complaint';
        loading = false;
      });
    }
  }

  Future<void> _vote() async {
    final lang = context.read<Lang>();
    if (c == null) return;
    if (c!.status == 'in_process') {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(lang.t('exp.voted.locked')),
          backgroundColor: NSColors.amber));
      return;
    }
    try {
      await api.vote(c!.id);
      _load();
    } on ApiException catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.message), backgroundColor: NSColors.rose));
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Scaffold(
      appBar: AppBar(title: Text('${lang.t('res.ticket')}${widget.id}')),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : error != null
              ? Center(child: ErrorBanner(error!))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            CategoryChip(c!.category),
                            SizedBox(width: 8),
                            StatusChip(c!.status),
                            Spacer(),
                            Text('▲ ${c!.voteCount}',
                                style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 16)),
                          ]),
                          SizedBox(height: 12),
                          Text(c!.title,
                              style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
                          SizedBox(height: 6),
                          Text(c!.description,
                              style: TextStyle(color: Colors.white54, fontSize: 13.5, height: 1.5)),
                          if (c!.status == 'in_process') ...[
                            SizedBox(height: 12),
                            InfoBanner('${lang.t('det.locked')}'
                                '${c!.etaHours != null ? " · ${lang.t('det.eta')}${c!.etaHours}h" : ""}'),
                          ],
                          if (c!.status == 'resolved') ...[
                            SizedBox(height: 12),
                            InfoBanner(lang.t('det.resolvedDone'), color: NSColors.mint),
                          ],
                          if (!c!.isMine && ['submitted', 'verified'].contains(c!.status)) ...[
                            SizedBox(height: 14),
                            SizedBox(
                              width: double.infinity,
                              child: FilledButton.icon(
                                onPressed: c!.votedByMe ? null : _vote,
                                icon: Icon(c!.votedByMe ? Icons.check_rounded : Icons.how_to_vote_rounded),
                                label: Text(c!.votedByMe ? lang.t('exp.voted') : lang.t('exp.upvote')),
                              ),
                            ),
                          ],
                        ]),
                      ),
                    ),
                    SizedBox(height: 16),

                    GlassBox(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(lang.t('det.agents'),
                            style: whiteTitle(size: 16)),
                        SizedBox(height: 4),
                        Text(lang.t('det.agentsSub'),
                            style: TextStyle(color: Colors.white24, fontSize: 11.5)),
                        SizedBox(height: 12),
                        ...agents.map((a) => Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.03),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(color: Colors.white10)),
                              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('🤖', style: TextStyle(fontSize: 15)),
                                SizedBox(width: 10),
                                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Text(AgentLogItem.prettyNames[a.agentName] ?? a.agentName,
                                      style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w700, fontSize: 12.5)),
                                  if (a.output != null)
                                    Padding(padding: EdgeInsets.only(top: 3),
                                        child: Text(a.output!,
                                            style: TextStyle(color: Colors.white38, fontSize: 11.5))),
                                ])),
                              ]),
                            )),
                        if (agents.isEmpty)
                          Text(lang.t('det.noAgents'),
                              style: TextStyle(color: Colors.white24, fontSize: 12.5)),
                      ]),
                    ),
                    SizedBox(height: 16),

                    if (history.isNotEmpty)
                      GlassBox(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(lang.t('det.timeline'), style: whiteTitle(size: 16)),
                          SizedBox(height: 14),
                          ...history.map((h) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                  Column(children: [
                                    Container(
                                      margin: EdgeInsets.only(top: 4),
                                      width: 10, height: 10,
                                      decoration: BoxDecoration(gradient: NSGradient.box, shape: BoxShape.circle),
                                    ),
                                    Container(width: 1.5, height: 26, color: Colors.white10),
                                  ]),
                                  SizedBox(width: 12),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text('${h.oldStatus.isEmpty ? "—" : h.oldStatus} → ${h.newStatus.replaceAll("_", " ")}',
                                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13.5)),
                                    if (h.note != null && h.note!.isNotEmpty)
                                      Text(h.note!, style: TextStyle(color: Colors.white38, fontSize: 12)),
                                    Text(h.changedBy, style: TextStyle(color: Colors.white24, fontSize: 11)),
                                  ])),
                                ]),
                              )),
                        ]),
                      ),
                  ]),
                ),
    );
  }
}
