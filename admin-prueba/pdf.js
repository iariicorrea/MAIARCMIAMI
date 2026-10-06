/* MAIARC — motor de PDF de propiedades (portado de MAIARC PDF Studio).
 * Sin librerías externas: cada slide se dibuja en un canvas A4 apaisado y se arma el PDF a mano.
 * Requiere admin/pdf-assets.js (tipografía TheSeasons, logo e íconos).
 *
 * Uso:
 *   MaiarcPDF.slides(nFotos, tieneServicios)        → [{type,i}]   (orden fijo: 1 portada, 3 bienvenidos, 5 servicios)
 *   MaiarcPDF.make(prop, 'es'|'en', {quality, onStatus}) → Promise<Blob>
 *   MaiarcPDF.preview(prop, lang, onSlide)          → dibuja cada slide chico (vista previa)
 *
 * prop = {name, location, beds, baths, guests,
 *         desc:{es,en}, svc:{es:[],en:[]}, amen:{es:[],en:[]},
 *         photos:[ () => Promise<url> ]}   // una función por foto, devuelve la mejor versión disponible
 */
(function () {
  const A = window.MAIARC_PDF_ASSETS;
  const TS = 'MaiarcTS';
  const SCRIPT_BASE = new URL('fonts/', document.currentScript ? document.currentScript.src : location.href);
  const QUALITY = {
    alta: { W: 2480, H: 1754, q: 0.92 },
    liviano: { W: 1684, H: 1191, q: 0.8 },
    preview: { W: 640, H: 453, q: 0.8 },
  };
  const T = {
    es: { welcome: 'BIENVENIDOS', amen: 'AMENIDADES', svcL: 'SERVICIOS INCLUIDOS', amtL: 'COMODIDADES DESTACADAS', bed: 'DORMITORIOS', bath: 'BAÑOS', guest: 'HUÉSPEDES' },
    en: { welcome: 'WELCOME', amen: 'AMENITIES', svcL: 'INCLUDED SERVICES', amtL: 'HIGHLIGHTED AMENITIES', bed: 'BEDROOMS', bath: 'BATHROOMS', guest: 'GUESTS' },
  };

  // TheSeasons solo tiene letras sin acentos ni ñ: se limpian en los textos que usan esa tipografía.
  const plain = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '');

  let fontsReady = null;
  function loadFonts() {
    if (fontsReady) return fontsReady;
    fontsReady = (async () => {
      // Jost va incluida en el panel (admin/fonts) para no depender de Google Fonts al armar el PDF.
      await Promise.all(['300', '400', '600', '700'].map(async (w) => {
        try { const f = new FontFace('Jost', 'url(' + new URL('jost-latin-' + w + '-normal.woff2', SCRIPT_BASE) + ')', { weight: w }); await f.load(); document.fonts.add(f); } catch (e) {}
      }));
      const bin = atob(A.font); const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      const ff = new FontFace(TS, buf.buffer);
      await ff.load(); document.fonts.add(ff);
    })();
    return fontsReady;
  }

  const imgCache = new Map();
  function loadImg(src) {
    if (!src) return Promise.resolve(null);
    if (imgCache.has(src)) return imgCache.get(src);
    const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
    if (src.startsWith('data:')) imgCache.set(src, p);
    return p;
  }

  // Orden fijo: foto 1 portada, foto 3 bienvenidos, foto 5 servicios y amenidades (si hay alguno de los dos).
  function slides(n, hasAmen) {
    const s = [];
    for (let i = 0; i < n; i++) {
      let type = 'photo';
      if (i === 0) type = 'cover';
      else if (i === 2) type = 'welcome';
      else if (i === 4 && hasAmen) type = 'amenities';
      s.push({ type, i });
    }
    return s;
  }

  function bullets(list) {
    return (list || []).map((l) => String(l).replace(/^[-•*\s]+/, '').trim()).filter(Boolean)
      .map((l) => l.charAt(0).toUpperCase() + l.slice(1));
  }

  async function drawSlide(slide, prop, lang, W, H) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const L = T[lang] || T.es;
    const desc = ((prop.desc || {})[lang] || '').trim();
    const svc = bullets((prop.svc || {})[lang]);
    const amt = bullets((prop.amen || {})[lang]);
    const feats = [
      { v: prop.beds, l: L.bed, icon: A.icons.bed },
      { v: prop.baths, l: L.bath, icon: A.icons.bath },
      { v: prop.guests, l: L.guest, icon: A.icons.guest },
    ].filter((f) => f.v !== null && f.v !== undefined && f.v !== '');
    const getPhoto = prop.photos[slide.i];
    const [photo, logo, icons] = await Promise.all([
      getPhoto ? getPhoto().then(loadImg) : null,
      loadImg(A.logo),
      Promise.all(feats.map((f) => loadImg(f.icon))),
    ]);

    function cover(img, x, y, w, h) {
      if (!img) { ctx.fillStyle = '#111'; ctx.fillRect(x, y, w, h); return; }
      const ir = img.width / img.height, cr = w / h; let sx, sy, sw, sh;
      if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
      else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
    }
    function drawLogo(cx, y) {
      if (!logo) return;
      const lw = W * 0.062, lh = lw * (logo.height / logo.width);
      ctx.drawImage(logo, cx - lw / 2, y - lh, lw, lh);
    }
    function wrap(text, x, y, maxW, lineH, maxY) {
      const paras = text.split('\n');
      for (let p = 0; p < paras.length; p++) {
        if (!paras[p].trim()) { y += lineH * 0.6; continue; }
        const words = paras[p].split(' '); let line = '';
        for (const w of words) {
          const t = line + (line ? ' ' : '') + w;
          if (ctx.measureText(t).width > maxW && line) { if (y > maxY) return y; ctx.fillText(line, x, y); line = w; y += lineH; }
          else line = t;
        }
        if (y <= maxY) { ctx.fillText(line, x, y); y += lineH; }
        if (p < paras.length - 1) y += lineH * 0.3;
      }
      return y;
    }
    // Ajusta el tamaño de la tipografía para que un título largo no se salga del ancho.
    function fitFont(text, size, family, maxW) {
      ctx.font = size + 'px ' + family;
      while (size > 10 && ctx.measureText(text).width > maxW) { size = Math.floor(size * 0.95); ctx.font = size + 'px ' + family; }
    }

    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);

    if (slide.type === 'cover') {
      cover(photo, 0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(0,0,0,.58)'); g.addColorStop(0.5, 'rgba(0,0,0,.08)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      const name = plain(prop.name || 'PROPIEDAD').toUpperCase();
      fitFont(name, Math.round(H * 0.14), TS + ',serif', W * 0.92);
      ctx.fillText(name, W / 2, H * 0.30);
      ctx.font = Math.round(H * 0.034) + 'px ' + TS + ',serif';
      ctx.fillText(plain(prop.location).toUpperCase(), W / 2, H * 0.40);
      if (prop.beds) {
        ctx.textAlign = 'right';
        ctx.font = '300 ' + Math.round(H * 0.038) + 'px Jost,sans-serif';
        ctx.fillText(prop.beds + '  ' + L.bed, W - W * 0.033, H - H * 0.048);
      }
      drawLogo(W / 2, H - H * 0.038);
    } else if (slide.type === 'photo') {
      cover(photo, 0, 0, W, H);
      drawLogo(W / 2, H - H * 0.038);
    } else if (slide.type === 'welcome') {
      const split = W * 0.52;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, split, H); ctx.clip(); cover(photo, 0, 0, split, H); ctx.restore();
      drawLogo(split / 2, H - H * 0.038);
      ctx.fillStyle = '#fff'; ctx.fillRect(split, 0, W - split, H);
      const px = split + W * 0.033, pw = W - split - W * 0.066, cx = split + (W - split) / 2;
      ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ctx.font = Math.round(H * 0.054) + 'px ' + TS + ',serif';
      ctx.fillText(L.welcome, cx, H * 0.128);
      ctx.textAlign = 'left';
      ctx.font = '400 ' + Math.round(H * 0.021) + 'px Jost,sans-serif';
      wrap(desc, px, H * 0.185, pw, H * 0.027, H * 0.77);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = Math.max(1, H * 0.001);
      ctx.beginPath(); ctx.moveTo(px, H * 0.815); ctx.lineTo(W - W * 0.033, H * 0.815); ctx.stroke();
      if (feats.length) {
        const isz = H * 0.078, gap = W * 0.028, tot = feats.length * (isz + gap) - gap; let ix = cx - tot / 2; const iy = H * 0.835;
        feats.forEach((f, k) => {
          if (icons[k]) ctx.drawImage(icons[k], ix, iy, isz, isz);
          ctx.fillStyle = '#111'; ctx.textAlign = 'center';
          ctx.font = '600 ' + Math.round(H * 0.016) + 'px Jost,sans-serif';
          ctx.fillText(String(f.v), ix + isz / 2, iy + isz + H * 0.022);
          ctx.font = '400 ' + Math.round(H * 0.014) + 'px Jost,sans-serif';
          ctx.fillText(f.l, ix + isz / 2, iy + isz + H * 0.038);
          ix += isz + gap;
        });
      }
    } else if (slide.type === 'amenities') {
      const split = W * 0.58;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, split, H); ctx.clip(); cover(photo, 0, 0, split, H); ctx.restore();
      drawLogo(split / 2, H - H * 0.038);
      ctx.fillStyle = '#fff'; ctx.fillRect(split, 0, W - split, H);
      const px = split + W * 0.024, maxW = W - px - W * 0.03;
      ctx.fillStyle = '#111'; ctx.textAlign = 'center';
      ctx.font = Math.round(H * 0.044) + 'px ' + TS + ',serif';
      ctx.fillText(L.amen, split + (W - split) / 2, H * 0.128);
      ctx.textAlign = 'left';
      let cy = H * 0.31; const lh = H * 0.062 * 0.75, dot = H * 0.0023;
      const section = (title, list, limitTitle, limit) => {
        ctx.fillStyle = '#111'; ctx.font = '700 ' + Math.round(H * 0.015) + 'px Jost,sans-serif';
        if (cy < limitTitle) { ctx.fillText(title, px, cy); cy += H * 0.042; }
        ctx.font = '400 ' + Math.round(H * 0.019) + 'px Jost,sans-serif';
        list.forEach((s) => {
          if (cy > limit) return;
          ctx.beginPath(); ctx.arc(px + dot * 1.5, cy - H * 0.0034, dot, 0, Math.PI * 2); ctx.fill();
          // Si un ítem es muy largo, se parte en dos líneas
          const words = s.split(' '); let line = ''; const lines = [];
          words.forEach((w) => { const t = line + (line ? ' ' : '') + w; if (ctx.measureText(t).width > maxW - H * 0.01 && line) { lines.push(line); line = w; } else line = t; });
          lines.push(line);
          lines.forEach((ln, k) => { if (cy <= limit) { ctx.fillText(ln, px + H * 0.01, cy); cy += k < lines.length - 1 ? lh * 0.8 : lh; } });
        });
      };
      if (svc.length) { section(L.svcL, svc, H * 0.88, H * 0.85); cy += H * 0.03; }
      if (amt.length) section(L.amtL, amt, H * 0.88, H * 0.95);
    }
    return c;
  }

  function buildPDF(jpegs) {
    const enc = (s) => new TextEncoder().encode(s);
    const chunks = []; let pos = 0;
    const w = (s) => { const b = enc(s); chunks.push(b); pos += b.length; };
    const wb = (b) => { chunks.push(b); pos += b.length; };
    w('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
    const n = jpegs.length; const offs = new Array(n * 3 + 3).fill(0);
    offs[1] = pos; w('1 0 obj\n<</Type/Catalog/Pages 2 0 R>>\nendobj\n');
    const kids = Array.from({ length: n }, (_, i) => (3 + i * 3) + ' 0 R').join(' ');
    offs[2] = pos; w('2 0 obj\n<</Type/Pages/Kids [' + kids + ']/Count ' + n + '>>\nendobj\n');
    const PW = 841.89, PH = 595.28;
    for (let i = 0; i < n; i++) {
      const pageId = 3 + i * 3, imgId = 4 + i * 3, contId = 5 + i * 3;
      const { bytes, w: jW, h: jH } = jpegs[i];
      offs[imgId] = pos;
      w(imgId + ' 0 obj\n<</Type/XObject/Subtype/Image/Width ' + jW + '/Height ' + jH + '/ColorSpace/DeviceRGB/BitsPerComponent 8/Filter/DCTDecode/Length ' + bytes.length + '>>\nstream\n');
      wb(bytes); w('\nendstream\nendobj\n');
      const cs = 'q ' + PW + ' 0 0 ' + PH + ' 0 0 cm /Im' + i + ' Do Q';
      offs[contId] = pos; w(contId + ' 0 obj\n<</Length ' + cs.length + '>>\nstream\n' + cs + '\nendstream\nendobj\n');
      offs[pageId] = pos;
      w(pageId + ' 0 obj\n<</Type/Page/Parent 2 0 R/MediaBox [0 0 ' + PW + ' ' + PH + ']/Resources<</XObject<</Im' + i + ' ' + imgId + ' 0 R>>>>/Contents ' + contId + ' 0 R>>\nendobj\n');
    }
    const xref = pos, total = offs.length;
    w('xref\n0 ' + total + '\n0000000000 65535 f\r\n');
    for (let k = 1; k < total; k++) w(String(offs[k]).padStart(10, '0') + ' 00000 n\r\n');
    w('trailer\n<</Size ' + total + '/Root 1 0 R>>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(chunks, { type: 'application/pdf' });
  }

  async function make(prop, lang, opts = {}) {
    await loadFonts();
    const Q = QUALITY[opts.quality] || QUALITY.alta;
    const list = slides(prop.photos.length, bullets((prop.svc || {})[lang]).length + bullets((prop.amen || {})[lang]).length > 0);
    const jpegs = [];
    for (let k = 0; k < list.length; k++) {
      if (opts.onStatus) opts.onStatus(lang.toUpperCase() + ' · página ' + (k + 1) + ' de ' + list.length);
      const c = await drawSlide(list[k], prop, lang, Q.W, Q.H);
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', Q.q));
      jpegs.push({ bytes: new Uint8Array(await blob.arrayBuffer()), w: Q.W, h: Q.H });
      c.width = c.height = 0; // liberar memoria (importante en el celular)
    }
    return buildPDF(jpegs);
  }

  async function preview(prop, lang, onSlide) {
    await loadFonts();
    const Q = QUALITY.preview;
    const list = slides(prop.photos.length, bullets((prop.svc || {})[lang]).length + bullets((prop.amen || {})[lang]).length > 0);
    for (let k = 0; k < list.length; k++) onSlide(await drawSlide(list[k], prop, lang, Q.W, Q.H), list[k], k, list.length);
  }

  window.MaiarcPDF = { slides, make, preview, plain };
})();
