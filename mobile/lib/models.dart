class User {
  final int id;
  final String role;
  final String name;
  final String email;
  final String? department;
  final int? authorityId;
  final String? authorityName;
  final String? staffRole;
  final bool isSystemAdmin;

  User({
    required this.id,
    required this.role,
    required this.name,
    required this.email,
    this.department,
    this.authorityId,
    this.authorityName,
    this.staffRole,
    this.isSystemAdmin = false,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'],
        role: j['role'] ?? 'citizen',
        name: j['name'] ?? '',
        email: j['email'] ?? '',
        department: j['department'],
        authorityId: j['authority_id'],
        authorityName: j['authority_name'],
        staffRole: j['staff_role'],
        isSystemAdmin: j['is_system_admin'] == true,
      );
}

class Complaint {
  final int id;
  final int userId;
  final String title;
  final String description;
  final String category;
  final String status;
  final double priorityScore;
  final int voteCount;
  final int? etaHours;
  final double latitude;
  final double longitude;
  final String? addressText;
  final String? fullAddress;
  final String? imageUrl;
  final String? resolutionImageUrl;
  final String? submitterName;
  final String? authorityName;
  final String? authorityType;
  final int? authorityId;
  final String? staffName;
  final String createdAt;
  final String? currentStage;
  final String? stageOwnerRole;
  final String? executorName;
  final String? rejectedAtStage;
  final String? slaDeadline;
  final bool overdue;
  final String? division;
  final String? district;
  final bool votedByMe;
  final bool isMine;
  final int? satisfactionScore;
  final String? satisfactionComment;

  Complaint({
    required this.id,
    required this.userId,
    required this.title,
    required this.description,
    required this.category,
    required this.status,
    required this.priorityScore,
    required this.voteCount,
    required this.latitude,
    required this.longitude,
    required this.createdAt,
    this.etaHours,
    this.addressText,
    this.fullAddress,
    this.imageUrl,
    this.resolutionImageUrl,
    this.submitterName,
    this.authorityName,
    this.authorityType,
    this.authorityId,
    this.staffName,
    this.currentStage,
    this.stageOwnerRole,
    this.executorName,
    this.rejectedAtStage,
    this.slaDeadline,
    this.overdue = false,
    this.division,
    this.district,
    this.votedByMe = false,
    this.isMine = false,
    this.satisfactionScore,
    this.satisfactionComment,
  });

  factory Complaint.fromJson(Map<String, dynamic> j) => Complaint(
        id: j['complaint_id'],
        userId: j['user_id'],
        title: j['title'] ?? '',
        description: j['description'] ?? '',
        category: j['category'] ?? 'other',
        status: j['status'] ?? 'submitted',
        priorityScore: (j['priority_score'] as num?)?.toDouble() ?? 0,
        voteCount: j['vote_count'] ?? 0,
        etaHours: j['eta_hours'],
        latitude: (j['latitude'] as num).toDouble(),
        longitude: (j['longitude'] as num).toDouble(),
        addressText: j['address_text'],
        fullAddress: j['full_address'],
        imageUrl: j['image_url'],
        resolutionImageUrl: j['resolution_image_url'],
        submitterName: j['submitter_name'],
        authorityName: j['authority_name'],
        authorityType: j['authority_type'],
        authorityId: j['authority_id'],
        staffName: j['staff_name'],
        createdAt: j['created_at'] ?? '',
        currentStage: j['current_stage'],
        stageOwnerRole: j['stage_owner_role'],
        executorName: j['executor_name'],
        rejectedAtStage: j['rejected_at_stage'],
        slaDeadline: j['sla_deadline'],
        overdue: j['overdue_flag'] == 1 || j['overdue_flag'] == true,
        division: j['division'],
        district: j['district'],
        votedByMe: j['voted_by_me'] == true,
        isMine: j['is_mine'] == true,
        satisfactionScore: j['satisfaction_score'] is int ? j['satisfaction_score'] : (j['satisfaction_score'] as num?)?.toInt(),
        satisfactionComment: j['satisfaction_comment']?.toString(),
      );

  static const statusLabels = {
    'submitted': 'Submitted',
    'verified': 'New · Junior Check',
    'junior_review': 'Junior Check',
    'senior_review': 'Senior Feasibility',
    'mayor_review': 'Mayor Permission',
    'approved': 'Mayor Approved',
    'wit_review': 'WIT Inspection',
    'assigned': 'Team Assigned',
    'in_process': 'In Process',
    'resolved': 'Resolved',
    'rejected': 'Rejected',
    'merged': 'Merged as Vote',
  };
}

class WorkflowStep {
  final String stage;
  final String action;
  final String actorName;
  final String actorRole;
  final String? comment;
  final String createdAt;

  WorkflowStep({
    required this.stage,
    required this.action,
    required this.actorName,
    required this.actorRole,
    required this.createdAt,
    this.comment,
  });

  factory WorkflowStep.fromJson(Map<String, dynamic> j) => WorkflowStep(
        stage: j['stage'] ?? '',
        action: j['action'] ?? '',
        actorName: j['actor_name'] ?? '',
        actorRole: j['actor_role'] ?? 'system',
        comment: j['comment'],
        createdAt: j['created_at'] ?? '',
      );
}

class ServiceItem {
  final int id;
  final String name;
  final String type;
  final String phone;
  final String? address;
  final double lat;
  final double lng;
  final int distanceM;

  ServiceItem({
    required this.id,
    required this.name,
    required this.type,
    required this.phone,
    required this.lat,
    required this.lng,
    required this.distanceM,
    this.address,
  });

  factory ServiceItem.fromJson(Map<String, dynamic> j) => ServiceItem(
        id: j['service_id'],
        name: j['name'],
        type: j['type'],
        phone: j['phone'],
        address: j['address'],
        lat: (j['latitude'] as num).toDouble(),
        lng: (j['longitude'] as num).toDouble(),
        distanceM: (j['distance_m'] as num?)?.toInt() ?? 0,
      );

  static const typeIcons = {
    'fire_service': '🚒',
    'police_station': '🚓',
    'wasa': '🚰',
    'lged': '🏗️',
    'desa': '💡',
    'titas_gas': '🔥',
    'public_toilet': '🚻',
  };
}

class HistoryItem {
  final String oldStatus;
  final String newStatus;
  final String? note;
  final String changedBy;
  final String changedAt;

  HistoryItem({
    required this.oldStatus,
    required this.newStatus,
    required this.changedBy,
    required this.changedAt,
    this.note,
  });

  factory HistoryItem.fromJson(Map<String, dynamic> j) => HistoryItem(
        oldStatus: j['old_status'] ?? '',
        newStatus: j['new_status'],
        note: j['note'],
        changedBy: j['changed_by'] ?? '',
        changedAt: j['changed_at'] ?? '',
      );
}

class AgentLogItem {
  final String agentName;
  final String decision;
  final String? output;

  AgentLogItem({required this.agentName, required this.decision, this.output});

  factory AgentLogItem.fromJson(Map<String, dynamic> j) => AgentLogItem(
        agentName: j['agent_name'],
        decision: j['decision'],
        output: j['output_summary'],
      );

  static const prettyNames = {
    'agent_1_photo_verifier': 'Agent 01 · Photo Verifier',
    'agent_2_classifier': 'Agent 02 · Classifier',
    'agent_3_duplicate_checker': 'Agent 03 · Duplicate Checker',
    'agent_4_priority_ranker': 'Agent 04 · Priority Ranker',
    'agent_5_destination_router': 'Agent 05 · Router',
  };
}

class NotificationItem {
  final int id;
  final String title;
  final String message;
  final int? complaintId;
  final String createdAt;
  final bool isRead;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.createdAt,
    this.complaintId,
    this.isRead = false,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['notification_id'],
        title: j['title'],
        message: j['message'],
        complaintId: j['complaint_id'],
        createdAt: j['created_at'] ?? '',
        isRead: j['is_read'] == 1 || j['is_read'] == true,
      );
}

