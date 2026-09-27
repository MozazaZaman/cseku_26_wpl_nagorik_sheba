const kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://192.168.0.102:5000/api',
);

/// Origin of the API server (scheme + host + port), used to build absolute
/// URLs for uploaded media (the API returns paths like "/uploads/x.jpg").
String get kApiOrigin {
  final u = Uri.parse(kApiBase);
  return '${u.scheme}://${u.host}${u.hasPort ? ':${u.port}' : ''}';
}

/// Turns a relative server path ("/uploads/abc.jpg") into a full URL.
String? assetUrl(String? relative) {
  if (relative == null || relative.isEmpty) return null;
  if (relative.startsWith('http')) return relative;
  return '$kApiOrigin$relative';
}

// Optional: paste a Google Geocoding API key for better address accuracy.
// Enable "Geocoding API" at https://console.cloud.google.com (free tier available).
// Leave empty to use the free OpenStreetMap (Nominatim) geocoder.
const kGoogleGeocodeKey = '';
