// MAIARC Miami — servidor del panel de administración.
// La web pública son archivos estáticos (ASSETS). Este Worker solo atiende /api/*.
// Secretos necesarios (Cloudflare → Worker → Settings → Variables and Secrets):
//   ADMIN_PASSWORD  contraseña del panel
//   GITHUB_TOKEN    token de GitHub con permiso de escritura en el repositorio
// Binding de IA (wrangler.jsonc): AI, para las traducciones automáticas.

const REPO = 'iariicorrea/MAIARCMIAMI';
const BRANCH = 'main';
const CONTENT_PATH = 'content/props.js';
// Datos internos (ej.: nombre real de la propiedad). Nunca se publican: el archivo está en .assetsignore
// y solo se lee con la contraseña del panel.
const PRIVATE_PATH = 'content/interno.json';
const SESSION_HOURS = 12;
const SITE = 'https://miami.maiarconcierge.com';
import { ZONAS } from '../content/zonas.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/sitemap.xml') return sitemap(env, req);
    if (/^\/(casas|zonas)\//.test(url.pathname)) return seoPage(env, req, url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url);
    } catch (e) {
      return json({ error: e.message || String(e) }, e.status || 500);
    }
  },
};

async function api(req, env, url) {
  const route = url.pathname.replace(/^\/api\//, '');
  if (route === 'login' && req.method === 'POST') {
    if (!env.ADMIN_PASSWORD) throw err('Falta configurar ADMIN_PASSWORD en Cloudflare.', 500);
    const { password } = await req.json();
    if (!password || !(await safeEqual(password, env.ADMIN_PASSWORD))) {
      await new Promise((r) => setTimeout(r, 800));
      throw err('Contraseña incorrecta.', 401);
    }
    return json({ token: await makeToken(env) });
  }

  await requireAuth(req, env);

  if (route === 'content' && req.method === 'GET') {
    const file = await gh(env, `contents/${CONTENT_PATH}?ref=${BRANCH}`);
    const text = b64decodeUtf8(file.content);
    return json({ data: parseContent(text), sha: file.sha, priv: await readPrivate(env) });
  }

  if (route === 'blob' && req.method === 'POST') {
    // Cuerpo: la foto en base64 (texto plano). Se reenvía a GitHub sin procesarla.
    const b64 = await req.text();
    if (!b64 || b64.length > 30_000_000 || !/^[A-Za-z0-9+/=\s]+$/.test(b64.slice(0, 2000))) throw err('Foto inválida.', 400);
    const blob = await gh(env, 'git/blobs', { method: 'POST', body: '{"encoding":"base64","content":"' + b64.replace(/\s/g, '') + '"}' });
    return json({ sha: blob.sha });
  }

  if (route === 'publish' && req.method === 'POST') {
    const body = await req.json();
    let data = body.data;
    if (!data || !Array.isArray(data.props)) throw err('Datos inválidos.', 400);
    validate(data);
    const blobs = [];
    for (const b of body.blobs || []) {
      if (!/^img\/[a-z0-9-]+\.jpg$/.test(b.path) || !/^[0-9a-f]{40}$/.test(b.sha)) throw err('Foto inválida: ' + b.path, 400);
      blobs.push(b);
    }
    const deletes = (body.deletes || []).filter((p) => /^img\/[a-z0-9-]+\.jpg$/.test(p));
    // Base: la versión que tenía cargada el panel. Si mientras tanto se publicó otra cosa
    // (otra pestaña u otra persona), se combinan los cambios propiedad por propiedad.
    let base = null;
    if (body.baseSha && /^[0-9a-f]{40}$/.test(body.baseSha)) {
      try { const bb = await gh(env, `git/blobs/${body.baseSha}`); base = parseContent(b64decodeUtf8(bb.content)); } catch (e) { base = null; }
    }
    let merged = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = await gh(env, `git/ref/heads/${BRANCH}`);
      const parent = ref.object.sha;
      const curFile = await gh(env, `contents/${CONTENT_PATH}?ref=${parent}`);
      let out = data;
      const conflicts = [];
      if (body.baseSha && curFile.sha !== body.baseSha) {
        const theirs = parseContent(b64decodeUtf8(curFile.content));
        out = mergeProps(base, data, theirs, conflicts);
        merged = true;
      }
      // Portada y tarjeta siempre apuntan a una foto que existe
      out.props.forEach((p) => { const ids = (p.photos || []).map((f) => f.id); if (p.feat && !ids.includes(p.feat)) p.feat = ids[0] || ''; if (p.card && !ids.includes(p.card)) p.card = ids[0] || ''; });
      validate(out);
      // Nunca borrar una foto que alguna casa siga usando
      const used = new Set(out.props.flatMap((p) => (p.photos || []).map((f) => 'img/' + f.id + '.jpg')));
      const safeDeletes = deletes.filter((d) => !used.has(d));
      const files = [{ path: CONTENT_PATH, content: 'window.SITE_PROPS=' + JSON.stringify(out, null, 1) + ';\n', encoding: 'utf-8' }];
      if (body.priv && typeof body.priv === 'object') {
        const ids = new Set(out.props.map((p) => p.id));
        const priv = { ...(await readPrivate(env)), ...cleanPrivate(body.priv) };
        Object.keys(priv).forEach((id) => { if (!ids.has(id) || !priv[id].real) delete priv[id]; });
        files.push({ path: PRIVATE_PATH, content: JSON.stringify(priv, null, 1) + '\n', encoding: 'utf-8' });
      }
      try {
        const r = await commit(env, files, blobs, safeDeletes, body.message || 'Actualización desde el panel', parent);
        return json({ ok: true, commit: r.commit, sha: r.fileSha, data: out, merged, conflicts });
      } catch (e) {
        if (e.status === 409 && attempt < 2) continue; // otra publicación entró justo antes: reintentar
        throw e;
      }
    }
  }

  if (route === 'describe' && req.method === 'POST') {
    const body = await req.json();
    const images = (body.images || []).filter((x) => typeof x === 'string' && x.length < 6_000_000).slice(0, 4);
    const text = String(body.text || '').slice(0, 8000);
    if (!images.length && !text.trim()) throw err('Subí una captura o pegá el texto.', 400);
    return json(await describe(env, images, text, body.name || ''));
  }

  if (route === 'translate' && req.method === 'POST') {
    const { texts, to } = await req.json();
    if (!Array.isArray(texts) || !['en', 'pt'].includes(to)) throw err('Pedido inválido.', 400);
    return json({ texts: await translate(env, texts, to) });
  }

  throw err('No encontrado.', 404);
}

