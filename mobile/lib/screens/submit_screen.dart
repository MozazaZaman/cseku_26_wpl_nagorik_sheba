import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../api_service.dart';
import '../i18n.dart';
import '../models.dart';
import '../theme.dart';
import '../utils/location.dart';
import '../widgets/widgets.dart';
import 'complaint_detail_screen.dart';

class SubmitScreen extends StatefulWidget {
  const SubmitScreen({super.key});

  @override
  State<SubmitScreen> createState() => _SubmitScreenState();
}

class _SubmitScreenState extends State<SubmitScreen> {
  final api = ApiService();
  final _title = TextEditingController();
  final _desc = TextEditingController();
  final _address = TextEditingController();
  final _speech = SpeechToText();
  final _picker = ImagePicker();

  bool speechReady = false;
  bool listening = false;
  bool bnLang = true;
  bool busy = false;
  bool geocoding = false;

  String locMode = 'gps'; // gps | address
  List<Map<String, dynamic>> divisions = [];
  List<dynamic> authorities = [];
  String? division;
  String? district;
  String authType = 'CITY_CORPORATION';
  int? authorityId;
  final _area = TextEditingController();
  final _ward = TextEditingController();
  final _road = TextEditingController();
  final _sector = TextEditingController();
  final _village = TextEditingController();
  final _upazila = TextEditingController();

  File? image;
  double lat = 23.7385, lng = 90.3965;
  String gpsNote = '…';
  String? error;
  String? geoNote;

  @override
  void initState() {
    super.initState();
    gpsNote = context.read<Lang>().t('sub.gpsDefault');
    api.divisions().then((d) {
      if (mounted) setState(() => divisions = d);
    }).catchError((_) {});
    _autoLocate();
  }

