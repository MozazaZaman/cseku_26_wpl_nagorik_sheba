# Osmium + Geofabrik + Nominatim Workflow for Nagorik Sheba

This project uses **OpenStreetMap (OSM)** data processed with **Osmium** and **Geofabrik** extracts, served through the **public Nominatim API** for accurate locations.

## 1. Data Source — Geofabrik Bangladesh Extract

Download the latest Bangladesh PBF from Geofabrik (updated daily):

```bash
wget https://download.geofabrik.de/asia/bangladesh-latest.osm.pbf
```

## 2. Extract Services with Osmium

Filter only the amenities needed for nearby search (toilets, police, fire stations, water utilities) and administrative boundaries:

```bash
# Emergency services (points)
osmium tags-filter bangladesh-latest.osm.pbf \
  n/amenity=toilets,police,fire_station n/office=water_utility \
  -o services.osm.pbf

# Administrative boundaries (polygons, all levels)
osmium tags-filter bangladesh-latest.osm.pbf \
  r/boundary=administrative \
  -o admin.osm.pbf

# Further filter admin by level for each file
osmium tags-filter admin.osm.pbf r/admin_level=4 -o divisions.osm.pbf    # divisions
osmium tags-filter admin.osm.pbf r/admin_level=6 -o districts.osm.pbf     # districts
osmium tags-filter admin.osm.pbf r/admin_level=7 -o upazila.osm.pbf        # upazilas
osmium tags-filter admin.osm.pbf r/admin_level=8 -o unions.osm.pbf         # unions
osmium tags-filter admin.osm.pbf r/admin_level=10 -o wards.osm.pbf         # wards
```

## 3. Convert to GeoJSON

```bash
# Services (points) — ogr2ogr or osmium export
osmium export services.osm.pbf -o uploads/services.geojson --geometry-types=point
ogr2ogr -f GeoJSON uploads/Districts.geojson districts.osm.pbf
ogr2ogr -f GeoJSON uploads/divisions.geojson divisions.osm.pbf
# ... repeat for upazila, unions, wards
```

The resulting GeoJSON files are already in `uploads/`:
- `services.geojson` (1399 points: 924 toilets, 380 police, 90 fire stations, 5 wasa)
- `divisions.geojson` (24 polys), `Districts.geojson` (79), `upazila.geojson` (542), `unions.geojson` (1118), `wards.geojson` (37)

## 4. Import into the Application

```bash
cd server
node scripts/import-geojson.js
```

This script:
- Reads `uploads/services.geojson`
- Maps `amenity` → `emergency_services.type` (`toilets`→`public_toilet`, `police`→`police_station`, `fire_station`→`fire_service`, `office=water_utility`→`wasa`)
- Performs **point-in-polygon** against the admin GeoJSON to infer `district`/`division`/`upazila` for each service
- Upserts into `emergency_services` (with `district`, `division`, `upazila` columns)
- Result: `GET /api/services/nearby?lat=&lng=&type=` now returns OSM-accurate results

Verify:
```bash
curl "http://localhost:5000/api/services/nearby?lat=23.8669&lng=90.4005&radius=3000" | jq '.services | length'
curl "http://localhost:5000/geo/services.geojson" | head
```

## 5. Nominatim Geocoding (public API)

Custom address → lat/lng uses the **public Nominatim API** via a server proxy (`GET /api/geocode?q=`):

- The browser/mobile apps **never call Nominatim directly** (browsers cannot set the required `User-Agent`)
- The server at `server/src/index.js: /api/geocode` forwards with:
  `User-Agent: NagorikSheba/1.0 (student civic-tech project)` and `countrycodes=bd`
- Results are cached 24h in memory
- An optional `GOOGLE_GEOCODE_KEY` env var switches to Google Geocoding for street-level accuracy
- Reverse flow (complaint location preview) and custom address geocoding both use this endpoint

```
User custom address → compose "Road X, Area, District, Division, Bangladesh" + landmark
→ 4 progressively simpler Nominatim queries via /api/geocode
→ first hit pinned on map → Agent-5 routes by selected authority or nearest
```

## 6. Serving Raw GeoJSON

The raw files are statically served for map overlays or analysis:

```
GET /geo/services.geojson
GET /geo/divisions.geojson
GET /geo/Districts.geojson
GET /geo/upazila.geojson
GET /geo/unions.geojson
GET /geo/wards.geojson
```

Frontend can overlay ward/union boundaries on Leaflet/flutter_map if needed.
