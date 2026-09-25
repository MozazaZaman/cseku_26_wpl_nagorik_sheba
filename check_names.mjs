import fs from 'fs';
import path from 'path';
const base = 'uploads';
for (const f of ['upazila.geojson', 'unions.geojson', 'wards.geojson']) {
  const data = JSON.parse(fs.readFileSync(path.join(base, f), 'utf-8'));
  console.log(`\n=== ${f} ===`);
  for (let i=0; i<3; i++) {
    const p = data.features[i].properties;
    console.log(`  name=${p.name} | name:en=${p['name:en']} | name:bn=${p['name:bn']} | type=${p.type} | admin_level=${p.admin_level}`);
  }
}