  Future<void> _autoLocate() async {
    final lang = Lang();
    try {
      final p = await getCurrentPosition();
      if (!mounted) return;
      setState(() {
        lat = p.latitude;
        lng = p.longitude;
        gpsNote = '${lang.t('sub.gpsLocked')}${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      });
    } catch (_) {
      if (mounted) {
        setState(() => gpsNote = lang.t('sub.gpsUnavailable'));
      }
    }
  }

  Future<void> _loadAuthorities() async {
    try {
      final list = await api.authorities(district: district, type: authType);
      if (!mounted) return;
      setState(() => authorities = list);
    } catch (_) {}
  }

  Future<void> _toggleVoice() async {
    if (listening) {
      await _speech.stop();
      setState(() => listening = false);
      return;
    }
    if (!speechReady) {
      speechReady = await _speech.initialize();
      if (!speechReady) {
        setState(() => error = 'Speech recognition not available on this device');
        return;
      }
    }
    setState(() => listening = true);
    _speech.listen(
      localeId: bnLang ? 'bn_BD' : 'en_US',
      listenMode: ListenMode.dictation,
      onResult: (r) {
        if (r.finalResult) {
          setState(() {
            _desc.text = _desc.text.isEmpty ? r.recognizedWords : '${_desc.text} ${r.recognizedWords}';
            listening = false;
          });
        }
      },
    );
  }

  Future<void> _pickImage() async {
    final x = await _picker.pickImage(source: ImageSource.camera, imageQuality: 70);
    if (x != null) setState(() => image = File(x.path));
  }

  Future<void> _useGps() async {
    try {
      final p = await getCurrentPosition();
      setState(() {
        lat = p.latitude;
        lng = p.longitude;
        gpsNote = 'GPS locked: ${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      });
    } catch (_) {
      setState(() => gpsNote = 'GPS unavailable — using default location');
    }
  }

  bool get isUnion => authType == 'UNION_PARISHAD';

  String get composedAddress {
    final parts = <String>[
      if (_road.text.isNotEmpty) 'Road ${_road.text}',
      if (_sector.text.isNotEmpty) _sector.text,
      if (_ward.text.isNotEmpty) 'Ward ${_ward.text}',
      if (!isUnion && _area.text.isNotEmpty) _area.text,
      if (isUnion && _village.text.isNotEmpty) _village.text,
      if (isUnion && _upazila.text.isNotEmpty) _upazila.text,
      if (authorityId != null)
        (authorities.firstWhere((a) => a['authority_id'] == authorityId, orElse: () => null)?['name'] ?? ''),
      if (district != null) district!,
      if (division != null) division!,
      'Bangladesh',
    ];
    return parts.join(', ');
  }

  Future<void> _geocode() async {
    final lang = context.read<Lang>();
    if (division == null || district == null || authorityId == null || _road.text.isEmpty ||
        (isUnion && _village.text.isEmpty)) {
      setState(() => error = lang.t('sub.completeFields'));
      return;
    }
    setState(() {
      geocoding = true;
      error = null;
      geoNote = null;
    });
    final q = _address.text.isNotEmpty ? '${_address.text}, ${composedAddress}' : composedAddress;
    final result = await api.geocode(q);
    if (!mounted) return;
    if (result != null) {
      setState(() {
        lat = result['lat'];
        lng = result['lng'];
        geoNote = lang.t('sub.found');
        geocoding = false;
      });
    } else {
      final auth = authorities.firstWhere((a) => a['authority_id'] == authorityId, orElse: () => null);
      if (auth != null && auth['center_lat'] != null) {
        setState(() {
          lat = (auth['center_lat'] as num).toDouble();
          lng = (auth['center_lng'] as num).toDouble();
          geoNote = lang.t('sub.notFound');
          geocoding = false;
        });
      } else {
        setState(() {
          geocoding = false;
          geoNote = lang.t('sub.notFound');
        });
      }
    }
  }

  bool _addressValid() =>
      division != null && district != null && authorityId != null && _road.text.isNotEmpty &&
      (!isUnion || _village.text.isNotEmpty);

  Future<void> _submit() async {
    final lang = context.read<Lang>();
    if (_title.text.trim().isEmpty || _desc.text.trim().length < 10) {
      setState(() => error = lang.t('sub.err.titleDesc'));
      return;
    }
    if (locMode == 'address' && !_addressValid()) {
      setState(() => error = lang.t('sub.err.addr'));
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final res = await api.submitComplaint(
        title: _title.text.trim(),
        description: _desc.text.trim(),
        latitude: lat,
        longitude: lng,
        address: _address.text.trim(),
        image: image,
        authorityId: locMode == 'address' ? authorityId : null,
        division: locMode == 'address' ? division : null,
        district: locMode == 'address' ? district : null,
        areaText: locMode == 'address' && !isUnion ? _area.text.trim() : null,
        ward: locMode == 'address' ? _ward.text.trim() : null,
        road: locMode == 'address' ? _road.text.trim() : null,
        sector: locMode == 'address' ? _sector.text.trim() : null,
        village: locMode == 'address' && isUnion ? _village.text.trim() : null,
        upazila: locMode == 'address' && isUnion ? _upazila.text.trim() : null,
      );
      if (!mounted) return;
      final lang = context.read<Lang>();
      final action = res['action'];
      if (action == 'created') {
        final c = res['complaint'] as Complaint;
        _showResult(
          icon: Icons.check_circle_rounded,
          color: NSColors.mint,
          title: lang.t('res.created'),
          body: '${lang.t('res.createdBody')}${res['routed_to']}\n\n${lang.t('res.ticket')}${c.id}',
          actionLabel: lang.t('res.track'),
          onAction: () {
            Navigator.pop(context);
            Navigator.pushReplacement(context,
                MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: c.id)));
          },
        );
      } else if (action == 'merged') {
        final o = res['original'] as Complaint;
        _showResult(
          icon: Icons.how_to_vote_rounded,
          color: NSColors.accent,
          title: lang.t('res.mergedTitle'),
          body:
              '${lang.t('res.mergedBody')}${o.id} "${o.title}", ${o.voteCount}${lang.t('res.mergedBody2')}',
          actionLabel: lang.t('res.viewOriginal'),
          onAction: () {
            Navigator.pop(context);
            Navigator.pushReplacement(context,
                MaterialPageRoute(builder: (_) => ComplaintDetailScreen(id: o.id)));
          },
        );
      } else if (action == 'blocked') {
        _showResult(
          icon: Icons.hourglass_top_rounded,
          color: NSColors.amber,
          title: res['alert'],
          body: '${res['detail'] ?? ''}${lang.t('res.blockedNote')}',
        );
      } else {
        _showResult(
          icon: Icons.gpp_bad_rounded,
          color: NSColors.rose,
          title: lang.t('res.rejectedTitle'),
          body: res['reason'] ?? '',
        );
      }
      setState(() => busy = false);
    } on ApiException catch (e) {
      setState(() {
        busy = false;
        error = e.message;
      });
    } catch (e) {
      setState(() {
        busy = false;
        error = context.read<Lang>().t('sub.err.network');
      });
    }
  }
      setState(() => busy = false);
    } on ApiException catch (e) {
      setState(() {
        busy = false;
        error = e.message;
      });
    } catch (e) {
      setState(() {
        busy = false;
        error = 'Network error — is the server running? ($kApiBase)';
      });
    }
  }

