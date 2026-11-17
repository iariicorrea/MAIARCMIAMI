/* MAIARC — historias de Instagram (PNG 1080×1920) a partir de las fotos de cada propiedad.
 * Réplica de las placas de Canva "Casa Paro":
 *   · Portada  → 1 foto a pantalla completa, nombre + dormitorios | zona arriba, zona + frase + logo abajo.
 *   · Collage  → 3 fotos apiladas, líneas blancas, nombre arriba a la derecha, dormitorios | zona en vertical, zona + logo abajo.
 * Requiere pdf-assets.js (logo) y las tipografías de admin/fonts (TheSeasons de pdf-assets.js para títulos; Lexend Exa, licencia OFL, para textos).
 *
 * Uso desde el panel:
 *   MaiarcHistorias.init({ imgUrl: id => url, hqUrl: id => Promise<url> });
 *   MaiarcHistorias.update(prop);   // cada vez que se abre o cambia la propiedad
 */
(function () {
  const W = 1080, H = 1920;
  const A = window.MAIARC_PDF_ASSETS || {};
  // Tipografías de las placas (archivos en admin/fonts). track = espaciado entre letras en em.
  // Van incrustadas acá (como en el PDF) para que no dependan de una descarga aparte: así andan igual en Safari y en el iPhone.
  const FONTS = window.MAIARC_HISTORIAS_FONTS || {
    serif: { b64: A.font, ascii: true }, // TheSeasons, la misma de los títulos del PDF (viene en pdf-assets.js)
    sans: { file: 'lexend-exa-latin-300-normal.woff2', b64: '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', track: 0.04, scale: 1 },
  };
  const plain = (s) => (FONTS.serif.ascii ? ascii(s) : String(s || '')); // la serif de los PDF (TheSeasons) no tiene acentos
  const SERIF = 'MaiarcHsSerif';
  const SANS = 'MaiarcHsSans,sans-serif';
  const TR = FONTS.sans.track || 0, SC = FONTS.sans.scale || 1;
  const FONT_BASE = new URL('fonts/', document.currentScript ? document.currentScript.src : location.href);
  const ascii = (s) => (s = String(s || '').replace(/[’‘´]/g, "'"), window.MaiarcPDF ? MaiarcPDF.plain(s) : s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let H_ = { imgUrl: (id) => '', hqUrl: async (id) => '' };
  let prop = null;
  let st = null; // estado por propiedad: {tpl, lang, sel:[ids], focus:{id:{x,y}}, txt:{es:{},en:{}}}

  // ---------- Recursos ----------
  let ready = null;
  function loadAll() {
    if (ready) return ready;
    ready = (async () => {
      await Promise.all([['MaiarcHsSerif', FONTS.serif], ['MaiarcHsSans', FONTS.sans]].map(async ([fam, F]) => {
        let src;
        if (F.b64) { const bin = atob(F.b64); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i); src = buf.buffer; }
        else src = await (await fetch(new URL(F.file, FONT_BASE))).arrayBuffer();
        const f = new FontFace(fam, src); await f.load(); document.fonts.add(f);
      })).catch(() => {});
      fontsOk = fontsWork();
      return loadImg(A.logo);
    })();
    return ready;
  }
  // ¿El navegador realmente dibuja con nuestras letras? (si no, mide igual que la letra de reemplazo)
  let fontsOk = false;
  function fontsWork() {
    const c = document.createElement('canvas').getContext('2d');
    const t = 'JOSE IGNACIO bedrooms 0123';
    const m = (f) => { c.font = '40px ' + f; return c.measureText(t).width; };
    return m('MaiarcHsSerif, serif') !== m('serif') && m('MaiarcHsSans, monospace') !== m('monospace');
  }
  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((res) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    imgCache.set(src, p);
    return p;
  }
  async function photo(id) { let u = ''; try { u = await H_.hqUrl(id); } catch (_) {} return loadImg(u || H_.imgUrl(id)); }

  // ---------- Textos ----------
  function defaults(p, lang) {
    const zone = (p.zone || p.area || H_.area || '').trim();
    const beds = p.beds;
    const bedTxt = beds ? (lang === 'en' ? beds + (beds == 1 ? ' bedroom' : ' bedrooms') : beds + (beds == 1 ? ' dormitorio' : ' dormitorios')) : '';
    return {
      name: p.name || '',
      line: [bedTxt, zone].filter(Boolean).join(' | '),
      zone: zone.toUpperCase(),
      phrase: lang === 'en'
        ? 'Discover our portfolio of villas\nin ' + zone + ' for this season'
        : 'Descubra nuestra colección de villas\nen ' + zone + ' para esta temporada',
    };
  }
  function texts() { const d = defaults(prop, st.lang), t = st.txt[st.lang] || {}; const o = {}; for (const k in d) o[k] = t[k] ?? d[k]; return o; }

  // ---------- Dibujo ----------
  // Calibración contra Canva: "JOSE IGNACIO" a 51,45 px mide 586 px de ancho en la placa original.
  let K = null;
  function calib(ctx) {
    if (K) return K;
    ctx.font = '51.45px ' + SERIF;
    const w = ctx.measureText('JOSE IGNACIO').width;
    K = w > 0 ? 586 / w : 1;
    return K;
  }
  function setFont(ctx, weight, size, family, spacing) {
    ctx.font = (weight ? weight + ' ' : '') + size.toFixed(1) + 'px ' + family;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (spacing || 0).toFixed(1) + 'px';
  }
  // Achica la letra hasta que entra en maxW.
  function fit(ctx, text, weight, size, family, spacingEm, maxW) {
    for (let i = 0; i < 40; i++) {
      setFont(ctx, weight, size, family, size * (spacingEm || 0));
      if (ctx.measureText(text).width <= maxW) break;
      size *= 0.96;
    }
    return size;
  }
  function cover(ctx, img, x, y, w, h, f) {
    f = f || { x: 0.5, y: 0.5 };
    if (!img) { ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x, y, w, h); return { ox: 0, oy: 0 }; }
    const s = Math.max(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s, ox = dw - w, oy = dh - h;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, x - ox * f.x, y - oy * f.y, dw, dh);
    ctx.restore();
    return { ox, oy };
  }
  function grad(ctx, y0, y1, stops) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([p, a]) => g.addColorStop(p, 'rgba(0,0,0,' + a + ')'));
    ctx.fillStyle = g; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
  }
  function center(ctx, text, y) { ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, W / 2, y); }
  function logo(ctx, lg) { if (lg) ctx.drawImage(lg, 447.6, 1677.4, 184.9, 184.9 * lg.height / lg.width); }

  // Dibuja una historia. imgs: [Image], ids: [id]. Devuelve las zonas de cada foto (para mover el encuadre).
  // S = escala de salida: 1 → 1080×1920, 2 → 2160×3840 (textos y líneas se dibujan nativos a esa resolución, no se agrandan).
  function draw(ctx, tpl, imgs, ids, T, lg, S) {
    const k = calib(ctx);
    ctx.setTransform(S || 1, 0, 0, S || 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = 'transparent';
    const zones = [];
    if (tpl === 'portada') {
      const r = cover(ctx, imgs[0], 0, 0, W, H, st.focus[ids[0]]);
      zones.push({ id: ids[0], y0: 0, y1: H, h: H, ...r });
      grad(ctx, 0, 460, [[0, 0.32], [1, 0]]);
      grad(ctx, 1300, H, [[0, 0], [0.35, 0.32], [1, 0.72]]);
      ctx.fillStyle = '#fff';
      if (T.name) { fit(ctx, plain(T.name), '', 48 * k, SERIF, 0, 960); center(ctx, plain(T.name), 177); }
      if (T.line) { fit(ctx, T.line, '', 50 * SC, SANS, TR, 1000); center(ctx, T.line, 264); }
      if (T.zone) { fit(ctx, plain(T.zone), '', 51.45 * k, SERIF, 0, 980); center(ctx, plain(T.zone), 1489); }
      const lines = String(T.phrase || '').toUpperCase().split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 3);
      if (lines.length) {
        let size = 31 * SC;
        lines.forEach((l) => { size = Math.min(size, fit(ctx, l, '', 31 * SC, SANS, TR, 1000)); });
        setFont(ctx, '', size, SANS, size * TR);
        const lh = size * 1.58, y0 = 1602 - (lines.length - 1) * lh / 2 + (lines.length > 2 ? -10 : 0);
        lines.forEach((l, i) => center(ctx, l, y0 + i * lh));
      }
      logo(ctx, lg);
    } else {
      const bands = [[0, 636], [639, 1280], [1283, H]];
      bands.forEach(([a, b], i) => { const r = cover(ctx, imgs[i], 0, a, W, b - a, st.focus[ids[i]]); zones.push({ id: ids[i], y0: a, y1: b, h: b - a, ...r }); });
      grad(ctx, 0, 300, [[0, 0.28], [1, 0]]);
      grad(ctx, 1440, H, [[0, 0], [1, 0.5]]);
      ctx.fillStyle = '#fff';
      ctx.fillRect(78, 142, 4, 478);   // línea vertical
      ctx.fillRect(102, 107, 212, 4);  // línea horizontal
      if (T.name) {
        const s = fit(ctx, plain(T.name), '', 48 * k, SERIF, 0, 700);
        const w = ctx.measureText(plain(T.name)).width;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(plain(T.name), Math.max(340, Math.min(665 - w / 2, 1040 - w)), 110);
      }
      if (T.line) {
        fit(ctx, T.line, '', 35 * SC, SANS, TR, 590);
        ctx.save(); ctx.translate(80, 680); ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(T.line, 0, 0);
        ctx.restore();
      }
      if (T.zone) { fit(ctx, plain(T.zone), '', 51.45 * k, SERIF, 0, 980); center(ctx, plain(T.zone), 1636); }
      logo(ctx, lg);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return zones;
  }

  // ---------- Historias según la selección ----------
  function stories() {
    const s = st.sel.filter((id) => (prop.photos || []).some((f) => f.id === id));
    if (st.tpl === 'portada') return s.map((id) => [id]);
    const out = [];
    for (let i = 0; i + 3 <= s.length; i += 3) out.push(s.slice(i, i + 3));
    return out;
  }

  // ---------- Estado guardado (en este dispositivo) ----------
  const KEY = (id) => 'maiarc_historias_' + id;
  function load(p) {
    let s = null; try { s = JSON.parse(localStorage.getItem(KEY(p.id)) || 'null'); } catch (_) {}
    s = s || {};
    return { tpl: s.tpl || 'portada', lang: s.lang || 'en', sel: s.sel || [], focus: s.focus || {}, txt: s.txt || { es: {}, en: {} } };
  }
  let saveT = null;
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY(prop.id), JSON.stringify(st)); } catch (_) {} }, 300); }

  // ---------- Interfaz ----------
  function ui() {
    const ph = prop.photos || [];
    const T = texts();
    const n = stories().length, nSel = st.sel.length;
    const left = st.tpl === 'collage' ? nSel % 3 : 0;
    $('hs-tpl').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.t === st.tpl));
    $('hs-lang').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.l === st.lang));
    ['name', 'line', 'zone', 'phrase'].forEach((k) => { const e = $('hs-' + k); if (document.activeElement !== e) e.value = T[k]; });
    $('hs-phrase-w').hidden = st.tpl !== 'portada';
    const G = $('hs-pick'); G.innerHTML = '';
    ph.forEach((f) => {
      const i = st.sel.indexOf(f.id);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'hs-ph' + (i >= 0 ? ' on' : '');
      b.style.backgroundImage = 'url(' + H_.imgUrl(f.id) + ')';
      b.innerHTML = i >= 0 ? '<span>' + (i + 1) + '</span>' : '';
      b.onclick = () => { const j = st.sel.indexOf(f.id); if (j >= 0) st.sel.splice(j, 1); else st.sel.push(f.id); save(); ui(); renderPreview(); };
      G.append(b);
    });
    $('hs-info').textContent = !ph.length ? 'Primero subí fotos de la propiedad.'
      : !nSel ? (st.tpl === 'portada' ? 'Tocá las fotos que querés: cada una es una historia.' : 'Tocá las fotos de a 3: cada grupo de 3 es una historia (arriba, medio y abajo, en el orden en que las elegís).')
      : n + (n === 1 ? ' historia' : ' historias') + (left ? ' · te ' + (left === 1 ? 'sobra 1 foto' : 'sobran 2 fotos') + ': elegí ' + (3 - left) + ' más para otra historia' : '');
    $('hs-dl').disabled = !n || busy;
    $('hs-clear').hidden = !nSel;
  }

  // Vista previa: cada historia en su canvas (tamaño real, se ve chico). Arrastrá la foto para moverla.
  let prevRun = 0;
  async function renderPreview() {
    const run = ++prevRun;
    const P = $('hs-prev');
    const list = stories();
    const lg = await loadAll();
    if (run !== prevRun) return;
    if (!fontsOk && list.length) $('hs-status').textContent = 'Ojo: este navegador no cargó las letras de MAIARC. Recargá la página; si sigue, abrí el panel en Chrome.';
    const T = texts();
    // Reusar canvases existentes para que no parpadee
    while (P.children.length > list.length) P.lastChild.remove();
    for (let i = 0; i < list.length; i++) {
      const ids = list[i];
      const imgs = await Promise.all(ids.map(photo));
      if (run !== prevRun) return;
      let fig = P.children[i];
      if (!fig) {
        fig = document.createElement('figure');
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const cap = document.createElement('figcaption');
        fig.append(c, cap); P.append(fig);
        dragify(c);
      }
      const c = fig.firstChild;
      c._ids = ids; c._imgs = imgs; c._zones = draw(c.getContext('2d'), st.tpl, imgs, ids, T, lg);
      const low = c._zones.some((z, j) => imgs[j] && Math.max(W / imgs[j].width, z.h / imgs[j].height) * QUAL() > 1.25);
      fig.lastChild.textContent = 'Historia ' + (i + 1) + (low ? ' · foto en calidad web' : '');
      fig.lastChild.title = low ? 'Esta foto se ve bien, pero no tiene la resolución máxima en este dispositivo. Para que salga perfecta, subí la foto original desde este dispositivo (o descargá desde donde la subiste).' : '';
    }
  }
  function redraw(c) { loadAll().then((lg) => { c._zones = draw(c.getContext('2d'), st.tpl, c._imgs, c._ids, texts(), lg); }); }

  // Mover el encuadre de cada foto arrastrando sobre la vista previa.
  function dragify(c) {
    c.addEventListener('pointerdown', (e) => {
      if (!c._zones) return;
      const rect = c.getBoundingClientRect(), sc = W / rect.width;
      const y = (e.clientY - rect.top) * sc;
      const z = c._zones.find((q) => y >= q.y0 && y <= q.y1);
      if (!z || (!z.ox && !z.oy)) return;
      e.preventDefault(); c.setPointerCapture(e.pointerId);
      const f0 = { ...(st.focus[z.id] || { x: 0.5, y: 0.5 }) };
      const x0 = e.clientX, y0 = e.clientY; let raf = 0;
      const mv = (ev) => {
        const dx = (ev.clientX - x0) * sc, dy = (ev.clientY - y0) * sc;
        st.focus[z.id] = {
          x: z.ox ? Math.min(1, Math.max(0, f0.x - dx / z.ox)) : 0.5,
          y: z.oy ? Math.min(1, Math.max(0, f0.y - dy / z.oy)) : 0.5,
        };
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(c); });
      };
      const up = () => { c.removeEventListener('pointermove', mv); c.removeEventListener('pointerup', up); c.removeEventListener('pointercancel', up); save(); renderPreview(); };
      c.addEventListener('pointermove', mv); c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    });
  }

  // ---------- Descargar ----------
  let busy = false;
  const QUAL = () => (($('hs-q') && $('hs-q').querySelector('input:checked')) || {}).value === '1' ? 1 : 2;
  function fileName(i) { return 'MAIARC_' + ascii(prop.name || 'Propiedad').trim().replace(/\s+/g, '-') + '_historia-' + (i + 1) + '.png'; }
  async function exportAll() {
    const list = stories(); if (!list.length) return;
    busy = true; ui();
    const S = $('hs-status');
    try {
      const lg = await loadAll(); const T = texts();
      if (!fontsOk) { S.textContent = 'Este navegador no cargó las letras de MAIARC, así que no descargué nada para que no salgan con otra letra. Recargá la página y probá de nuevo; si sigue, abrí el panel en Chrome.'; return; }
      const files = [];
      for (let i = 0; i < list.length; i++) {
        S.innerHTML = '<span class="spin"></span> Armando historia ' + (i + 1) + ' de ' + list.length + '…';
        const imgs = await Promise.all(list[i].map(photo));
        const q = QUAL();
        const c = document.createElement('canvas'); c.width = W * q; c.height = H * q;
        draw(c.getContext('2d'), st.tpl, imgs, list[i], T, lg, q);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        files.push(new File([blob], fileName(i), { type: 'image/png' }));
      }
      // En el celular: menú de compartir → "Guardar imágenes" (quedan en Fotos, listas para Instagram).
      const touch = matchMedia('(pointer:coarse)').matches;
      if (touch && navigator.canShare && navigator.canShare({ files })) {
        try { await navigator.share({ files }); S.textContent = 'Listo: ' + files.length + (files.length === 1 ? ' historia.' : ' historias.') + ' Tocá “Guardar imágenes” para tenerlas en Fotos.'; return; }
        catch (err) { if (err && err.name === 'AbortError') { S.textContent = ''; return; } }
      }
      for (const f of files) {
        const url = URL.createObjectURL(f); const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.append(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
        await new Promise((r) => setTimeout(r, 450));
      }
      S.textContent = 'Listo: se descargaron ' + files.length + (files.length === 1 ? ' historia' : ' historias') + ' en PNG ' + (QUAL() === 2 ? '2160×3840 (máxima calidad)' : '1080×1920') + '.';
    } catch (err) { S.textContent = 'No se pudieron armar las historias: ' + err.message; }
    finally { busy = false; ui(); }
  }

  // ---------- Montaje ----------
  let wired = false;
  function wire() {
    if (wired) return; wired = true;
    $('hs-tpl').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; st.tpl = b.dataset.t; save(); ui(); renderPreview(); };
    $('hs-lang').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; st.lang = b.dataset.l; save(); ui(); renderPreview(); };
    let t = null;
    ['name', 'line', 'zone', 'phrase'].forEach((k) => $('hs-' + k).addEventListener('input', (e) => {
      st.txt[st.lang] = st.txt[st.lang] || {}; st.txt[st.lang][k] = e.target.value; save();
      clearTimeout(t); t = setTimeout(renderPreview, 200);
    }));
    $('hs-reset').onclick = () => { st.txt[st.lang] = {}; save(); ui(); renderPreview(); };
    $('hs-clear').onclick = () => { st.sel = []; save(); ui(); renderPreview(); };
    $('hs-dl').onclick = exportAll;
    if ($('hs-q')) $('hs-q').onchange = renderPreview;
  }
  function init(h) { H_ = { ...H_, ...h }; }
  let lastKey = '';
  function update(p) {
    if (!p || !$('hs-card')) return;
    wire();
    if (!prop || prop.id !== p.id) { st = load(p); $('hs-status').textContent = ''; }
    prop = p;
    // Si cambian fotos, nombre, zona o dormitorios, se vuelve a dibujar.
    const key = JSON.stringify([p.id, p.name, p.zone, p.area, p.beds, (p.photos || []).map((f) => f.id)]);
    ui();
    if (key !== lastKey) { lastKey = key; renderPreview(); }
  }
  window.MaiarcHistorias = { init, update, draw: (ctx, tpl, imgs, ids, T, lg) => draw(ctx, tpl, imgs, ids, T, lg) };
})();