// ---------- Contenido ----------
// Combina por propiedad: lo que este panel cambió (respecto de su base) gana;
// lo demás se toma de la versión publicada más reciente.
function mergeProps(base, mine, theirs, conflicts = []) {
  const key = (x) => JSON.stringify(x === undefined ? null : x);
  const B = new Map(((base && base.props) || []).map((p) => [p.id, p]));
  const M = new Map(mine.props.map((p) => [p.id, p]));
  const T = theirs.props || [];
  const out = [];
  const seen = new Set();
  for (const t of T) {
    seen.add(t.id);
    const b = B.get(t.id);
    if (M.has(t.id)) {
      const m = M.get(t.id);
      if (!b) { out.push(m); continue; }
      if (key(b) === key(m)) { out.push(t); continue; }      // yo no la toqué
      if (key(b) === key(t)) { out.push(m); continue; }      // el otro no la tocó
      // Los dos editaron la misma casa: combinar campo por campo
      const r = {};
      for (const k of new Set([...Object.keys(b), ...Object.keys(m), ...Object.keys(t)])) {
        const mc = key(m[k]) !== key(b[k]), tc = key(t[k]) !== key(b[k]);
        if (mc && tc && key(m[k]) !== key(t[k])) {
          if (k === 'photos') { // unir fotos: mi orden + las que agregó el otro
            const mine = m.photos || [], ids = new Set(mine.map((f) => f.id)), bIds = new Set((b.photos || []).map((f) => f.id)), tIds = new Set((t.photos || []).map((f) => f.id));
            r.photos = [...mine.filter((f) => !(bIds.has(f.id) && !tIds.has(f.id))), ...(t.photos || []).filter((f) => !ids.has(f.id) && !bIds.has(f.id))];
          } else { r[k] = m[k]; conflicts.push(m.name + ' · ' + k); }
        } else r[k] = mc ? m[k] : t[k];
        if (r[k] === undefined) delete r[k];
      }
      out.push(r);
    } else if (b) {
      if (key(b) !== key(t)) out.push(t); // la borré yo, pero otro la editó: se conserva
    } else {
      out.push(t); // nueva de otro panel
    }
  }
  for (const m of mine.props) {
    if (seen.has(m.id)) continue;
    if (B.has(m.id) && key(B.get(m.id)) === key(m)) continue; // el otro la borró y yo no la toqué: queda borrada
    out.push(m); // nueva mía (o la edité y el otro la borró: se conserva)
  }
  return { ...theirs, ...mine, props: out };
}

