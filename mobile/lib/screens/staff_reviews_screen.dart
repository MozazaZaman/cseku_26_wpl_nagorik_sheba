import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_service.dart';
import '../auth_provider.dart';
import '../i18n.dart';
import '../theme.dart';
import '../widgets/widgets.dart';
import 'complaint_detail_screen.dart';

/// Mayor-only: aggregate satisfaction + every citizen review of resolved work.
/// Mirrors the web app's PublicReviews page.
class StaffReviewsScreen extends StatefulWidget {
  const StaffReviewsScreen({super.key});

  @override
  State<StaffReviewsScreen> createState() => _StaffReviewsScreenState();
}

class _StaffReviewsScreenState extends State<StaffReviewsScreen> {
  final api = ApiService();
  List<dynamic> reviews = [];
  int totalResolved = 0;
  int ratedCount = 0;
  double? avg;
  Map<int, int> breakdown = {};
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => loading = true);
    try {
      final r = await api.staffReviews();
      if (!mounted) return;
      setState(() {
        reviews = r['reviews'] as List? ?? [];
        totalResolved = r['total_resolved'] ?? 0;
        ratedCount = r['rated_count'] ?? 0;
        avg = (r['avg_satisfaction'] as num?)?.toDouble();
        breakdown = ((r['breakpoint'] ?? r['breakdown']) as Map?)?.cast<int, int>() ?? {};
        loading = false;
      });
    } catch (_) {
      if (mounted) setState(() => loading = false);
    }
  }

  static const _emojis = {1: '😡', 2: '😕', 3: '😐', 4: '🙂', 5: '🤩'};

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final s = Theme.of(context).extension<NSScheme>()!;
    final isMayor = context.read<AuthProvider>().user?.staffRole == 'mayor';

    if (!isMayor) {
      return Scaffold(appBar: AppBar(title: Text(lang.t('reviews.title'))), body: Center(child: Text(lang.t('prof.notLoggedIn'))));
    }

    return Scaffold(
      appBar: AppBar(title: Text(lang.t('reviews.title'))),
      body: loading
          ? Center(child: CircularProgressIndicator(color: NSColors.accent))
          : RefreshIndicator(
              color: NSColors.accent,
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(18, 8, 18, 40),
                children: [
                  // ---- Aggregate ----
                  GlassBox(
                    child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
                      Column(children: [
                        Text(avg != null ? avg!.toStringAsFixed(1) : '—',
                            style: TextStyle(color: NSColors.amber, fontSize: 40, fontWeight: FontWeight.w900)),
                        Text('★', style: TextStyle(color: NSColors.amber, fontSize: 16)),
                      ]),
                      const SizedBox(width: 18),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(lang.t('reviews.avg'),
                            style: TextStyle(color: s.sub, fontSize: 12.5, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        Text('$ratedCount ${lang.t('reviews.rated')} · $totalResolved ${lang.t('reviews.resolved')}',
                            style: TextStyle(color: s.faint, fontSize: 12)),
                        const SizedBox(height: 10),
                        ...[5, 4, 3, 2, 1].map((star) {
                          final count = breakdown[star] ?? 0;
                          final pct = ratedCount > 0 ? count / ratedCount : 0.0;
                          return Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(children: [
                              Text('${_emojis[star]} $star', style: const TextStyle(fontSize: 11, color: NSColors.amber)),
                              const SizedBox(width: 8),
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(4),
                                  child: LinearProgressIndicator(
                                    value: pct,
                                    minHeight: 7,
                                    backgroundColor: s.fill,
                                    color: NSColors.amber.withOpacity(0.7),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              SizedBox(width: 22, child: Text('$count', style: TextStyle(color: s.faint, fontSize: 11))),
                            ]),
                          );
                        }),
                      ])),
                    ]),
                  ),
                  const SizedBox(height: 20),
                  Text(lang.t('reviews.title'), style: whiteTitle(context, size: 17)),
                  const SizedBox(height: 12),
                  if (reviews.isEmpty)
                    Center(child: Padding(padding: const EdgeInsets.only(top: 20), child: Text(lang.t('reviews.empty'), style: TextStyle(color: s.faint))))
                  else
                    ...reviews.map((r) {
                      final score = r['satisfaction_score'];
                      final comment = r['satisfaction_comment'];
                      return GlassBox(
                        padding: const EdgeInsets.all(16),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            StatusChip(r['status'] ?? 'resolved'),
                            const Spacer(),
                            if (score != null)
                              Text('${_emojis[score]} $score★',
                                  style: const TextStyle(color: NSColors.amber, fontWeight: FontWeight.w800, fontSize: 14))
                            else
                              Text(lang.t('reviews.unrated'), style: TextStyle(color: s.faint, fontSize: 11.5)),
                          ]),
                          const SizedBox(height: 10),
                          GestureDetector(
                            onTap: () => Navigator.push(context,
                                MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: r['complaint_id']))),
                            child: Text('#${r['complaint_id']} · ${r['title']}',
                                maxLines: 2, overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 14.5)),
                          ),
                          const SizedBox(height: 6),
                          if (comment != null && comment.toString().isNotEmpty)
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: s.fill,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(color: s.line),
                              ),
                              child: Text('“$comment”', style: TextStyle(color: s.sub, fontSize: 12.5, height: 1.5)),
                            )
                          else if (score != null)
                            Text(lang.t('reviews.noComment'), style: TextStyle(color: s.faint, fontSize: 11.5, fontStyle: FontStyle.italic)),
                        ]),
                      );
                    }),
                ],
              ),
            ),
    );
  }
}