/// Compact duplicate report (merged into another complaint as a vote).
class DuplicateReport {
  final int id;
  final String title;
  final String createdAt;

  DuplicateReport({required this.id, required this.title, required this.createdAt});

  factory DuplicateReport.fromJson(Map<String, dynamic> j) => DuplicateReport(
        id: j['complaint_id'],
        title: j['title'] ?? '',
        createdAt: j['created_at'] ?? '',
      );
}

/// SLA helpers — the server stores UTC deadlines as "YYYY-MM-DD HH:MM:SS".
DateTime? parseSlaDeadline(String? raw) {
  if (raw == null || raw.isEmpty) return null;
  return DateTime.tryParse('${raw.trim().replaceFirst(' ', 'T')}Z');
}

String slaRemainingLabel(String? raw) {
  final d = parseSlaDeadline(raw);
  if (d == null) return '';
  final diff = d.difference(DateTime.now());
  if (diff.isNegative) {
    final overdue = -diff;
    final days = overdue.inDays;
    return days > 0
        ? 'Overdue by ${days}d'
        : 'Overdue by ${overdue.inHours}h';
  }
  final days = diff.inDays;
  if (days > 0) return '${days}d ${diff.inHours % 24}h left';
  return '${diff.inHours}h ${diff.inMinutes % 60}m left';
}

