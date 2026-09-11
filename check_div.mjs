import fs from 'fs';
const files = ['uploads/divisions.geojson','uploads/Districts.geojson'];
for (const f of files) {
  const data = JSON.parse(fs.readFileSync(f,'utf-8'));
  console.log(`\n=== ${f} ===`);
  for (let i=0; i<2; i++) {
    const p = data.features[i].properties;
    console.log(`  keys: ${Object.keys(p).join(', ')}`);
    console.log(`  name=${p.name} | name:en=${p['name:en']} | name:bn=${p['name:bn']} | ISO=${p['ISO3166-2']} | alt_name=${p.alt_name}`);
  }
}
