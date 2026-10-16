// Prueba de carga: node load-test.mjs http://localhost:8787 CLAVE 100
const [base = 'http://localhost:8787', clave = '', n = '100'] = process.argv.slice(2);
const post = (p, b) => fetch(base + '/api/' + p, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
const t0 = Date.now(); const lat = []; let err = 0;
const timed = async f => { const t = Date.now(); try { const r = await f(); lat.push(Date.now() - t); return r; } catch (e) { err++; } };
const ids = [];
for (let i = 0; i < +n; i++) { const r = await timed(() => post('join', { name: 'Carga ' + i, lic: 'Matemáticas', av: i % 8 })); if (r && r.id) ids.push(r.id); }
console.log('unidos', ids.length);
await post('admin', { a: 'goto', p: { step: 1 }, clave });
const end = Date.now() + 30000;
await Promise.all(ids.map(async (id, i) => {
  await timed(() => post('answer', { id, stepId: 'm2-d', v: 5 + (i % 40) }));
  while (Date.now() < end) { await timed(() => post('view', { id })); await new Promise(r => setTimeout(r, 4000 + Math.random() * 500)); }
}));
lat.sort((a, b) => a - b);
console.log('peticiones', lat.length, 'errores', err, 'p50', lat[lat.length >> 1], 'ms  p95', lat[Math.floor(lat.length * .95)], 'ms  max', lat[lat.length - 1], 'ms');
await post('admin', { a: 'reset', clave });
