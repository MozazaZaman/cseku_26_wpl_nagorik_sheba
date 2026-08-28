import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../i18n.dart';
import '../theme.dart';

class GlassBox extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const GlassBox({super.key, required this.child, this.padding = const EdgeInsets.all(22)});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: glassDecoration(),
      child: child,
    );
  }
}

class ErrorBanner extends StatelessWidget {
  final String text;
  const ErrorBanner(this.text, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: NSColors.rose.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: NSColors.rose.withOpacity(0.35)),
      ),
      child: Text(text, style: TextStyle(color: NSColors.rose, fontSize: 13)),
    );
  }
}

class InfoBanner extends StatelessWidget {
  final String text;
  final Color color;
  const InfoBanner(this.text, {super.key, this.color = NSColors.amber});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.35)),
      ),
      child: Text(text, style: TextStyle(color: color, fontSize: 13, fontWeight: FontWeight.w600)),
    );
  }
}

TextStyle whiteTitle({double size = 22}) => TextStyle(
      color: Colors.white,
      fontSize: size,
      fontWeight: FontWeight.w800,
      height: 1.2,
    );

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});

  static const colors = {
    'submitted': Color(0xFF38BDF8),
    'verified': Color(0xFFA78BFA),
    'in_process': NSColors.amber,
    'resolved': NSColors.mint,
    'rejected': NSColors.rose,
    'merged': Colors.white24,
  };

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    final c = colors[status] ?? colors['submitted']!;
    final label = lang.t('st.$status');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: c.withOpacity(0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: c.withOpacity(0.4)),
      ),
      child: Text(label,
          style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}

class CategoryChip extends StatelessWidget {
  final String category;
  const CategoryChip(this.category, {super.key});

  static const icons = {
    'road': '🛣️',
    'electricity': '⚡',
    'water': '💧',
    'gas': '🔥',
    'sanitation': '🧹',
    'other': '📌',
  };

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Colors.white12),
      ),
      child: Text(
        '${icons[category] ?? '📌'} ${lang.t('cat.$category')}',
        style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: .3),
      ),
    );
  }
}

class ComplaintTile extends StatelessWidget {
  final dynamic complaint; // Complaint
  final VoidCallback? onTap;

  const ComplaintTile({super.key, required this.complaint, this.onTap});

  @override
  Widget build(BuildContext context) {
    final c = complaint;
    return GestureDetector(
      onTap: onTap,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CategoryChip(c.category),
                  const SizedBox(width: 8),
                  StatusChip(c.status),
                  const Spacer(),
                  Text('▲ ${c.voteCount}',
                      style: TextStyle(color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 13)),
                ],
              ),
              const SizedBox(height: 10),
              Text('#${c.id} · ${c.title}',
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 4),
              Text(c.description, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: Colors.white38, fontSize: 12.5)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      [c.fullAddress ?? c.addressText ?? '', c.authorityName ?? '']
                          .where((s) => s.isNotEmpty)
                          .join(' · '),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: Colors.white24, fontSize: 11.5),
                    ),
                  ),
                  if (c.status == 'in_process' && c.etaHours != null)
                    Text('ETA ${c.etaHours}h',
                        style: TextStyle(color: NSColors.amber, fontSize: 11.5, fontWeight: FontWeight.w700)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
