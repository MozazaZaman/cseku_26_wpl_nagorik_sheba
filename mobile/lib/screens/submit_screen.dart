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
import '../widgets/camera_capture.dart';
import '../widgets/map_layers.dart';
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
  final _mapCtl = MapController();

  bool speechReady = false;
  bool listening = false;
  bool bnLang = true;
  bool busy = false;
  bool geocoding = false;

  String locMode = 'gps'; // gps | address
  String categoryHint = 'auto';
  List<Map<String, dynamic>> divisions = [];
  List<dynamic> authorities = [];
  List<String> availableTypes = [];
  List<String> availableUpazilas = [];
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
  final _layer = ValueNotifier<String>('map');

  // All 8 divisions + districts as an offline fallback; replaced by /api/geo.
  static const _fallbackDivs = [
    {'name': 'Dhaka', 'districts': ['Dhaka','Faridpur','Gazipur','Gopalganj','Kishoreganj','Madaripur','Manikganj','Munshiganj','Narayanganj','Narsingdi','Rajbari','Shariatpur','Tangail']},
    {'name': 'Chattogram', 'districts': ['Bandarban','Brahmanbaria','Chandpur','Chattogram','Cumilla',"Cox's Bazar",'Feni','Khagrachhari','Lakshmipur','Noakhali','Rangamati']},
    {'name': 'Khulna', 'districts': ['Bagerhat','Chuadanga','Jashore','Jhenaidah','Khulna','Kushtia','Magura','Meherpur','Narail','Satkhira']},
    {'name': 'Rajshahi', 'districts': ['Bogura','Chapainawabganj','Joypurhat','Naogaon','Natore','Pabna','Rajshahi','Sirajganj']},
    {'name': 'Sylhet', 'districts': ['Habiganj','Moulvibazar','Sunamganj','Sylhet']},
    {'name': 'Barishal', 'districts': ['Barguna','Barishal','Bhola','Jhalokati','Patuakhali','Pirojpur']},
    {'name': 'Rangpur', 'districts': ['Dinajpur','Gaibandha','Kurigram','Lalmonirhat','Nilphamari','Panchagarh','Rangpur','Thakurgaon']},
    {'name': 'Mymensingh', 'districts': ['Jamalpur','Mymensingh','Netrokona','Sherpur']},
  ];

  @override
  void initState() {
    super.initState();
    gpsNote = context.read<Lang>().t('sub.gpsDefault');
    divisions = _fallbackDivs.map((e) => Map<String, dynamic>.from(e)).toList();
    api.divisions().then((d) {
      if (mounted && d.isNotEmpty) setState(() => divisions = d);
    }).catchError((_) {});
    _autoLocate();
  }

  /// Recenter the map after a location change (guarded: the controller may not
  /// be attached yet on the very first frame).
  void _recenter() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        _mapCtl.move(LatLng(lat, lng), _mapCtl.camera.zoom);
      } catch (_) {}
    });
  }

  Future<void> _autoLocate() async {
    final lang = context.read<Lang>();
    try {
      final p = await getCurrentPosition();
      if (!mounted) return;
      setState(() {
        lat = p.latitude;
        lng = p.longitude;
        gpsNote = '${lang.t('sub.gpsLocked')}${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      });
      _recenter();
    } catch (_) {
      if (mounted) setState(() => gpsNote = lang.t('sub.gpsUnavailable'));
    }
  }

  Future<void> _loadTypes() async {
    if (district == null) { if (mounted) setState(() { availableTypes = []; availableUpazilas = []; authorities = []; }); return; }
    try {
      final types = await api.authorityTypes(district: district!);
      if (!mounted) return;
      setState(() {
        availableTypes = types;
        if (types.isNotEmpty && !types.contains(authType)) authType = types.first;
        authorityId = null;
        if (authType != 'UNION_PARISHAD') _upazila.text = '';
      });
      if (types.isNotEmpty) {
        if (authType == 'UNION_PARISHAD') await _loadUpazilas();
        else await _loadAuthorities();
      } else setState(() => authorities = []);
    } catch (_) { if (mounted) setState(() { availableTypes = []; availableUpazilas = []; authorities = []; }); }
  }

  Future<void> _loadUpazilas() async {
    if (district == null) { if (mounted) setState(() => availableUpazilas = []); return; }
    try {
      final list = await api.authorityUpazilas(district: district!);
      if (!mounted) return;
      setState(() {
        availableUpazilas = list;
        if (list.isNotEmpty && !list.contains(_upazila.text)) _upazila.text = list.first;
        authorityId = null;
      });
      if (list.isNotEmpty) await _loadAuthorities();
      else setState(() => authorities = []);
    } catch (_) { if (mounted) setState(() => availableUpazilas = []); }
  }

  Future<void> _loadAuthorities() async {
    if (district == null || authType.isEmpty) { if (mounted) setState(() => authorities = []); return; }
    if (availableTypes.isNotEmpty && !availableTypes.contains(authType)) { if (mounted) setState(() => authorities = []); return; }
    if (authType == 'UNION_PARISHAD' && _upazila.text.isEmpty) { if (mounted) setState(() => authorities = []); return; }
    try {
      final list = await api.authorities(
        district: district,
        type: authType,
        upazila: authType == 'UNION_PARISHAD' ? _upazila.text : null,
      );
      if (!mounted) return;
      setState(() => authorities = list);
    } catch (_) { if (mounted) setState(() => authorities = []); }
  }

  Future<void> _toggleVoice() async {
    final lang = context.read<Lang>();
    if (listening) {
      await _speech.stop();
      setState(() => listening = false);
      return;
    }
    if (!speechReady) {
      speechReady = await _speech.initialize();
      if (!speechReady) {
        setState(() => error = lang.t('reg.err.camera').replaceAll('Camera', 'Speech'));
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

  /// In-app camera capture — never leaves the Flutter activity, so Android
  /// cannot kill the app while taking the photo (fixes the restart bug that
  /// the system-camera intent caused on the report page).
  Future<void> _takePhoto() async {
    final lang = context.read<Lang>();
    try {
      final path = await Navigator.push<String>(
        context,
        MaterialPageRoute(
            builder: (_) => CameraCaptureScreen(front: false, title: lang.t('sub.photoTitle'))),
      );
      if (path == null) return;
      if (!mounted) return;
      setState(() => image = File(path));
    } catch (_) {
      if (mounted) setState(() => error = lang.t('reg.err.camera'));
    }
  }

  /// Gallery fallback — picking from Photos is also safe from the restart bug.
  Future<void> _pickGallery() async {
    try {
      final x = await _picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 70,
        maxWidth: 1600,
      );
      if (x == null) return;
      if (!mounted) return;
      setState(() => image = File(x.path));
    } catch (_) {}
  }

  Future<void> _useGps() async {
    final lang = context.read<Lang>();
    try {
      final p = await getCurrentPosition();
      setState(() {
        lat = p.latitude;
        lng = p.longitude;
        gpsNote = '${lang.t('sub.gpsLocked')}${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
      });
      _recenter();
    } catch (_) {
      setState(() => gpsNote = lang.t('sub.gpsUnavailable'));
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
    if (division == null || district == null || authorityId == null ||
        (isUnion && (_village.text.isEmpty || _upazila.text.isEmpty))) {
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
      _recenter();
    } else {
      final auth = authorities.firstWhere((a) => a['authority_id'] == authorityId, orElse: () => null);
      if (auth != null && auth['center_lat'] != null) {
        setState(() {
          lat = (auth['center_lat'] as num).toDouble();
          lng = (auth['center_lng'] as num).toDouble();
          geoNote = lang.t('sub.notFound');
          geocoding = false;
        });
        _recenter();
      } else {
        setState(() {
          geocoding = false;
          geoNote = lang.t('sub.notFound');
        });
      }
    }
  }

  bool _addressValid() =>
      division != null && district != null && authorityId != null &&
      (!isUnion || (_village.text.isNotEmpty && _upazila.text.isNotEmpty));

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
        categoryHint: categoryHint,
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
      final lang2 = context.read<Lang>();
      final action = res['action'];
      if (action == 'created') {
        final c = res['complaint'] as Complaint;
        _showResult(
          icon: Icons.check_circle_rounded,
          color: NSColors.mint,
          title: lang2.t('res.created'),
          body: '${lang2.t('res.createdBody')}${res['routed_to']}\n\n${lang2.t('res.ticket')}${c.id}',
          actionLabel: lang2.t('res.track'),
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
          title: lang2.t('res.mergedTitle'),
          body:
              '${lang2.t('res.mergedBody')}${o.id} "${o.title}", ${o.voteCount}${lang2.t('res.mergedBody2')}',
          actionLabel: lang2.t('res.viewOriginal'),
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
          body: '${res['detail'] ?? ''}${lang2.t('res.blockedNote')}',
        );
      } else {
        _showResult(
          icon: Icons.gpp_bad_rounded,
          color: NSColors.rose,
          title: lang2.t('res.rejectedTitle'),
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
        backgroundColor: Theme.of(context).extension<NSScheme>()!.card,
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
                style: TextStyle(color: Theme.of(context).extension<NSScheme>()!.sub, fontSize: 13.5, height: 1.45)),
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
    final s = Theme.of(context).extension<NSScheme>()!;
    return SafeArea(
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 100),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(lang.t('sub.title'),
              style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: s.text)),
          const SizedBox(height: 4),
          Text(lang.t('sub.sub'), style: TextStyle(color: s.sub, fontSize: 13)),
          const SizedBox(height: 18),

          GlassBox(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              TextField(controller: _title, decoration: _dec(lang.t('sub.titleField'))),
              const SizedBox(height: 12),
              TextField(controller: _desc, maxLines: 4, decoration: _dec(lang.t('sub.desc'))),
              const SizedBox(height: 14),
              Row(children: [
                GestureDetector(
                  onTap: _toggleVoice,
                  child: Container(
                    width: 46, height: 46,
                    decoration: BoxDecoration(
                      gradient: listening ? const LinearGradient(colors: [NSColors.rose, Color(0xFFFF8A65)]) : NSGradient.box,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(listening ? Icons.stop_rounded : Icons.mic_rounded, color: Colors.white),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(listening ? lang.t('sub.listening') : lang.t('sub.voice'),
                      style: TextStyle(color: s.sub, fontWeight: FontWeight.w700, fontSize: 13.5)),
                  GestureDetector(
                    onTap: () => setState(() => bnLang = !bnLang),
                    child: Text('${lang.t('sub.langSwitch')}${bnLang ? "English" : "বাংলা"}',
                        style: const TextStyle(color: NSColors.accent, fontSize: 11.5)),
                  ),
                ])),
              ]),
            ]),
          ),
          const SizedBox(height: 16),

          // ---- Category hint (optional; web's "force category") ----
          GlassBox(
            child: Row(children: [
              const Icon(Icons.category_rounded, color: NSColors.accent3, size: 20),
              const SizedBox(width: 12),
              Expanded(child: Text(lang.t('sub.catHint'),
                  style: TextStyle(color: s.sub, fontSize: 12.5, fontWeight: FontWeight.w600))),
              DropdownButton<String>(
                value: categoryHint,
                underline: const SizedBox(),
                style: TextStyle(color: NSColors.accent, fontSize: 12.5, fontWeight: FontWeight.w800),
                items: [
                  DropdownMenuItem(value: 'auto', child: Text(lang.t('sub.catAuto'))),
                  ...['road', 'electricity', 'water', 'gas', 'sanitation', 'encroachment', 'environment', 'public_assets', 'animals', 'markets', 'drugs', 'other']
                      .map((k) => DropdownMenuItem(value: k, child: Text(lang.t('cat.$k')))),
                ],
                onChanged: (v) => setState(() => categoryHint = v!),
              ),
            ]),
          ),
          const SizedBox(height: 16),

          // ---- Photo evidence (single block) ----
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Column(children: [
              GestureDetector(
                onTap: _takePhoto,
                child: Container(
                  width: 92, height: 92,
                  decoration: glassDecoration(context),
                  child: image != null
                      ? ClipRRect(borderRadius: BorderRadius.circular(18), child: Image.file(image!, fit: BoxFit.cover))
                      : Icon(Icons.add_a_photo_rounded, color: s.faint, size: 30),
                ),
              ),
              if (image != null)
                TextButton(
                  onPressed: () => setState(() => image = null),
                  style: TextButton.styleFrom(
                    foregroundColor: NSColors.rose,
                    minimumSize: const Size(0, 28),
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    textStyle: const TextStyle(fontSize: 11),
                  ),
                  child: const Icon(Icons.delete_outline_rounded, size: 15),
                ),
            ]),
            const SizedBox(width: 14),
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              InfoBanner(lang.t('sub.photo'), color: NSColors.accent),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _takePhoto,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      minimumSize: const Size(0, 34),
                      textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                    icon: const Icon(Icons.photo_camera_rounded, size: 15),
                    label: Text(image != null ? lang.t('reg.retake') : lang.t('sub.photoTitle')),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _pickGallery,
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                      minimumSize: const Size(0, 34),
                      textStyle: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700),
                    ),
                    icon: const Icon(Icons.photo_library_rounded, size: 15),
                    label: Text(lang.t('reg.uploadInstead'), maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
                ),
              ]),
            ])),
          ]),
          const SizedBox(height: 16),

          // ---------- LOCATION ----------
          GlassBox(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => locMode = 'gps'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: locMode == 'gps' ? NSColors.accent.withOpacity(0.25) : s.fill,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: locMode == 'gps' ? NSColors.accent : s.line),
                      ),
                      child: Center(child: Text(lang.t('sub.mode.gps'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: GestureDetector(
                    onTap: () => setState(() => locMode = 'address'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      decoration: BoxDecoration(
                        color: locMode == 'address' ? NSColors.accent2.withOpacity(0.25) : s.fill,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: locMode == 'address' ? NSColors.accent2 : s.line),
                      ),
                      child: Center(child: Text(lang.t('sub.mode.addr'), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700))),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 14),

              if (locMode == 'gps')
                Row(children: [
                  Icon(Icons.location_on_rounded, color: NSColors.accent3, size: 18),
                  const SizedBox(width: 8),
                  Expanded(child: Text(gpsNote, style: TextStyle(color: s.sub, fontSize: 12))),
                  TextButton(onPressed: _useGps, child: Text(lang.t('sub.useGps'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 12))),
                ])
              else ...[
                DropdownButtonFormField<String>(
                  value: division,
                  decoration: _dec(lang.t('sub.division')),
                  items: divisions.map((d) => DropdownMenuItem(value: d['name'] as String, child: Text(d['name'] as String))).toList(),
                  onChanged: (v) => setState(() { division = v; district = null; authorityId = null; authorities = []; availableTypes = []; availableUpazilas = []; _upazila.text = ''; }),
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: district,
                  decoration: _dec(lang.t('sub.district')),
                  items: (() {
                    final match = divisions.where((d) => d['name'] == division);
                    if (match.isEmpty) return <DropdownMenuItem<String>>[];
                    return (match.first['districts'] as List).cast<String>().map((d) => DropdownMenuItem(value: d, child: Text(d))).toList();
                  })(),
                  onChanged: division == null ? null : (v) { setState(() { district = v; authorityId = null; }); _loadTypes(); },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  value: availableTypes.contains(authType) ? authType : null,
                  decoration: _dec(lang.t('sub.type')),
                  items: district == null ? [] : availableTypes.isEmpty
                    ? [DropdownMenuItem(value: '', child: Text('No types for this district'))]
                    : availableTypes.map((tp) => DropdownMenuItem(
                        value: tp,
                        child: Text(tp == 'CITY_CORPORATION' ? lang.t('sub.cityCorp') : tp == 'POUROSHOVA' ? lang.t('sub.pouro') : lang.t('sub.union')),
                      )).toList(),
                  onChanged: district == null || availableTypes.isEmpty ? null : (v) {
                    setState(() { authType = v!; authorityId = null; if (v != 'UNION_PARISHAD') _upazila.text = ''; });
                    if (v == 'UNION_PARISHAD') _loadUpazilas(); else _loadAuthorities();
                  },
                ),
                const SizedBox(height: 10),
                if (isUnion) ...[
                  DropdownButtonFormField<String>(
                    value: _upazila.text.isNotEmpty && availableUpazilas.contains(_upazila.text) ? _upazila.text : null,
                    decoration: _dec(lang.t('sub.upazila')),
                    items: availableUpazilas.map((u) => DropdownMenuItem(value: u, child: Text(u))).toList(),
                    onChanged: district == null ? null : (v) { setState(() { _upazila.text = v!; authorityId = null; }); _loadAuthorities(); },
                  ),
                  const SizedBox(height: 10),
                ],
                DropdownButtonFormField<int>(
                  value: authorityId,
                  decoration: _dec(isUnion ? lang.t('sub.union') : authType == 'POUROSHOVA' ? lang.t('sub.pouro') : lang.t('sub.cityCorp')),
                  items: authorities.map((a) => DropdownMenuItem(
                      value: a['authority_id'] as int, child: Text(a['name'] as String, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: district == null || (isUnion && _upazila.text.isEmpty) ? null : (v) => setState(() => authorityId = v),
                ),
                const SizedBox(height: 10),
                if (isUnion) ...[
                  TextField(controller: _village, decoration: _dec(lang.t('sub.village'))),
                  const SizedBox(height: 10),
                ] else ...[
                  TextField(controller: _area, decoration: _dec(lang.t('sub.area'))),
                  const SizedBox(height: 10),
                  TextField(controller: _ward, decoration: _dec(lang.t('sub.ward'))),
                  const SizedBox(height: 10),
                ],
                TextField(controller: _road, decoration: _dec(lang.t('sub.road'))),
                const SizedBox(height: 10),
                TextField(controller: _sector, decoration: _dec(lang.t('sub.sector'))),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: geocoding ? null : _geocode,
                  icon: geocoding
                      ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.travel_explore_rounded, size: 18),
                  label: Text(lang.t('sub.find')),
                ),
                if (geoNote != null) ...[const SizedBox(height: 8), Text(geoNote!, style: const TextStyle(color: NSColors.mint, fontSize: 11.5))],
                if (composedAddress.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(composedAddress, style: TextStyle(color: s.sub, fontSize: 11)),
                ],
              ],
              const SizedBox(height: 12),

              // ---- Map preview (both modes; tap to fine-tune the pin) ----
              Text(lang.t('sub.find'), style: TextStyle(color: s.faint, fontSize: 11.5, fontWeight: FontWeight.w700)),
              const SizedBox(height: 8),
              SizedBox(
                height: 180,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: NsMap(
                    controller: _mapCtl,
                    layer: _layer,
                    initialCenter: LatLng(lat, lng),
                    initialZoom: 15,
                    onTap: (_, point) => setState(() {
                      lat = point.latitude;
                      lng = point.longitude;
                      if (locMode == 'gps') gpsNote = '${lang.t('sub.gpsLocked')}${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}';
                    }),
                    children: [
                      MarkerLayer(markers: [
                        Marker(point: LatLng(lat, lng), width: 40, height: 40,
                            child: const Text('📍', style: TextStyle(fontSize: 28))),
                      ]),
                    ],
                  ),
                ),
              ),
            ]),
          ),
          const SizedBox(height: 16),

          GlassBox(
            child: TextField(controller: _address, decoration: _dec(lang.t('sub.landmark'))),
          ),

          if (error != null) ...[const SizedBox(height: 14), ErrorBanner(error!)],
          const SizedBox(height: 20),

          FilledButton.icon(
            onPressed: busy ? null : _submit,
            icon: busy
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Icon(Icons.rocket_launch_rounded),
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