  void _showResult({
    required IconData icon,
    required Color color,
    required String title,
    required String body,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Dialog(
        backgroundColor: NSColors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 56, color: color),
            const SizedBox(height: 14),
            Text(title, textAlign: TextAlign.center,
                style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: color)),
            const SizedBox(height: 10),
            Text(body, textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white54, fontSize: 13.5, height: 1.45)),
            const SizedBox(height: 20),
            FilledButton(onPressed: onAction ?? () => Navigator.pop(context),
                child: Text(actionLabel ?? 'Close')),
          ]),
        ),
      ),
    ).then((_) {
      _title.clear();
      _desc.clear();
      _address.clear();
      setState(() => image = null);
    });
  }

  InputDecoration _dec(String hint) => InputDecoration(hintText: hint);

  @override
  Widget build(BuildContext context) {
    final lang = context.watch<Lang>();
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(20, 20, 20, 100),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.t('sub.title'),
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
          SizedBox(height: 4),
          Text(lang.t('sub.sub'),
              style: TextStyle(color: Colors.white38, fontSize: 13)),
          SizedBox(height: 18),

          GlassBox(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              TextField(controller: _title,
                  decoration: _dec(lang.t('sub.titleField'))),
              SizedBox(height: 12),
              TextField(controller: _desc, maxLines: 4,
                  decoration: _dec(lang.t('sub.desc'))),
              SizedBox(height: 14),
              Row(children: [
                GestureDetector(
                  onTap: _toggleVoice,
                  child: Container(
                    width: 46, height: 46,
                    decoration: BoxDecoration(
                      gradient: listening ? LinearGradient(colors: [NSColors.rose, Color(0xFFFF8A65)]) : NSGradient.box,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(listening ? Icons.stop_rounded : Icons.mic_rounded, color: Colors.white),
                  ),
                ),
                SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(listening ? lang.t('sub.listening') : lang.t('sub.voice'),
                      style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, fontSize: 13.5)),
                  GestureDetector(
                    onTap: () => setState(() => bnLang = !bnLang),
                    child: Text('${lang.t('sub.langSwitch')}${bnLang ? "English" : "বাংলা"}',
                        style: TextStyle(color: NSColors.accent, fontSize: 11.5)),
                  ),
                ])),
              ]),
            ],
          ),
          ),
          SizedBox(height: 16),

          Row(children: [
            GestureDetector(
              onTap: _pickImage,
              child: Container(
                width: 92, height: 92,
                decoration: glassDecoration(),
                child: image != null
                    ? ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.file(image!, fit: BoxFit.cover))
                    : Icon(Icons.add_a_photo_rounded, color: Colors.white24, size: 30),
              ),
            ),
            SizedBox(width: 14),
            Expanded(child: InfoBanner(lang.t('sub.photo'), color: NSColors.accent)),
          ]),
          SizedBox(height: 16),

          Row(children: [
            GestureDetector(
              onTap: _pickImage,
              child: Container(
                width: 92, height: 92,
                decoration: glassDecoration(),
                child: image != null
                    ? ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.file(image!, fit: BoxFit.cover))
                    : Icon(Icons.add_a_photo_rounded, color: Colors.white24, size: 30),
              ),
            ),
            SizedBox(width: 14),
            Expanded(child: InfoBanner('Photo evidence is optional but speeds up verification.', color: NSColors.accent)),
          ]),
          SizedBox(height: 16),

          // ---------- LOCATION ----------
          GlassBox(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => locMode = 'gps'),
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: locMode == 'gps' ? NSColors.accent.withOpacity(0.25) : Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: locMode == 'gps' ? NSColors.accent : Colors.white10),
                      ),
                      child: Center(child: Text(lang.t('sub.mode.gps'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
                SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => locMode = 'address'),
                    child: Container(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: locMode == 'address' ? NSColors.accent2.withOpacity(0.25) : Colors.white.withOpacity(0.03),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: locMode == 'address' ? NSColors.accent2 : Colors.white10),
                      ),
                      child: Center(child: Text(lang.t('sub.mode.addr'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
              ]),
              SizedBox(height: 14),

              if (locMode == 'gps') ...[
                Row(children: [
                  Icon(Icons.location_on_rounded, color: NSColors.accent3, size: 18),
                  SizedBox(width: 8),
                  Expanded(child: Text(gpsNote, style: TextStyle(color: Colors.white60, fontSize: 12))),
                  TextButton(onPressed: _useGps, child: Text(lang.t('sub.useGps'), style: TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
                ]),
              ] else ...[
                DropdownButtonFormField<String>(
                  value: division,
                  decoration: _dec(lang.t('sub.division')),
                  items: divisions.map((d) => DropdownMenuItem(value: d['name'] as String, child: Text(d['name'] as String))).toList(),
                  onChanged: (v) => setState(() { division = v; district = null; authorityId = null; authorities = []; }),
                ),
                SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: district,
                  decoration: _dec(lang.t('sub.district')),
                  items: (divisions.firstWhere((d) => d['name'] == division, orElse: () => null)?['districts'] as List?)
                      ?.cast<String>().map((d) => DropdownMenuItem(value: d, child: Text(d))).toList() ?? [],
                  onChanged: division == null ? null : (v) => setState(() { district = v; authorityId = null; _loadAuthorities(); }),
                ),
                SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: authType,
                  decoration: _dec(lang.t('sub.type')),
                  items: [
                    DropdownMenuItem(value: 'CITY_CORPORATION', child: Text(lang.t('sub.cityCorp'))),
                    DropdownMenuItem(value: 'POUROSHOVA', child: Text(lang.t('sub.pouro'))),
                    DropdownMenuItem(value: 'UNION_PARISHAD', child: Text(lang.t('sub.union'))),
                  ],
                  onChanged: (v) => setState(() { authType = v!; authorityId = null; _loadAuthorities(); }),
                ),
                SizedBox(height: 10),
                DropdownButtonFormField<int>(
                  value: authorityId,
                  decoration: _dec(isUnion ? lang.t('sub.union') : authType == 'POUROSHOVA' ? lang.t('sub.pouro') : lang.t('sub.cityCorp')),
                  items: authorities.map((a) => DropdownMenuItem(
                      value: a['authority_id'] as int, child: Text(a['name'] as String, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: district == null ? null : (v) => setState(() => authorityId = v),
                ),
                SizedBox(height: 10),
                if (isUnion) ...[
                  TextField(controller: _village, decoration: _dec(lang.t('sub.village'))),
                  SizedBox(height: 10),
                  TextField(controller: _upazila, decoration: _dec(lang.t('sub.upazila'))),
                  SizedBox(height: 10),
                ] else ...[
                  TextField(controller: _area, decoration: _dec(lang.t('sub.area'))),
                  SizedBox(height: 10),
                  TextField(controller: _ward, decoration: _dec(lang.t('sub.ward'))),
                  SizedBox(height: 10),
                ],
                TextField(controller: _road, decoration: _dec(lang.t('sub.road'))),
                SizedBox(height: 10),
                TextField(controller: _sector, decoration: _dec(lang.t('sub.sector'))),
                SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: geocoding ? null : _geocode,
                  icon: geocoding
                      ? SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : Icon(Icons.travel_explore_rounded, size: 18),
                  label: Text(lang.t('sub.find')),
                ),
                if (geoNote != null) ...[SizedBox(height: 8), Text(geoNote!, style: TextStyle(color: NSColors.mint, fontSize: 11.5))],
                if (composedAddress.isNotEmpty) ...[
                  SizedBox(height: 8),
                  Text(composedAddress, style: TextStyle(color: Colors.white38, fontSize: 11)),
                ],
                SizedBox(height: 12),
                SizedBox(
                  height: 180,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    key: ValueKey('map-$lat-$lng'),
                    child: FlutterMap(
                      options: MapOptions(initialCenter: LatLng(lat, lng), initialZoom: 15,
                          interactionOptions: InteractionOptions(flags: InteractiveFlag.none)),
                      children: [
                        TileLayer(url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
                        MarkerLayer(markers: [
                          Marker(point: LatLng(lat, lng), width: 40, height: 40,
                              child: Text('📌', style: TextStyle(fontSize: 26))),
                        ]),
                      ],
                    ),
                  ),
                ),
              ],
            ]),
          ),
          SizedBox(height: 16),

          GlassBox(
            child: TextField(controller: _address,
                decoration: _dec(lang.t('sub.landmark'))),
          ),

          if (error != null) ...[SizedBox(height: 14), ErrorBanner(error!)],
          SizedBox(height: 20),

          FilledButton.icon(
            onPressed: busy ? null : _submit,
            icon: busy
                ? SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Icon(Icons.rocket_launch_rounded),
            label: Text(busy ? lang.t('sub.processing') : lang.t('sub.submit')),
          ),
        ]),
      ),
    );
  }

  @override
  void dispose() {
    _title.dispose();
    _desc.dispose();
    _address.dispose();
    _area.dispose();
    _ward.dispose();
    _road.dispose();
    _sector.dispose();
    _village.dispose();
    _upazila.dispose();
    super.dispose();
  }
}
