import { DurableObject } from 'cloudflare:workers';
import Hub from './hub.js';
import CONTENT from './content.json';

const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export class Taller extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.clave = String(env.DOCENTE_CLAVE || '');
    this.hub = Hub.create(CONTENT.steps, { clave: this.clave || 'sin-clave-configurada' });
  }
  async fetch(request) {
    const path = new URL(request.url).pathname.replace(/^\/api\//, '');
    let b = {};
    try { b = await request.json(); } catch (e) { /* sin cuerpo */ }
    const h = this.hub, now = Date.now();
    switch (path) {
      case 'join': return json(h.join({ name: b.name, lic: b.lic, av: b.av, claim: !!b.claim }));
      case 'view': return json({ view: h.view(String(b.id || '')), now });
      case 'answer': return json(h.answer(String(b.id || ''), String(b.stepId || ''), b.v));
      case 'react': return json(h.react(String(b.id || ''), String(b.k || '')));
      case 'adminview':
      case 'admin': {
        if (!this.clave || b.clave !== this.clave) return json({ ok: false }, 401);
        if (path === 'adminview') return json({ view: h.adminView(), now });
        const p = Object.assign({}, b.p || {}, { clave: this.clave });
        return json(h.admin(String(b.a || ''), p));
      }
      default: return json({ ok: false }, 404);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      if (request.method !== 'POST') return json({ ok: false }, 405);
      return env.TALLER.getByName('principal').fetch(request);
    }
    return env.ASSETS.fetch(request);
  }
};
