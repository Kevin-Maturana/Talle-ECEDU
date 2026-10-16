/* Sala local de demostración: guarda el estado, atiende a los participantes y simula un grupo.
   La pantalla del docente y la del participante hablan con ella igual que hablarán con el servidor. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.LocalHub = factory(root.Engine);
})(typeof self !== 'undefined' ? self : this, function (Engine) {
  const NAMES = ['Yuliana Mosquera', 'Kevin Rentería', 'Laura Asprilla', 'Jhon Córdoba', 'Daniela Palacios', 'Carlos Moreno', 'Ana María Valencia', 'Luis Hinestroza', 'Sofía Perea', 'Mateo Rivas', 'Valentina Murillo', 'Brayan Lemos', 'Camila Cuesta', 'Duván Mena', 'Isabela Rentería', 'Santiago Ibargüen', 'Mariana Becerra', 'Johan Ramos', 'Paola Quejada', 'Andrés Salas', 'Lorena Mosquera', 'Edwin Torres', 'Karen Blandón', 'Yeison Palacios', 'Natalia Rojas', 'Wilmer Copete', 'Tatiana Lozano', 'Héctor Arias', 'Jessica Mena', 'Fabián Cabezas', 'Liliana Orejuela', 'Óscar Ayala', 'Diana Chaverra', 'Ramón Giraldo', 'Estefanía Cruz', 'Julián Machado', 'Mónica Serna', 'Pablo Asprilla'];
  const LICS = ['Lengua Extranjera', 'Matemáticas', 'Filosofía', 'Etnoeducación', 'Educación Infantil'];
  const WORDS = ['promedio', 'tablas', 'investigación', 'gráficos', 'datos', 'incertidumbre', 'encuestas', 'variables', 'tendencia', 'muestra', 'medición', 'resultados', 'Excel', 'evidencia', 'patrones', 'análisis', 'conclusiones', 'comunidad', 'educación', 'datos', 'promedio', 'análisis', 'gráficos', 'evidencia', 'tablas'];
  const PHRASES = ['En promedio el grupo estudia unas 18 horas por semana, pero los datos son muy distintos entre sí. Como docente, no dejaría la misma carga de tareas para todos.', 'La mediana es menor que la media porque unas pocas personas estudian muchas horas. Como futuro docente, reportaría las dos medidas.', 'La mitad del grupo estudia 15 horas o menos, así que la media exagera un poco al grupo típico. Revisaría cuánto tiempo real exigen mis actividades.', 'Hay mucha dispersión: unas personas estudian muy poco y otras muchísimo. Como docente, formaría grupos de apoyo según el tiempo que dedican.', 'Para describir al grupo conviene la mediana porque hay valores atípicos. Como futuro docente, me preguntaría por qué esas personas estudian tanto más.', 'El grupo es heterogéneo en sus horas de estudio, y eso importa para planear tutorías y evaluaciones.'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const norm = s => String(s || '').trim().replace(/\s+/g, ' ');
  const slug = s => norm(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-');

  function create(steps, opts) {
    opts = opts || {};
    const CLAVE = opts.clave || 'ecedu2026';
    const state = { step: -1, maxStep: -1, phase: 'lobby', openedAt: 0, dur: 0, v: 0, theme: opts.theme || 'ecedu' };
    const THEMES = ['ecedu', 'unad', 'selva', 'grafito'], resolved = new Map();
    const eff = () => steps.map(x => resolved.get(x.id) || x);
    const users = new Map(), subs = new Set();
    let reacts = [], eid = 0, botTimer = null, seq = 0;
    const emit = () => subs.forEach(f => { try { f(); } catch (e) { /* ignora */ } });
    const bump = () => { state.v++; emit(); };
    const list = () => Array.from(users.values());
    const cur = () => (state.step >= 0 ? (resolved.get(steps[state.step].id) || steps[state.step]) : null);
    const expired = () => state.dur > 0 && Date.now() > state.openedAt + state.dur + 800;

    function join(p) {
      const name = norm(p.name).slice(0, 40);
      if (name.length < 2) return { ok: false, error: 'Escribe tu nombre (mínimo 2 letras).' };
      const key = slug(name);
      const same = list().find(u => slug(u.name) === key);
      if (same) { if (p.claim) return { ok: true, id: same.id, name: same.name }; return { ok: false, error: 'exists', name: same.name }; }
      const id = 'u' + (++seq) + Math.random().toString(36).slice(2, 6);
      users.set(id, { id, name, lic: norm(p.lic).slice(0, 60), av: Number.isInteger(p.av) ? p.av % 8 : seq % 8, answers: {}, joined: Date.now(), bot: !!p.bot, lastReact: 0 });
      bump();
      return { ok: true, id, name };
    }
    function answer(id, stepId, v) {
      const u = users.get(id), s = cur();
      if (!u) return { ok: false, error: 'No estás en la sala.', gone: true };
      if (!s || s.id !== stepId) return { ok: false, error: 'Esta actividad ya cambió.' };
      if (Engine.isScored(s)) {
        if (state.phase !== 'open' || expired()) return { ok: false, error: 'El tiempo terminó.' };
        if (u.answers[s.id]) return { ok: true, sent: true };
        const t = Date.now() - state.openedAt, num = Number(v);
        if (!Number.isFinite(num)) return { ok: false, error: 'Respuesta no válida.' };
        u.answers[s.id] = { v: num, t, ok: Engine.grade(s, num), sp: Engine.speedBonus(t, state.dur) };
      } else if (s.kind === 'cloud') {
        const words = (Array.isArray(v) ? v : [v]).map(Engine.cleanWord).filter(Boolean).slice(0, 3);
        if (!words.length) return { ok: false, error: 'Escribe al menos una palabra.' };
        u.answers[s.id] = { v: words, t: Date.now() - state.openedAt };
      } else if (s.kind === 'datum') {
        const num = Number(v);
        if (!Number.isFinite(num) || num < (s.min ?? -1e9) || num > (s.max ?? 1e9)) return { ok: false, error: 'Escribe un número entre ' + s.min + ' y ' + s.max + '.' };
        u.answers[s.id] = { v: Math.round(num * 10) / 10, t: Date.now() - state.openedAt };
      } else if (s.kind === 'text') {
        const t = String(v === undefined || v === null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
        if (t.length < 8) return { ok: false, error: 'Escribe una frase de al menos 8 letras.' };
        u.answers[s.id] = { v: t, t: Date.now() - state.openedAt };
      } else return { ok: false, error: 'Aquí no se responde.' };
      bump();
      return { ok: true, sent: true };
    }
    function react(id, k) {
      const u = users.get(id); if (!u || !['ok', 'wow', 'ask', 'slow'].includes(k)) return { ok: false };
      const t = Date.now(); if (t - u.lastReact < 500) return { ok: true };
      u.lastReact = t; reacts.push({ eid: ++eid, k, id, t, n: u.name, av: u.av });
      reacts = reacts.filter(r => t - r.t < 30000).slice(-200);
      emit(); return { ok: true };
    }
    const view = id => (users.has(id) || !id) ? Engine.build({ steps: eff(), state: { ...state }, users: list(), reacts, now: Date.now(), forId: id }) : null;
    const adminView = () => ({ ...Engine.build({ steps: eff(), state: { ...state }, users: list(), reacts, now: Date.now(), admin: true }), recent: reacts.filter(r => Date.now() - r.t < 8000) });

    function goto(i) {
      i = Math.max(-1, Math.min(steps.length - 1, i));
      state.step = i; state.maxStep = Math.max(state.maxStep, i);
      const s = steps[i];
      if (s && s.calc) resolved.set(s.id, Engine.resolve(s, Engine.dataOf(list(), s.src)));
      if (i < 0) { state.phase = 'lobby'; state.dur = 0; }
      else if (Engine.isScored(s)) { state.phase = i < state.maxStep || visitedBefore(i) ? 'revealed' : 'ready'; state.dur = 0; }
      else { state.phase = 'open'; state.dur = 0; }
      state.openedAt = Date.now();
    }
    const seen = new Set();
    const visitedBefore = i => { const was = seen.has(i); seen.add(i); return was; };
    function admin(a, p) {
      p = p || {};
      if (p.clave !== undefined && p.clave !== CLAVE) return { ok: false, status: 401 };
      const s = cur();
      if (a === 'next') goto(state.step + 1);
      else if (a === 'prev') goto(state.step - 1);
      else if (a === 'goto') goto(Number(p.step));
      else if (a === 'start' && s && Engine.isScored(s) && state.phase === 'ready') { state.phase = 'open'; state.openedAt = Date.now(); state.dur = (s.secs || 45) * 1000; }
      else if (a === 'close' && state.phase === 'open') state.phase = 'closed';
      else if (a === 'extend' && s && Engine.isScored(s) && state.phase !== 'revealed' && state.phase !== 'ready') { const left = state.openedAt + state.dur - Date.now(); state.dur += Math.max(0, 30000 - Math.max(0, left)) + (left < 0 ? -left : 0); state.phase = 'open'; }
      else if (a === 'reveal' && s && Engine.isScored(s) && (state.phase === 'open' || state.phase === 'closed')) state.phase = 'revealed';
      else if (a === 'reset') { users.clear(); reacts = []; resolved.clear(); seen.clear(); Object.assign(state, { step: -1, maxStep: -1, phase: 'lobby', openedAt: 0, dur: 0, v: state.v }); if (botsOn()) addBots(botsOn()); }
      else if (a === 'theme' && THEMES.includes(p.theme)) state.theme = p.theme;
      else if (a === 'export') return { ok: true, csv: csv() };
      else return { ok: a === 'status' };
      if (a === 'next' || a === 'goto' || a === 'prev') visitedBefore(state.step);
      bump(); return { ok: true };
    }
    function csv() {
      const v = adminView(), q = x => '"' + String(x).replace(/"/g, '""') + '"';
      const head = ['Puesto', 'Nombre', 'Licenciatura', 'Puntos', 'Aciertos', 'Respondidas', 'Insignias'];
      return '﻿' + [head.map(q).join(';')].concat(v.roster.map(r => [r.rank, r.n, r.l, r.p, r.correct, r.answered, r.badges.join(' ')].map(q).join(';'))).join('\n');
    }

    /* ---------- grupo simulado ---------- */
    const botDelay = new Map();
    const botsOn = () => list().filter(u => u.bot).length;
    function addBots(n) {
      const have = botsOn();
      for (let i = 0; i < n; i++) {
        const nm = NAMES[(have + i) % NAMES.length] + (have + i >= NAMES.length ? ' ' + (Math.floor((have + i) / NAMES.length) + 1) : '');
        const r = join({ name: nm, lic: pick(LICS), av: Math.floor(Math.random() * 8), bot: true });
        if (r.ok) users.get(r.id).skill = rnd(0.4, 0.95);
      }
      startBotLoop(); bump();
    }
    function removeBots() { list().filter(u => u.bot).forEach(u => users.delete(u.id)); bump(); }
    function startBotLoop() { if (!botTimer) botTimer = setInterval(botTick, 500); }
    function wrong(s, u) {
      if (s.kind === 'choice') { const o = s.options.map((_, i) => i).filter(i => i !== s.ok); return pick(o); }
      if (s.kind === 'tap') { const o = (s.values || []).filter(v => v !== s.ok); return pick(o.length ? o : [s.ok + 1]); }
      if (s.kind === 'balance') return Math.round((s.ok + pick([-2, -1.4, -1, 1, 1.5, 2.5])) * 10) / 10;
      return Math.round((s.ok + pick([-2, -1, -0.5, 0.5, 1, 2, 3])) * 100) / 100;
    }
    function botTick() {
      const s = cur(); if (!s) return;
      const now = Date.now();
      list().filter(u => u.bot).forEach(u => {
        if (u.answers[s.id]) return;
        const key = u.id + s.id;
        if (Engine.isScored(s)) {
          if (state.phase !== 'open' || expired()) return;
          if (!botDelay.has(key)) botDelay.set(key, rnd(1800, Math.max(4000, state.dur * 0.85)));
          if (now - state.openedAt < botDelay.get(key)) return;
          const good = Math.random() < u.skill * (s.dataset ? 0.7 : 0.95);
          answer(u.id, s.id, good ? s.ok : wrong(s, u));
        } else if (s.kind === 'cloud') {
          if (!botDelay.has(key)) botDelay.set(key, rnd(1500, 16000));
          if (now - state.openedAt < botDelay.get(key)) return;
          const pool = s.botWords || WORDS; answer(u.id, s.id, s.botWords ? [pick(pool)] : [pick(pool), Math.random() < 0.3 ? pick(pool) : null].filter(Boolean));
        } else if (s.kind === 'text') {
          if (!botDelay.has(key)) botDelay.set(key, rnd(3000, 30000));
          if (now - state.openedAt < botDelay.get(key)) return;
          answer(u.id, s.id, pick(s.botPhrases || PHRASES));
        } else if (s.kind === 'datum') {
          if (!botDelay.has(key)) botDelay.set(key, rnd(1500, 14000));
          if (now - state.openedAt < botDelay.get(key)) return;
          const idx = list().filter(x => x.bot).indexOf(u);
          const sc = (s.domain ? s.domain[1] : 60) / 60, cap = s.max ?? 100; const v = Math.min(cap, idx === 3 ? Math.round(58 * sc) : idx === 11 ? Math.round(70 * sc) : Math.max(0, Math.min(Math.round(45 * sc), Math.round((18 + (Math.random() + Math.random() + Math.random() - 1.5) * 16) * sc))));
          answer(u.id, s.id, v);
        }
      });
      if (s.kind === 'concept' && Math.random() < 0.35) { const b = pick(list().filter(u => u.bot) || []); if (b) react(b.id, pick(['ok', 'ok', 'ok', 'wow', 'ask', 'ok', 'slow'])); }
    }
    return { state, steps, join, answer, react, view, adminView, admin, addBots, removeBots, botsOn, subscribe: f => { subs.add(f); return () => subs.delete(f); }, clave: CLAVE, now: () => Date.now() };
  }
  return { create };
});
