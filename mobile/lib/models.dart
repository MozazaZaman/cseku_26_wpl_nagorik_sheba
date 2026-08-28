class User {
  final int id;
  final String role;
  final String name;
  final String email;
  final String? department;
  final int? authorityId;
  final String? authorityName;

  User({
    required this.id,
    required this.role,
    required this.name,
    required this.email,
    this.department,
    this.authorityId,
    this.authorityName,
  });

  factory User.fromJson(Map<String, dynamic> j) => User(
        id: j['id'],
        role: j['role'] ?? 'citizen',
        name: j['name'] ?? '',
        email: j['email'] ?? '',
        department: j['department'],
        authorityId: j['authority_id'],
        authorityName: j['authority_name'],
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
  final String? submitterName;
  final String? authorityName;
  final String? staffName;
  final String createdAt;
  final bool votedByMe;
  final bool isMine;

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
    this.imageUrl,
    this.submitterName,
    this.authorityName,
    this.staffName,
    this.votedByMe = false,
    this.isMine = false,
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
        submitterName: j['submitter_name'],
        authorityName: j['authority_name'],
        staffName: j['staff_name'],
        createdAt: j['created_at'] ?? '',
        votedByMe: j['voted_by_me'] == true,
        isMine: j['is_mine'] == true,
      );

  static const statusLabels = {
    'submitted': 'Submitted',
    'verified': 'Sent',
    'in_process': 'In Process',
    'resolved': 'Resolved',
    'rejected': 'Rejected',
    'merged': 'Merged as Vote',
  };
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

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.createdAt,
    this.complaintId,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['notification_id'],
        title: j['title'],
        message: j['message'],
        complaintId: j['complaint_id'],
        createdAt: j['created_at'] ?? '',
      );
}
