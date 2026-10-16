/* Estadística básica compartida por el navegador y por el servidor (UMD). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Stats = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const sorted = a => a.slice().sort((x, y) => x - y);
  const sum = a => a.reduce((s, v) => s + v, 0);
  const mean = a => sum(a) / a.length;
  // Percentil con interpolación lineal, igual que CUARTIL.INC y PERCENTIL.INC.
  const quant = (a, p) => {
    const s = sorted(a), h = (s.length - 1) * p, l = Math.floor(h), u = Math.ceil(h);
    return s[l] + (s[u] - s[l]) * (h - l);
  };
  const median = a => quant(a, 0.5);
  const modes = a => {
    const m = new Map(); a.forEach(v => m.set(v, (m.get(v) || 0) + 1));
    let best = 0; m.forEach(c => { best = Math.max(best, c); });
    if (best < 2) return [];
    return Array.from(m).filter(e => e[1] === best).map(e => e[0]).sort((x, y) => x - y);
  };
  const ss = a => { const m = mean(a); return sum(a.map(v => (v - m) * (v - m))); };
  const varS = a => ss(a) / (a.length - 1);
  const sdS = a => Math.sqrt(varS(a));
  const sdP = a => Math.sqrt(ss(a) / a.length);
  function summary(a) {
    const s = sorted(a), n = s.length;
    const q1 = quant(s, 0.25), q3 = quant(s, 0.75), iqr = q3 - q1;
    const fLo = q1 - 1.5 * iqr, fHi = q3 + 1.5 * iqr;
    return {
      n, mean: mean(s), median: median(s), modes: modes(s), min: s[0], max: s[n - 1], range: s[n - 1] - s[0],
      q1, q3, iqr, sdS: n > 1 ? sdS(s) : NaN, sdP: sdP(s), fLo, fHi,
      outliers: s.filter(v => v < fLo || v > fHi)
    };
  }
  // Lee números de un texto pegado: separa por espacios, saltos de línea o punto y coma. La coma es decimal.
  // Si solo hay una "palabra" con comas, se toma la coma como separador de lista.
  function parseNums(text) {
    let toks = String(text || '').split(/[\s;]+/).filter(Boolean);
    if (toks.length === 1 && toks[0].indexOf(',') >= 0 && /^[\d.,\-\s]+$/.test(toks[0])) toks = toks[0].split(',').filter(Boolean);
    const nums = [], bad = [];
    toks.forEach(t => {
      const c = t.replace(',', '.');
      if (/^-?\d+(\.\d+)?$/.test(c) || /^-?\.\d+$/.test(c)) nums.push(parseFloat(c)); else bad.push(t);
    });
    return { nums, bad };
  }
  // Número para mostrar con coma decimal y sin ceros sobrantes.
  function fmt(v, d) {
    if (v === undefined || v === null || Number.isNaN(v)) return '';
    const dd = d === undefined ? 2 : d;
    let s = (Math.round(v * Math.pow(10, dd)) / Math.pow(10, dd)).toFixed(dd);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }
  // Lee la respuesta escrita por una persona: acepta coma o punto decimal.
  function parseAnswer(t) {
    const c = String(t || '').trim().replace(/\s+/g, '').replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(c)) return NaN;
    return parseFloat(c);
  }
  return { sorted, sum, mean, quant, median, modes, varS, sdS, sdP, summary, parseNums, fmt, parseAnswer };
});
