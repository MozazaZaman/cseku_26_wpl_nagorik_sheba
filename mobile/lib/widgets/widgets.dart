import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../config.dart';
import '../i18n.dart';
import '../theme.dart';

/// Loads a server-hosted image ("/uploads/x.jpg") with a themed placeholder
/// and a graceful fallback box when the file is missing.
class NetImage extends StatelessWidget {
  final String? relativeUrl;
  final double? width;
  final double? height;
  final BoxFit fit;
  final double radius;

  const NetImage(this.relativeUrl,
      {super.key, this.width, this.height, this.fit = BoxFit.cover, this.radius = 14});

  @override
  Widget build(BuildContext context) {
    final s = Theme.of(context).extension<NSScheme>()!;
    final url = assetUrl(relativeUrl);
    if (url == null) {
      return Container(
        width: width,
        height: height,
        decoration: BoxDecoration(color: s.fill, borderRadius: BorderRadius.circular(radius)),
        child: Center(child: Icon(Icons.image_not_supported_outlined, color: s.faint, size: 26)),
      );
    }
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Image.network(
        url,
        width: width,
        height: height,
        fit: fit,
        loadingBuilder: (_, child, progress) {
          if (progress == null) return child;
          return Container(
            width: width,
            height: height,
            color: s.fill,
            child: Center(
              child: CircularProgressIndicator(
                strokeWidth: 2,
                value: progress.expectedTotalBytes != null
                    ? progress.cumulativeBytesLoaded / progress.expectedTotalBytes!
                    : null,
                color: NSColors.accent,
              ),
            ),
          );
        },
        errorBuilder: (_, __, ___) => Container(
          width: width,
          height: height,
          color: s.fill,
          child: Center(child: Icon(Icons.broken_image_outlined, color: s.faint, size: 26)),
        ),
      ),
    );
  }
}

class AppLogo extends StatelessWidget {
  final double size;
  final double radius;
  const AppLogo({super.key, this.size = 48, this.radius = 12});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: Image.asset('assets/images/logo.png', width: size, height: size, fit: BoxFit.cover),
    );
  }
}

class GlassBox extends StatelessWidget {
  final Widget child;
  final EdgeInsets padding;
  const GlassBox({super.key, required this.child, this.padding = const EdgeInsets.all(22)});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding,
      decoration: glassDecoration(context),
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

TextStyle whiteTitle(BuildContext context, {double size = 22}) => TextStyle(
      color: Theme.of(context).extension<NSScheme>()!.text,
      fontSize: size,
      fontWeight: FontWeight.w800,
      height: 1.2,
    );

class StatusChip extends StatelessWidget {
  final String status;
  const StatusChip(this.status, {super.key});

  static const colors = {
    'submitted': Color(0xFF38BDF8),
    'verified': Color(0xFF38BDF8),
    'junior_review': Color(0xFF38BDF8),
    'senior_review': Color(0xFFA78BFA),
    'mayor_review': Color(0xFFA78BFA),
    'approved': NSColors.mint,
    'wit_review': NSColors.mint,
    'assigned': NSColors.amber,
    'in_process': NSColors.amber,
    'resolved': NSColors.mint,
    'rejected': NSColors.rose,
    'merged': Color(0xFF94A3B8),
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
      child: Text(label, style: TextStyle(color: c, fontSize: 11, fontWeight: FontWeight.w700)),
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
    final s = Theme.of(context).extension<NSScheme>()!;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: s.fill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: s.line),
      ),
      child: Text(
        '${icons[category] ?? '📌'} ${lang.t('cat.$category')}',
        style: TextStyle(color: s.sub, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: .3),
      ),
    );
  }
}

class ComplaintTile extends StatelessWidget {
  final dynamic complaint; // Complaint
  final VoidCallback? onTap;
  final VoidCallback? onVote;
  final bool voted;

  const ComplaintTile({super.key, required this.complaint, this.onTap, this.onVote, this.voted = false});

  @override
  Widget build(BuildContext context) {
    final c = complaint;
    final s = Theme.of(context).extension<NSScheme>()!;
    final canVote = onVote != null && !['assigned', 'in_process', 'resolved', 'rejected', 'merged'].contains(c.status);
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
                  if (onVote != null)
                    GestureDetector(
                      onTap: canVote ? onVote : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: (voted ? NSColors.mint : NSColors.accent).withOpacity(0.14),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                              color: (voted ? NSColors.mint : NSColors.accent).withOpacity(0.4)),
                        ),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Icon(voted ? Icons.check_rounded : Icons.arrow_upward_rounded,
                              size: 13, color: voted ? NSColors.mint : NSColors.accent),
                          const SizedBox(width: 3),
                          Text('${c.voteCount}',
                              style: TextStyle(
                                  color: voted ? NSColors.mint : NSColors.accent,
                                  fontWeight: FontWeight.w800,
                                  fontSize: 12)),
                        ]),
                      ),
                    )
                  else
                    Text('▲ ${c.voteCount}',
                        style: const TextStyle(
                            color: NSColors.accent, fontWeight: FontWeight.w800, fontSize: 13)),
                ],
              ),
              const SizedBox(height: 10),
              Text('#${c.id} · ${c.title}',
                  maxLines: 1, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: s.text, fontWeight: FontWeight.w700, fontSize: 15)),
              const SizedBox(height: 4),
              Text(c.description, maxLines: 2, overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: s.sub, fontSize: 12.5)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      [c.fullAddress ?? c.addressText ?? '', c.authorityName ?? '']
                          .where((x) => x.isNotEmpty)
                          .join(' · '),
                      maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: s.faint, fontSize: 11.5),
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
