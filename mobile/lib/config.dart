const kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://localhost:5000/api',
);

// Optional: paste a Google Geocoding API key for better address accuracy.
// Enable "Geocoding API" at https://console.cloud.google.com (free tier available).
// Leave empty to use the free OpenStreetMap (Nominatim) geocoder.
const kGoogleGeocodeKey = '';