function parseContent(text) {
  const s = text.trim().replace(/^window\.SITE_PROPS\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(s);
}

async function readPrivate(env) {
  try {
    const f = await gh(env, `contents/${PRIVATE_PATH}?ref=${BRANCH}`);
    return JSON.parse(b64decodeUtf8(f.content)) || {};
  } catch (e) {
    return {}; // todavía no existe
  }
}
function cleanPrivate(obj) {
  const out = {};
  for (const [id, v] of Object.entries(obj || {})) {
    if (!/^[a-z0-9-]+$/.test(id) || !v || typeof v !== 'object') continue;
    out[id] = { real: String(v.real || '').slice(0, 300) };
  }
  return out;
}

function validate(data) {
  const ids = new Set();
  for (const p of data.props) {
    if (!p.id || !/^[a-z0-9-]+$/.test(p.id)) throw err('Cada propiedad necesita un identificador válido.', 400);
    if (ids.has(p.id)) throw err('Hay dos propiedades con el mismo identificador: ' + p.id, 400);
    ids.add(p.id);
    if (!p.name) throw err('Falta el nombre de una propiedad.', 400);
  }
  if (JSON.stringify(data).length > 2_000_000) throw err('El contenido es demasiado grande.', 400);
}

// ---------- GitHub ----------
async function gh(env, path, init = {}) {
  if (!env.GITHUB_TOKEN) throw err('Falta configurar GITHUB_TOKEN en Cloudflare.', 500);
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'maiarc-panel',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw err(`GitHub respondió ${res.status}: ${t.slice(0, 200)}`, 502);
  }
  return res.json();
}

