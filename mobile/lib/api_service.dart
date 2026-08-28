import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import 'config.dart';
import 'models.dart';

class ApiException implements Exception {
  final int? statusCode;
  final Map<String, dynamic> body;
  ApiException(this.statusCode, this.body);

  String get message => (body['alert'] ?? body['error'] ?? 'Something went wrong').toString();
}

class ApiService {
  String? _token;

  Future<String?> loadToken() async {
    final p = await SharedPreferences.getInstance();
    _token = p.getString('ns_token');
    return _token;
  }

  Future<void> saveToken(String t) async {
    _token = t;
    final p = await SharedPreferences.getInstance();
    await p.setString('ns_token', t);
  }

  Future<void> clearToken() async {
    _token = null;
    final p = await SharedPreferences.getInstance();
    await p.remove('ns_token');
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  dynamic _decode(http.Response r) {
    try {
      return jsonDecode(utf8.decode(r.bodyBytes));
    } catch (_) {
      return {};
    }
  }

  dynamic _check(http.Response r) {
    final b = _decode(r);
    if (r.statusCode >= 400) throw ApiException(r.statusCode, b is Map ? b : {});
    return b;
  }

  dynamic rawGet(String path) async {
    return _check(await http.get(Uri.parse('$kApiBase$path'), headers: _headers));
  }

  // ---------- Auth ----------
  Future<User> registerWithFace({
    required String name,
    required String email,
    required String phone,
    required String password,
    required File selfie,
    required File idPhoto,
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$kApiBase/auth/register'))
      ..fields['full_name'] = name
      ..fields['email'] = email
      ..fields['phone'] = phone
      ..fields['password'] = password
      ..files.add(await http.MultipartFile.fromPath('selfie', selfie.path))
      ..files.add(await http.MultipartFile.fromPath('id_photo', idPhoto.path));
    final streamed = await req.send();
    final r = await http.Response.fromStream(streamed);
    final b = _decode(r);
    if (r.statusCode == 422) {
      throw ApiException(422, b is Map ? b : {'error': 'Face verification failed'});
    }
    if (r.statusCode >= 400) throw ApiException(r.statusCode, b is Map ? b : {});
    await saveToken(b['token']);
    return User.fromJson(b['user']);
  }

  Future<User> register(String name, String email, String phone, String password) async {
    final r = await http.post(Uri.parse('$kApiBase/auth/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'full_name': name,
          'email': email,
          'phone': phone,
          'password': password,
        }));
    final b = _check(r);
    await saveToken(b['token']);
    return User.fromJson(b['user']);
  }

  Future<User> login(String email, String password) async {
    final r = await http.post(Uri.parse('$kApiBase/auth/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'email': email, 'password': password}));
    final b = _check(r);
    await saveToken(b['token']);
    return User.fromJson(b['user']);
  }

  Future<List<Complaint>> complaints({String? q, String? category, String? status}) async {
    final params = <String, String>{};
    if (q != null && q.isNotEmpty) params['q'] = q;
    if (category != null && category != 'all') params['category'] = category;
    if (status != null && status != 'all') params['status'] = status;
    final uri = Uri.parse('$kApiBase/complaints').replace(queryParameters: params);
    final b = _check(await http.get(uri, headers: _headers));
    return (b['complaints'] as List).map((e) => Complaint.fromJson(e)).toList();
  }

  Future<List<Complaint>> myComplaints() async {
    final b = _check(await http.get(Uri.parse('$kApiBase/complaints/mine'), headers: _headers));
    return (b['complaints'] as List).map((e) => Complaint.fromJson(e)).toList();
  }

  Future<Map<String, dynamic>> complaintDetail(int id) async {
    final b = _check(await http.get(Uri.parse('$kApiBase/complaints/$id'), headers: _headers));
    return {
      'complaint': Complaint.fromJson(b['complaint']),
      'history': (b['history'] as List).map(HistoryItem.fromJson).toList(),
      'agents': (b['agents'] as List).map(AgentLogItem.fromJson).toList(),
    };
  }

  /// Returns {action: created|merged|blocked|rejected, ...}
  Future<Map<String, dynamic>> submitComplaint({
    required String title,
    required String description,
    required double latitude,
    required double longitude,
    String? address,
    String categoryHint = 'auto',
    File? image,
    int? authorityId,
    String? division,
    String? district,
    String? areaText,
    String? ward,
    String? road,
    String? sector,
    String? village,
    String? upazila,
  }) async {
    final req = http.MultipartRequest('POST', Uri.parse('$kApiBase/complaints'))
      ..headers.addAll(_headers)
      ..fields['title'] = title
      ..fields['description'] = description
      ..fields['latitude'] = latitude.toString()
      ..fields['longitude'] = longitude.toString()
      ..fields['address_text'] = address ?? ''
      ..fields['category_hint'] = categoryHint;
    if (authorityId != null) req.fields['authority_id'] = '$authorityId';
    if (division != null) req.fields['division'] = division;
    if (district != null) req.fields['district'] = district;
    if (areaText != null) req.fields['area_text'] = areaText;
    if (ward != null) req.fields['ward'] = ward;
    if (road != null) req.fields['road'] = road;
    if (sector != null) req.fields['sector'] = sector;
    if (village != null) req.fields['village'] = village;
    if (upazila != null) req.fields['upazila'] = upazila;
    if (image != null) {
      req.files.add(await http.MultipartFile.fromPath('image', image.path));
    }
    final streamed = await req.send();
    final r = await http.Response.fromStream(streamed);
    final b = _decode(r);

    if (r.statusCode == 409) {
      return {'action': 'blocked', 'alert': b['alert'], 'detail': b['detail'], 'original_id': b['original_id']};
    }
    if (r.statusCode == 202) {
      return {'action': 'rejected', 'reason': b['reason']};
    }
    if (r.statusCode >= 400) throw ApiException(r.statusCode, b is Map ? b : {});

    if (b['merged'] == true) {
      return {'action': 'merged', 'original': Complaint.fromJson(b['original'])};
    }
    return {'action': 'created', 'complaint': Complaint.fromJson(b['complaint']), 'routed_to': b['routed_to']};
  }

  Future<List<Map<String, dynamic>>> divisions() async {
    final b = _check(await http.get(Uri.parse('$kApiBase/geo')));
    return (b['divisions'] as List).cast<Map<String, dynamic>>();
  }

  Future<List<dynamic>> authorities({String? district, String? type}) async {
    final params = <String, String>{};
    if (district != null) params['district'] = district;
    if (type != null) params['type'] = type;
    final uri = Uri.parse('$kApiBase/authorities').replace(queryParameters: params);
    final b = _check(await http.get(uri));
    return (b['authorities'] as List);
  }

  Future<Map<String, dynamic>?> _geocodeOnce(String query) async {
    try {
      final uri = Uri.parse('$kApiBase/geocode').replace(queryParameters: {'q': query});
      final r = await http.get(uri, headers: _headers);
      if (r.statusCode != 200) return null;
      final b = _decode(r);
      if (b['found'] == true) {
        return {'lat': (b['lat'] as num).toDouble(), 'lng': (b['lng'] as num).toDouble()};
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Tries several progressively simpler queries until one resolves.
  Future<Map<String, dynamic>?> geocode(String query) async {
    final parts = query.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
    final queries = <String>[query];
    if (parts.length > 3) {
      queries.add(parts.sublist(math.max(0, parts.length - 5)).join(', '));
      queries.add(parts.sublist(math.max(0, parts.length - 3)).join(', '));
    }
    for (final q in queries) {
      final result = await _geocodeOnce(q);
      if (result != null) return result;
    }
    return null;
  }

  Future<int> vote(int complaintId) async {
    final b = _check(await http.post(Uri.parse('$kApiBase/complaints/$complaintId/vote'), headers: _headers));
    return b['vote_count'];
  }

  Future<List<ServiceItem>> nearbyServices(double lat, double lng, {String type = 'all'}) async {
    final uri = Uri.parse('$kApiBase/services/nearby')
        .replace(queryParameters: {'lat': '$lat', 'lng': '$lng', 'type': type});
    final b = _check(await http.get(uri));
    return (b['services'] as List).map(ServiceItem.fromJson).toList();
  }

  Future<List<NotificationItem>> notifications() async {
    final b = _check(await http.get(Uri.parse('$kApiBase/my/notifications'), headers: _headers));
    return (b['notifications'] as List).map(NotificationItem.fromJson).toList();
  }

  Future<List<Complaint>> staffQueue({String category = 'all', String status = 'all'}) async {
    final uri = Uri.parse('$kApiBase/complaints/staff/queue')
        .replace(queryParameters: {'category': category, 'status': status});
    final b = _check(await http.get(uri, headers: _headers));
    return (b['complaints'] as List).map(Complaint.fromJson).toList();
  }

  Future<Complaint> updateStatus(int id, String status, {int? etaHours, String? note}) async {
    final b = _check(await http.patch(
      Uri.parse('$kApiBase/complaints/$id/status'),
      headers: _headers,
      body: jsonEncode({
        'status': status,
        if (etaHours != null) 'eta_hours': etaHours,
        'note': note ?? '',
      }),
    ));
    return Complaint.fromJson(b['complaint']);
  }

  Future<Map<String, dynamic>> stats() async {
    return _check(await http.get(Uri.parse('$kApiBase/stats')));
  }
}
