const D = require('better-sqlite3');
const d = new D('data/nagorik.db', { readonly: true });
const out = {};
for (const cid of [1, 7]) {
  const auth = d.prepare('SELECT authority_id FROM complaints WHERE complaint_id=?').get(cid).authority_id;
  out[cid] = {};
  for (const role of ['field', 'mid', 'mayor']) {
    out[cid][role] = d.prepare('SELECT staff_id, email FROM staff WHERE authority_id=? AND staff_role=? ORDER BY staff_id LIMIT 1').get(auth, role);
  }
}
console.log(JSON.stringify(out));
