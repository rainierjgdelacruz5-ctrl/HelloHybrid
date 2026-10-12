// Run from the customer-portal folder:  node make-photo-list.js
// Writes images/items/index.json = { "kiwi-fruit-soda": "kiwi-fruit-soda.webp", ... } so the menu only asks for photos that exist.
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'images', 'items');
const map = {};
for (const f of fs.readdirSync(dir)) {
  const m = f.match(/^(.+)\.(jpe?g|png|webp|avif|gif)$/i);
  if (!m) continue;
  const key = m[1].toLowerCase();
  // if the same name exists in two formats, prefer jpg > webp > png
  const rank = e => ({ jpg: 0, jpeg: 0, webp: 1, png: 2 }[e.toLowerCase()] ?? 3);
  if (!map[key] || rank(m[2]) < rank(map[key].split('.').pop())) map[key] = f;
}
fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(map, null, 2));
console.log(`Wrote images/items/index.json with ${Object.keys(map).length} photos`);