async function commit(env, files, blobs, deletes, message, parentSha) {
  const parent = parentSha || (await gh(env, `git/ref/heads/${BRANCH}`)).object.sha;
  let fileSha = null;
  const parentCommit = await gh(env, `git/commits/${parent}`);
  const tree = [];
  for (const f of files) {
    const blob = await gh(env, 'git/blobs', { method: 'POST', body: JSON.stringify({ content: f.content, encoding: f.encoding }) });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
    if (f.path === CONTENT_PATH) fileSha = blob.sha;
  }
  for (const b of blobs) tree.push({ path: b.path, mode: '100644', type: 'blob', sha: b.sha });
  for (const p of deletes) tree.push({ path: p, mode: '100644', type: 'blob', sha: null });
  let newTree;
  try {
    newTree = await gh(env, 'git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree }) });
  } catch (e) {
    // Si alguna foto a borrar ya no existía, reintentar sin borrados.
    if (!deletes.length) throw e;
    newTree = await gh(env, 'git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: tree.filter((t) => t.sha) }) });
  }
  const c = await gh(env, 'git/commits', { method: 'POST', body: JSON.stringify({ message: message + ' (panel)', tree: newTree.sha, parents: [parent] }) });
  try {
    await gh(env, `git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha, force: false }) });
  } catch (e) {
    if (/ 422/.test(e.message)) throw err('Otra publicación entró al mismo tiempo.', 409);
    throw e;
  }
  return { commit: c.sha, fileSha };
}

// ---------- Traducción ----------
async function translate(env, texts, to) {
  const clean = texts.map((t) => (t == null ? '' : String(t)));
  if (!clean.some((t) => t.trim())) return clean;
  if (!env.AI) throw err('La traducción automática no está disponible.', 500);
  const lang = to === 'en' ? 'English (international, natural)' : 'Brazilian Portuguese (natural, using "você")';
  const prompt =
    `You translate website copy for MAIARC, a luxury real estate & concierge agency in Miami, Florida.\n` +
    `Translate each Spanish item into ${lang}. Write it the way a native luxury-hospitality copywriter would: natural, elegant and warm, never literal. ` +
    `Keep proper names (property names, places such as Miami Beach, Brickell, Coral Gables, Key Biscayne, Fort Lauderdale) unchanged. Keep the same meaning and roughly the same length.\n` +
    `Return ONLY a JSON array of strings with exactly ${clean.length} items, in the same order.\n\n` +
    JSON.stringify(clean);
  const models = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
  for (const model of models) {
    try {
      const r = await env.AI.run(model, { messages: [{ role: 'user', content: prompt }], max_tokens: 4000, temperature: 0.2 });
      const out = typeof r.response === 'string' ? r.response : JSON.stringify(r.response);
      const m = out.match(/\[[\s\S]*\]/);
      const arr = JSON.parse(m ? m[0] : out);
      if (Array.isArray(arr) && arr.length === clean.length) return arr.map((x, i) => (clean[i].trim() ? String(x) : ''));
    } catch (e) { /* probar el siguiente modelo */ }
  }
  // Último recurso: traductor automático frase por frase.
  const res = [];
  for (const t of clean) {
    if (!t.trim()) { res.push(''); continue; }
    const r = await env.AI.run('@cf/meta/m2m100-1.2b', { text: t, source_lang: 'spanish', target_lang: to === 'en' ? 'english' : 'portuguese' });
    res.push(r.translated_text || t);
  }
  return res;
}

// ---------- Texto de la propiedad a partir de capturas ----------
const b64ToBytes = (b64) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const outText = (r) => (typeof r?.response === 'string' ? r.response : r?.response ? JSON.stringify(r.response) : r?.choices?.[0]?.message?.content || '');

async function readImages(env, images) {
  const ask = 'Transcribe ALL the text you can read in this image (property listing / description). Also list any numbers of bedrooms, bathrooms, guests, area and amenities. Plain text only.';
  const parts = [];
  for (const b64 of images) {
    let got = '';
    // 1) Modelos con visión que aceptan data-URL
    for (const model of ['@cf/google/gemma-3-12b-it', '@cf/mistral/mistral-small-3.1-24b-instruct']) {
      if (got) break;
      try {
        const r = await env.AI.run(model, { messages: [{ role: 'user', content: [{ type: 'text', text: ask }, { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + b64 } }] }], max_tokens: 1500 });
        got = outText(r).trim();
      } catch (e) { /* siguiente */ }
    }
    // 2) Llama 3.2 Vision (requiere aceptar licencia una vez)
    if (!got) {
      try { await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { prompt: 'agree' }); } catch (e) {}
      try {
        const r = await env.AI.run('@cf/meta/llama-3.2-11b-vision-instruct', { messages: [{ role: 'user', content: ask }], image: [...b64ToBytes(b64)], max_tokens: 1500 });
        got = outText(r).trim();
      } catch (e) {}
    }
    if (got) parts.push(got);
  }
  return parts.join('\n\n');
}

async function describe(env, images, text, name) {
  if (!env.AI) throw err('La IA no está disponible.', 500);
  let source = text.trim();
  if (images.length) {
    const read = await readImages(env, images);
    if (!read && !source) throw err('No pude leer la captura. Probá con una imagen más nítida o pegá el texto.', 422);
    source = [source, read].filter(Boolean).join('\n\n');
  }
  const prompt =
    `Sos redactor/a de MAIARC, una agencia de lujo de Real Estate & Concierge en Miami (Florida). ` +
    `A partir de la información de abajo sobre la propiedad${name ? ' "' + name + '"' : ''}, escribí en español rioplatense (vos), con un tono elegante, cálido y concreto, nunca exagerado ni con clichés como "paraíso" o "única". No inventes datos que no estén en la información.\n` +
    `Devolvé SOLO un JSON con esta forma exacta:\n` +
    `{"short":"frase de 2 a 5 palabras para la tarjeta, en minúscula, ej. frente al mar","lead":"una sola oración (máx. 25 palabras) que presente la casa","desc":"descripción de 2 o 3 oraciones (máx. 70 palabras)","amen":["comodidades, 4 a 8 ítems cortos con mayúscula inicial"],"tags":["2 a 4 características para filtros, elegí de: Frente al mar, Frente al agua, Muelle privado, Piscina, Vista a la bahía, Vista al mar, Spa, Casa de huéspedes, Golf, Pet friendly, o similares"],"beds":número o null,"baths":número o null,"guests":número o null}\n\n` +
    `INFORMACIÓN:\n${source.slice(0, 7000)}`;
  for (const model of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct']) {
    try {
      const r = await env.AI.run(model, { messages: [{ role: 'user', content: prompt }], max_tokens: 1200, temperature: 0.4 });
      const out = outText(r);
      const m = out.match(/\{[\s\S]*\}/);
      const j = JSON.parse(m ? m[0] : out);
      const arr = (x) => (Array.isArray(x) ? x.map(String).map((t) => t.trim()).filter(Boolean).slice(0, 10) : []);
      const num = (x) => { const n = parseInt(x, 10); return isNaN(n) ? null : n; };
      return { short: String(j.short || '').trim(), lead: String(j.lead || '').trim(), desc: String(j.desc || '').trim(), amen: arr(j.amen), tags: arr(j.tags).slice(0, 4), beds: num(j.beds), baths: num(j.baths), guests: num(j.guests), source: source.slice(0, 1500) };
    } catch (e) { /* siguiente modelo */ }
  }
  throw err('La IA no pudo generar el texto. Probá de nuevo.', 502);
}

// ---------- Sesión ----------
async function hmac(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function makeToken(env) {
  const exp = String(Date.now() + SESSION_HOURS * 3600e3);
  return exp + '.' + (await hmac('maiarc:' + env.ADMIN_PASSWORD, exp));
}
async function requireAuth(req, env) {
  const h = req.headers.get('Authorization') || '';
  const token = h.replace(/^Bearer\s+/, '');
  const [exp, sig] = token.split('.');
  if (!exp || !sig || Number(exp) < Date.now() || !env.ADMIN_PASSWORD) throw err('Tu sesión venció. Volvé a ingresar.', 401);
  const good = await hmac('maiarc:' + env.ADMIN_PASSWORD, exp);
  if (!(await safeEqual(sig, good))) throw err('Tu sesión venció. Volvé a ingresar.', 401);
}
async function safeEqual(a, b) {
  const [x, y] = await Promise.all([hmac('cmp', String(a)), hmac('cmp', String(b))]);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.min(x.length, y.length); i++) d |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return d === 0;
}

// ---------- Utilidades ----------
function b64decodeUtf8(b64) {
  const bin = atob(b64.replace(/\n/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
function err(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ---------- Páginas para Google (/casas/<id>/ y /zonas/<id>/) ----------
async function loadProps(env, req) {
  const r = await env.ASSETS.fetch(new Request(new URL('/content/props.js', req.url)));
  try { return (parseContent(await r.text()).props || []).filter((p) => p && p.id && p.visible !== false); } catch (e) { return []; }
}
const escH = (t) => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const L = (o) => (o && typeof o === 'object' ? o.en || o.es || '' : o || ''); // Miami: Google en inglés

async function seoPage(env, req, url) {
  const m = url.pathname.match(/^\/(casas|zonas)\/([a-z0-9-]+)\/?$/);
  if (!m) return Response.redirect(SITE + '/', 302);
  if (!url.pathname.endsWith('/')) return Response.redirect(url.origin + url.pathname + '/' + url.search, 301);
  const [, kind, id] = m;
  const props = await loadProps(env, req);
  let seo;
  if (kind === 'casas') {
    const p = props.find((x) => x.id === id);
    if (!p) return Response.redirect(SITE + '/#todas', 302);
    const where = [p.zone, p.area].filter(Boolean).join(', ');
    const ops = (p.ops || []).includes('venta') && (p.ops || []).includes('alquiler') ? 'For rent and sale' : (p.ops || []).includes('venta') ? 'For sale' : 'Luxury rental';
    const facts = [p.beds ? p.beds + ' bedrooms' : '', p.guests ? p.guests + ' guests' : ''].filter(Boolean).join(', ');
    const img = p.feat || p.card || (p.photos && p.photos[0] && p.photos[0].id) || '';
    seo = {
      route: p.id,
      title: `${p.name} · ${ops} in ${where} | MAIARC`,
      desc: `${L(p.lead)} ${facts ? facts + '.' : ''} ${ops} with private concierge by MAIARC.`.replace(/\s+/g, ' ').trim().slice(0, 300),
      canonical: `${SITE}/casas/${p.id}/`,
      image: img ? `${SITE}/img/${img}.jpg` : `${SITE}/share.jpg`,
      ld: {
        '@context': 'https://schema.org', '@type': 'Accommodation', name: p.name, description: L(p.desc) || L(p.lead),
        url: `${SITE}/casas/${p.id}/`, image: (p.photos || []).slice(0, 6).map((f) => `${SITE}/img/${f.id}.jpg`),
        numberOfBedrooms: p.beds || undefined, numberOfBathroomsTotal: p.baths || undefined,
        occupancy: p.guests ? { '@type': 'QuantitativeValue', maxValue: p.guests } : undefined,
        amenityFeature: ((p.amen && (p.amen.en && p.amen.en.length ? p.amen.en : p.amen.es)) || []).map((a) => ({ '@type': 'LocationFeatureSpecification', name: a, value: true })),
        address: { '@type': 'PostalAddress', addressLocality: p.area || 'Miami', addressRegion: 'FL', addressCountry: 'US' },
        containedInPlace: { '@type': 'Place', name: where },
        provider: { '@id': SITE + '/#maiarc' },
      },
    };
  } else {
    const z = ZONAS.find((x) => x.id === id);
    if (!z) return Response.redirect(SITE + '/#todas', 302);
    const has = props.some((p) => z.match.includes(p.zone));
    const pick = (props.find((p) => p.zone === z.name) || props.find((p) => z.match.includes(p.zone)) || {}).zone || '';
    seo = {
      route: 'todas', zone: { id: z.id, name: z.name, h1: z.h1, intro: z.intro, pick, has, match: z.match },
      title: z.title.en, desc: z.intro.en.slice(0, 300), canonical: `${SITE}/zonas/${z.id}/`, image: `${SITE}/share.jpg`,
      ld: { '@context': 'https://schema.org', '@type': 'WebPage', name: z.title.en, url: `${SITE}/zonas/${z.id}/`, about: { '@type': 'Place', name: z.name + ', Florida, USA' }, publisher: { '@id': SITE + '/#maiarc' } },
    };
  }
  const base = await env.ASSETS.fetch(new Request(new URL('/', req.url)));
  let html = await base.text();
  html = html
    .replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<base href="/">')
    .replace('<video class="hero-bg" autoplay muted loop playsinline preload="auto"', '<video class="hero-bg" muted loop playsinline preload="none"')
    .replace(/<title>[^<]*<\/title>/, `<title>${escH(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escH(seo.desc)}">`)
    .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${seo.canonical}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${seo.canonical}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escH(seo.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escH(seo.desc)}">`)
    .replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${seo.image}">`)
    .replace('<script src="content/props.js"></script>',
      `<script type="application/ld+json">${JSON.stringify(seo.ld).replace(/</g, '\\u003c')}</script>\n<script>window.__ROUTE=${JSON.stringify(seo.route)};window.__SEO=${JSON.stringify({ title: seo.title, zone: seo.zone || null }).replace(/</g, '\\u003c')};</script>\n<script src="content/props.js"></script>`);
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
}

async function sitemap(env, req) {
  const props = await loadProps(env, req);
  const urls = [SITE + '/', ...ZONAS.map((z) => `${SITE}/zonas/${z.id}/`), ...props.map((p) => `${SITE}/casas/${p.id}/`), SITE + '/privacidad/'];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n') + '\n</urlset>\n';
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=600' } });
}
