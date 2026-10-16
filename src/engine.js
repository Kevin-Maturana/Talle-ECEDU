/* Motor del juego: puntajes, rachas, insignias y la vista que recibe cada pantalla.
   Es puro (sin DOM) para poder usarlo igual en el navegador y, más adelante, en el servidor. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./stats.js'));
  else root.Engine = factory(root.Stats);
})(typeof self !== 'undefined' ? self : this, function (Stats) {
  const SCORED = { choice: 1, number: 1, balance: 1, tap: 1 };
  const isScored = s => !!(s && SCORED[s.kind]);
  const PARTICIPATION = 20;

  function grade(s, v) {
    if (s.kind === 'choice' || s.kind === 'tap') return Number(v) === s.ok;
    if (s.kind === 'number' || s.kind === 'balance') return Math.abs(Number(v) - s.ok) <= ((s.tol !== undefined ? s.tol : 0.005) + 1e-9);
    return false;
  }
  const speedBonus = (t, dur) => (dur > 0 ? Math.round(50 * Math.max(0, 1 - t / dur)) : 0);
  const visible = (i, state, steps) => i < state.step || (i === state.step && (state.phase === 'revealed' || !isScored(steps[i])));

  /* Puntaje de una persona sobre los pasos que cumplan vis(i). */
  function scoreUser(steps, u, vis) {
    let pts = 0, streak = 0, best = 0, correct = 0, answered = 0, scoredSeen = 0, voice = 0;
    const per = {};
    steps.forEach((s, i) => {
      if (!vis(i)) return;
      const a = u.answers[s.id];
      if (isScored(s)) {
        scoredSeen++;
        if (!a) { streak = 0; return; }
        answered++;
        if (a.ok) {
          streak++; best = Math.max(best, streak); correct++;
          const bonus = Math.min(5, streak - 1) * 10;
          per[s.id] = { ok: true, base: 100, speed: a.sp, streak: bonus, pts: 100 + a.sp + bonus };
        } else { streak = 0; per[s.id] = { ok: false, base: 0, speed: 0, streak: 0, pts: 0 }; }
        pts += per[s.id].pts;
      } else if (a && (s.kind === 'cloud' || s.kind === 'datum' || s.kind === 'text')) { pts += PARTICIPATION; voice++; per[s.id] = { ok: null, pts: PARTICIPATION }; }
    });
    return { pts, streak, best, correct, answered, scoredSeen, voice, per };
  }
  function rankRows(rows) {
    rows.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name, 'es'));
    let r = 0, last = null;
    rows.forEach((x, i) => { if (x.pts !== last) { r = i + 1; last = x.pts; } x.rank = r; });
    return rows;
  }
  const normWord = w => String(w || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, '').trim().replace(/\s+/g, ' ');
  const cleanWord = w => String(w || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);

  function aggregateCloud(users, id) {
    const m = new Map();
    users.forEach(u => { const a = u.answers[id]; if (!a || !Array.isArray(a.v)) return; const seen = new Set(); a.v.forEach(w => { const k = normWord(w); if (!k || seen.has(k)) return; seen.add(k); const e = m.get(k) || { w: cleanWord(w), c: 0 }; e.c++; m.set(k, e); }); });
    return Array.from(m.values()).sort((a, b) => b.c - a.c || a.w.localeCompare(b.w, 'es')).slice(0, 60);
  }
  function dataOf(users, id) { const out = []; users.forEach(u => { const a = u.answers[id]; if (a && Number.isFinite(Number(a.v))) out.push(Number(a.v)); }); return out.sort((x, y) => x - y); }

  /* ---------- pasos que se calculan con los datos del grupo ---------- */
  const FALLBACK = [3, 5, 6, 8, 9, 10, 10, 12, 14, 15, 18, 20, 22, 40];
  const tpl = (str, v) => String(str).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m));
  function groupVars(data) {
    const a = data.length >= 4 ? data.slice().sort((x, y) => x - y) : FALLBACK.slice(), sm = Stats.summary(a), f = Stats.fmt;
    const within = a.filter(v => Math.abs(v - sm.mean) <= sm.sdS).length;
    const v = { n: a.length, sum: f(Stats.sum(a), 1), mean: f(sm.mean, 1), median: f(sm.median, 1), sd: f(sm.sdS, 1), range: f(sm.range, 1), min: f(sm.min, 1), max: f(sm.max, 1), q1: f(sm.q1, 1), q3: f(sm.q3, 1), iqr: f(sm.iqr, 1), fHi: f(sm.fHi, 1), nout: sm.outliers.length, outs: sm.outliers.map(x => f(x, 0)).join(', '), outtxt: sm.outliers.length === 0 ? 'sin valores atípicos' : sm.outliers.length === 1 ? 'un valor atípico: ' + f(sm.outliers[0], 0) : sm.outliers.length + ' valores atípicos: ' + sm.outliers.map(x => f(x, 0)).join(', '), within, pct: Math.round(100 * within / a.length), diff: f(Math.abs(sm.mean - sm.median), 1) };
    return { a, sm, v, fallback: data.length < 4 };
  }
  function resolve(s, data) {
    if (!s.calc) return s;
    const { a, sm, v } = groupVars(data), o = Object.assign({}, s), T = x => (typeof x === 'string' ? tpl(x, v) : x);
    ['prompt', 'context', 'exp', 'unit', 'hint'].forEach(k => { if (o[k]) o[k] = T(o[k]); });
    const lo = s.domain ? s.domain[0] : 0;
    o.domain = [lo, Math.max(s.domain ? s.domain[1] : 0, Math.ceil(sm.max / 5) * 5)];
    if (s.kind === 'balance') { o.values = a.slice(); o.start = Math.round(o.domain[1] * 0.85); o.tilt = true; }
    if (s.calc === 'mean') o.ok = sm.mean;
    else if (s.calc === 'median') o.ok = sm.median;
    else if (s.calc === 'range') o.ok = sm.range;
    else if (s.calc === 'sd') o.ok = sm.sdS;
    else if (s.calc === 'best') {
      const skew = sm.outliers.length > 0 || Math.abs(sm.mean - sm.median) > 0.2 * sm.sdS;
      o.options = s.options.slice(); o.ok = skew ? 1 : 2; o.exp = T(s.exps[skew ? 0 : 1]);
    } else if (s.calc === 'interp') {
      const rot = a.length % s.options.length, opts = s.options.map(T);
      o.options = opts.slice(rot).concat(opts.slice(0, rot)); o.ok = (s.okIndex - rot + opts.length) % opts.length;
    }
    delete o.exps; return o;
  }
  const PRIVATE = ['ok', 'exp', 'exps', 'tol', 'okIndex'];
  const publicStep = (s, keys) => { if (!s) return null; const o = Object.assign({}, s); if (!keys) PRIVATE.forEach(k => { delete o[k]; }); return o; };

  function badgesOf(row, fastestWins) {
    const b = [];
    if (fastestWins) b.push('rayo');
    if (row.best >= 5) b.push('racha5'); else if (row.best >= 3) b.push('racha3');
    if (row.scoredSeen >= 5 && row.answered === row.scoredSeen && row.correct === row.answered) b.push('precision');
    else if (row.scoredSeen >= 5 && row.answered === row.scoredSeen) b.push('constancia');
    if (row.voice >= 2) b.push('voz');
    return b;
  }

  function build(ctx) {
    const { steps, state, users, reacts, now, forId } = ctx;
    const idx = state.step, cur = idx >= 0 ? steps[idx] : null;
    const vis = i => visible(i, state, steps);
    const rows = users.map(u => ({ id: u.id, name: u.name, u, ...scoreUser(steps, u, vis) }));
    rankRows(rows);
    const byId = new Map(rows.map(r => [r.id, r]));

    // ranking anterior (sin el reto que se acaba de revelar) para mostrar subidas y bajadas
    let prevById = null;
    if (cur && isScored(cur) && state.phase === 'revealed') {
      const prev = users.map(u => ({ id: u.id, name: u.name, ...scoreUser(steps, u, i => i < idx) }));
      rankRows(prev); prevById = new Map(prev.map(r => [r.id, r.rank]));
    }

    // el más rápido en cada reto ya revelado
    const fastestOf = (s, i) => {
      if (!isScored(s) || !vis(i)) return null;
      let best = null;
      users.forEach(u => { const a = u.answers[s.id]; if (a && a.ok && (!best || a.t < best.t)) best = { id: u.id, n: u.name, av: u.av, t: a.t }; });
      return best;
    };
    const fastWins = new Set();
    steps.forEach((s, i) => { const f = fastestOf(s, i); if (f) fastWins.add(f.id); });

    const n = users.length;
    const answeredCnt = cur ? users.filter(u => u.answers[cur.id]).length : 0;
    const top = rows.slice(0, 10).map(r => ({ id: r.id, n: r.name, av: r.u.av, p: r.pts, rank: r.rank, d: prevById ? (prevById.get(r.id) || r.rank) - r.rank : 0 }));

    const board = {
      n, answered: answeredCnt, top,
      byLic: users.reduce((m, u) => { if (u.lic) m[u.lic] = (m[u.lic] || 0) + 1; return m; }, {}),
      people: users.slice(-120).map(u => ({ id: u.id, n: u.name, av: u.av, a: cur ? !!u.answers[cur.id] : false })),
      clouds: {}, data: {}, texts: {}, dist: null, fastest: null,
      react: countReacts(reacts, now), at: now
    };
    steps.forEach((s, i) => {
      if (i > idx) return;
      if (s.kind === 'cloud') board.clouds[s.id] = aggregateCloud(users, s.id);
      if (s.kind === 'datum') board.data[s.id] = dataOf(users, s.id);
      if (s.kind === 'text') { const L = []; users.forEach(u => { const a = u.answers[s.id]; if (a && typeof a.v === 'string') L.push({ id: u.id, n: u.name, av: u.av, t: a.v, at: a.t }); }); L.sort((x, y) => y.at - x.at); board.texts[s.id] = { n: L.length, list: L.slice(0, 30) }; }
    });
    if (cur && isScored(cur) && state.phase === 'revealed') {
      const counts = {}; let correct = 0, tot = 0;
      users.forEach(u => { const a = u.answers[cur.id]; if (!a) return; tot++; if (a.ok) correct++; const k = cur.kind === 'choice' || cur.kind === 'tap' ? String(Number(a.v)) : String(Math.round(Number(a.v) * 100) / 100); counts[k] = (counts[k] || 0) + 1; });
      board.dist = { n: tot, correct, counts };
      board.fastest = fastestOf(cur, idx);
    }
    const reveal = cur && isScored(cur) && state.phase === 'revealed' ? { ok: cur.ok, exp: cur.exp } : null;

    const view = { now, state, board, reveal, total: steps.length, cur: publicStep(cur, !!ctx.admin || (cur && isScored(cur) && state.phase === 'revealed')) };
    if (forId) {
      const r = byId.get(forId);
      if (r) {
        const answers = {};
        steps.forEach((s, i) => {
          const a = r.u.answers[s.id]; if (!a) return;
          const o = { v: a.v, t: a.t };
          if (isScored(s) && vis(i)) { const p = r.per[s.id]; if (p) { o.ok = p.ok; o.pts = p.pts; o.parts = p; } }
          answers[s.id] = o;
        });
        view.me = { id: r.id, name: r.name, av: r.u.av, pts: r.pts, rank: r.rank, streak: r.streak, best: r.best, answers, badges: badgesOf(r, fastWins.has(r.id)), delta: prevById ? (prevById.get(r.id) || r.rank) - r.rank : 0 };
      }
    }
    if (ctx.admin) {
      view.roster = rows.map(r => ({ id: r.id, n: r.name, l: r.u.lic || '', av: r.u.av, p: r.pts, rank: r.rank, a: cur ? !!r.u.answers[cur.id] : false, correct: r.correct, answered: r.answered, bot: !!r.u.bot, badges: badgesOf(r, fastWins.has(r.id)) }));
    }
    return view;
  }
  function countReacts(reacts, now) {
    const c = { ok: 0, wow: 0, ask: 0, slow: 0 }, seen = {};
    (reacts || []).forEach(r => { if (now - r.t <= 25000) { const key = r.id + r.k; if (seen[key]) return; seen[key] = 1; if (c[r.k] !== undefined) c[r.k]++; } });
    return c;
  }
  return { build, resolve, groupVars, dataOf, publicStep, grade, speedBonus, isScored, visible, scoreUser, rankRows, normWord, cleanWord, PARTICIPATION };
});