/// "2h ago" / "3d ago" style relative timestamps.
String relativeTime(String? raw) {
  if (raw == null || raw.isEmpty) return '';
  final d = DateTime.tryParse('${raw.trim().replaceFirst(' ', 'T')}Z');
  if (d == null) return '';
  final diff = DateTime.now().difference(d);
  if (diff.isNegative) return 'just now';
  if (diff.inMinutes < 1) return 'just now';
  if (diff.inHours < 1) return '${diff.inMinutes}m ago';
  if (diff.inDays < 1) return '${diff.inHours}h ago';
  if (diff.inDays < 30) return '${diff.inDays}d ago';
  return '${(diff.inDays / 30).floor()}mo ago';
}

class Badge {
  final int id;
  final String type;
  final String? tier;
  final String label;
  final String awardedAt;
  final bool isMilestone;

  Badge({
    required this.id,
    required this.type,
    required this.label,
    required this.awardedAt,
    this.tier,
    this.isMilestone = false,
  });

  factory Badge.fromJson(Map<String, dynamic> j) => Badge(
        id: j['badge_id'] ?? 0,
        type: (j['badge_type'] ?? '').toString(),
        label: (j['label'] ?? j['badge_type'] ?? '').toString(),
        awardedAt: (j['awarded_at'] ?? '').toString(),
        tier: j['tier']?.toString(),
        isMilestone: j['tier'] == null,
      );

  static const tierIcons = {'gold': '🥇', 'silver': '🥈', 'bronze': '🥉'};
  static const typeIcons = {
    'volume': '📈', 'satisfaction': '😊', 'sla': '⏱️',
    'accuracy': '🎯', 'specialist': '🧠', 'first10': '🌱', 'century': '💯', 'veteran': '🎖️',
  };
}

class Recognition {
  final int id;
  final String note;
  final String awardedAt;
  final String? awardedByName;

  Recognition({required this.id, required this.note, required this.awardedAt, this.awardedByName});

  factory Recognition.fromJson(Map<String, dynamic> j) => Recognition(
        id: j['recognition_id'] ?? 0,
        note: (j['note'] ?? '').toString(),
        awardedAt: (j['awarded_at'] ?? '').toString(),
        awardedByName: j['awarded_by_name']?.toString(),
      );
}

class LeaderboardEntry {
  final int authorityId;
  final String name;
  final String type;
  final String? district;
  final String? division;
  final int total;
  final int resolved;
  final double resolutionRate;
  final double? avgDays;
  final double? avgSatisfaction;
  final double? score;

  LeaderboardEntry({
    required this.authorityId,
    required this.name,
    required this.type,
    this.district,
    this.division,
    required this.total,
    required this.resolved,
    required this.resolutionRate,
    this.avgDays,
    this.avgSatisfaction,
    this.score,
  });

  factory LeaderboardEntry.fromJson(Map<String, dynamic> j) => LeaderboardEntry(
        authorityId: j['authority_id'] ?? 0,
        name: (j['name'] ?? '').toString(),
        type: (j['type'] ?? '').toString(),
        district: j['district']?.toString(),
        division: j['division']?.toString(),
        total: j['total_complaints'] ?? 0,
        resolved: j['resolved'] ?? 0,
        resolutionRate: (j['resolution_rate'] as num?)?.toDouble() ?? 0,
        avgDays: (j['avg_resolution_days'] as num?)?.toDouble(),
        avgSatisfaction: (j['avg_satisfaction'] as num?)?.toDouble(),
        score: (j['score'] as num?)?.toDouble(),
      );
}
