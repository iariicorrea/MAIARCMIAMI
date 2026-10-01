// MAIARC Miami — servidor del panel de administración.
// La web pública son archivos estáticos (ASSETS). Este Worker solo atiende /api/*.
// Secretos necesarios (Cloudflare → Worker → Settings → Variables and Secrets):
//   ADMIN_PASSWORD  contraseña del panel
//   GITHUB_TOKEN    token de GitHub con permiso de escritura en el repositorio
// Binding de IA (wrangler.jsonc): AI, para las traducciones automáticas.

const REPO = 'iariicorrea/MAIARCMIAMI';
const BRANCH = 'main';
const CONTENT_PATH = 'content/props.js';
const SESSION_HOURS = 12;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
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
    return json({ data: parseContent(text), sha: file.sha });
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
    const data = body.data;
    if (!data || !Array.isArray(data.props)) throw err('Datos inválidos.', 400);
    validate(data);
    const files = [
      { path: CONTENT_PATH, content: 'window.SITE_PROPS=' + JSON.stringify(data, null, 1) + ';\n', encoding: 'utf-8' },
    ];
    const blobs = [];
    for (const b of body.blobs || []) {
      if (!/^img\/[a-z0-9-]+\.jpg$/.test(b.path) || !/^[0-9a-f]{40}$/.test(b.sha)) throw err('Foto inválida: ' + b.path, 400);
      blobs.push(b);
    }
    const deletes = (body.deletes || []).filter((p) => /^img\/[a-z0-9-]+\.jpg$/.test(p));
    const sha = await commit(env, files, blobs, deletes, body.message || 'Actualización desde el panel');
    return json({ ok: true, commit: sha });
  }

  if (route === 'translate' && req.method === 'POST') {
    const { texts, to } = await req.json();
    if (!Array.isArray(texts) || !['en', 'pt'].includes(to)) throw err('Pedido inválido.', 400);
    return json({ texts: await translate(env, texts, to) });
  }

  throw err('No encontrado.', 404);
}

// ---------- Contenido ----------
function parseContent(text) {
  const s = text.trim().replace(/^window\.SITE_PROPS\s*=\s*/, '').replace(/;\s*$/, '');
  return JSON.parse(s);
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

async function commit(env, files, blobs, deletes, message) {
  const ref = await gh(env, `git/ref/heads/${BRANCH}`);
  const parent = ref.object.sha;
  const parentCommit = await gh(env, `git/commits/${parent}`);
  const tree = [];
  for (const f of files) {
    const blob = await gh(env, 'git/blobs', { method: 'POST', body: JSON.stringify({ content: f.content, encoding: f.encoding }) });
    tree.push({ path: f.path, mode: '100644', type: 'blob', sha: blob.sha });
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
  await gh(env, `git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
  return c.sha;
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
    `Keep proper names (property names, places such as Miami Beach, Brickell, Coral Gables, Key Biscayne, North Miami) unchanged. Keep the same meaning and roughly the same length.\n` +
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
