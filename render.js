// Shared by the editor (index.html) and the player (player.html): draws one zone's content.
window.SIGN_W = 1920; window.SIGN_H = 1080;
// Sizes are designed for a 1920px-wide screen. The player swaps this for screen-relative units.
window.SIGN_PX = window.SIGN_PX || function (n) { return n + 'px'; };
function U(n) { return window.SIGN_PX(n); }

// Fonts: a built-in Google Fonts list, or a font file uploaded to the dashboard (zone.fontUrl).
window.SIGN_FONTS = {
  'Inter': '400;500;700;800', 'Roboto': '400;500;700;900', 'Montserrat': '400;500;700;800', 'Poppins': '400;500;700;800',
  'Open Sans': '400;500;700;800', 'Lato': '400;700;900', 'Nunito': '400;500;700;800', 'Raleway': '400;500;700;800',
  'DM Sans': '400;500;700;800', 'Archivo': '400;500;700;800', 'Space Grotesk': '400;500;700', 'Source Sans 3': '400;500;700;800',
  'Oswald': '400;500;700', 'Bebas Neue': '400', 'Anton': '400', 'Playfair Display': '400;500;700;800', 'Merriweather': '400;700;900',
  'Roboto Mono': '400;500;700'
};
const _fontsLoaded = {};
function ensureFont(name, url) {
  if (!name || _fontsLoaded[name]) return;
  _fontsLoaded[name] = 1;
  if (url) {
    const st = document.createElement('style');
    st.textContent = '@font-face{font-family:"' + name.replace(/["\\]/g, '') + '";src:url("' + encodeURI(url) + '");font-display:swap}';
    document.head.appendChild(st);
  } else if (window.SIGN_FONTS[name]) {
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + name.replace(/ /g, '+') + ':wght@' + window.SIGN_FONTS[name] + '&display=swap';
    document.head.appendChild(l);
  }
}
function fontFamily(z) {
  if (!z.font) return '';
  ensureFont(z.font, z.fontUrl);
  return '"' + z.font.replace(/["\\]/g, '') + '", Inter, Roboto, sans-serif';
}
// Release a video fully (file and decoder), not just pause it. Fire TV has very few video decoders.
window.releaseMedia = function (n) {
  if (n && n.tagName === 'VIDEO') { try { n.onended = n.onerror = null; n.pause(); n.removeAttribute('src'); n.load(); } catch (e) {} }
};
// The player can supply a locally saved copy of a file (see player.html); otherwise use the web address.
function mediaSrc(url) { return window.SIGN_MEDIA ? window.SIGN_MEDIA(url) : url; }
// Ticker announcement parts: small source line, headline, small date line.
function fmtDate(d) {
  if (!d) return '';
  const p = String(d).slice(0, 10).split('-').map(Number);
  if (p.length < 3 || !p[0]) return '';
  try { return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }); } catch (e) { return String(d).slice(0, 10); }
}
// Line 1 (source + date) has its own size, colour, weight and font; defaults follow the headline.
function metaSize(z) { return +z.metaSize || Math.round(z.fontSize * (z.smallScale || 0.32)); }
function metaFont(z) { return z.metaFont ? fontFamily({ font: z.metaFont, fontUrl: z.metaFontUrl }) : fontFamily(z); }
function smallStyle(z, ff, kind) {
  const st = { color: z.subColor || '#FA0060', opacity: 1, fontSize: U(metaSize(z)), fontFamily: metaFont(z), lineHeight: 1.2, whiteSpace: 'nowrap', fontWeight: +z.metaWeight || 500 };
  if (kind === 'source') { st.textTransform = 'uppercase'; st.letterSpacing = '0.12em'; }
  return st;
}
// The small square picture at the left of a ticker announcement (design px).
function tickerImgSize(z) { return Math.round((z.h / 100) * window.SIGN_H * (+z.imgScale || 0.74)); }
// One small line above the headline: "SOURCE: Nov 11, 2026" (either part can be hidden).
function metaLine(z, ff, m, tag) {
  const showS = z.showSource !== false && m.source, showD = z.showDate !== false && m.date;
  if (!showS && !showD) return null;
  const line = el(tag || 'div'); Object.assign(line.style, smallStyle(z, ff, 'date'));
  if (showS) { const sp = el('span', null, m.source + (showD ? ':' : '')); sp.style.textTransform = 'uppercase'; sp.style.letterSpacing = '0.12em'; sp.style.fontWeight = Math.min(900, (+z.metaWeight || 500) + 100); line.append(sp); }
  if (showS && showD) line.append(document.createTextNode(' '));
  if (showD) line.append(document.createTextNode(fmtDate(m.date)));
  return line;
}
function whenFontsReady(cb) { try { if (document.fonts && document.fonts.ready) document.fonts.ready.then(cb); } catch (e) {} }

window.el = function (tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
};
window.place = function (e, z) {
  e.style.left = z.x + '%'; e.style.top = z.y + '%'; e.style.width = z.w + '%'; e.style.height = z.h + '%';
};

// live = animate playlists (player / preview). timers collects timeouts to clear. alive() says whether this render is still current.
window.buildContent = function (c, z, live, timers, alive) {
  alive = alive || (() => true);
  c.style.background = z.bg;
  if (z.type === 'media') {
    const items = (z.items || []).filter(i => i.url && i.kind !== 'ticker');
    if (!items.length) {
      if (!live) { const ph = el('div', 'ph'); ph.append(el('b', null, '▤'), el('span', null, z.playlist_id ? 'Playlist is empty' : 'Choose a playlist')); c.append(ph); }
      return;
    }
    if (!live) {
      const it = items[0]; let m;
      if (it.kind === 'video') { m = el('video', 'm'); m.muted = true; m.preload = 'metadata'; m.src = it.url + '#t=0.1'; }
      else { m = el('img', 'm'); m.src = it.url; m.draggable = false; }
      m.style.objectFit = z.fit; c.append(m);
      if (items.length > 1) c.append(el('div', 'badge', items.length + ' items'));
      return;
    }
    // A timeout that removes itself from the list once it has run, so the list doesn't grow forever.
    const later = (fn, ms) => { const id = setTimeout(() => { const k = timers.indexOf(id); if (k >= 0) timers.splice(k, 1); fn(); }, ms); timers.push(id); };
    let i = 0, curEl = null, loops = 0;
    const next = () => { if (alive()) show(); };
    const show = () => {
      const it = items[i % items.length]; i++;
      let m;
      if (it.kind === 'video') {
        m = el('video', 'm'); m.muted = true; m.playsInline = true; m.autoplay = true; m.preload = 'auto'; m.src = mediaSrc(it.url);
        if (items.length === 1) {
          // Single video: restart it by hand instead of the built-in loop (which leaks on Fire TV),
          // and swap in a fresh video element every 10 plays.
          m.onended = () => {
            if (!alive()) return;
            loops++;
            if (loops % 10 === 0) { show(); return; }
            try { m.currentTime = 0; const p2 = m.play(); if (p2 && p2.catch) p2.catch(() => {}); } catch (e) { show(); }
          };
        } else m.onended = next;
        m.onerror = () => later(next, 3000);
        const p = m.play && m.play(); if (p && p.catch) p.catch(() => {});
      } else {
        m = el('img', 'm'); m.src = mediaSrc(it.url);
        if (items.length > 1) later(next, Math.max(1, +it.duration || 8) * 1000);
      }
      m.style.objectFit = z.fit;
      const old = curEl; curEl = m;
      const fade = !!old && items.length > 1;
      if (fade) m.style.opacity = 0;
      c.append(m);
      if (fade) requestAnimationFrame(() => requestAnimationFrame(() => { m.style.opacity = 1; }));
      if (old) {
        if (fade) later(() => { releaseMedia(old); old.remove(); }, 700);
        else { releaseMedia(old); old.remove(); }
      }
    };
    show();
    return;
  }
  if (z.type === 'text') {
    c.style.display = 'flex';
    c.style.justifyContent = { left: 'flex-start', center: 'center', right: 'flex-end' }[z.align] || 'center';
    c.style.alignItems = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[z.valign] || 'center';
    c.style.padding = U(48);
    const t = el('div', null, z.text);
    Object.assign(t.style, { color: z.color, fontSize: U(z.fontSize), fontWeight: z.weight, textAlign: z.align, whiteSpace: 'pre-wrap', lineHeight: 1.2, fontFamily: fontFamily(z) });
    c.append(t); return;
  }
  if (z.type === 'ticker' && z.mode === 'slides') {
    // One announcement at a time: hold each for its duration, then slide or fade to the next.
    let msgs = (z.items || []).filter(i => i.text).map(i => ({ text: i.text, source: i.source, date: i.date, image: i.image, dur: +i.duration || 8 }));
    if (!msgs.length) msgs = String(z.text || '').split('\n').map(t => t.trim()).filter(Boolean)
      .map(t => ({ text: t, dur: 8, source: live ? '' : 'Department', date: live ? '' : new Date().toISOString().slice(0, 10), sample: !live, sampleImg: !live }));
    if (!msgs.length) return;
    const dir = z.transition || 'up', ff = fontFamily(z);
    const off = sign => dir === 'left' ? 'translateX(' + (sign * 100) + '%)' : dir === 'up' ? 'translateY(' + (sign * 100) + '%)' : 'translateX(0)';
    const zoneH = (z.h / 100) * window.SIGN_H, imgPx = tickerImgSize(z);
    const edge = Math.max(12, Math.round((zoneH - imgPx) / 2));          // same gap around the picture on all sides
    const make = m => {
      const d = el('div');
      const withImg = z.showImage !== false && (m.image || m.sampleImg);
      Object.assign(d.style, { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, display: 'flex', flexDirection: 'row', alignItems: 'center',
        padding: '0 ' + U(48) + ' 0 ' + U(withImg ? edge : 48), boxSizing: 'border-box', overflow: 'hidden',
        transition: 'transform .6s ease, opacity .6s ease', webkitTransition: '-webkit-transform .6s ease, opacity .6s ease' });
      if (withImg) {
        const im = el('div');
        Object.assign(im.style, { width: U(imgPx), height: U(imgPx), flexShrink: 0, borderRadius: U(z.imgRadius == null ? 18 : +z.imgRadius), marginRight: U(edge),
          backgroundColor: 'rgba(255,255,255,0.08)', backgroundSize: 'cover', backgroundPosition: 'center', overflow: 'hidden' });
        if (m.image) im.style.backgroundImage = 'url("' + encodeURI(m.image) + '")';
        d.append(im);
      }
      const col = el('div');
      Object.assign(col.style, { flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: z.align === 'left' || withImg && z.align !== 'center' ? 'flex-start' : 'center' });
      const gap = U(Math.round(z.fontSize * 0.12));
      const meta = metaLine(z, ff, m);
      if (meta) { meta.style.marginBottom = gap; if (m.sample) meta.style.opacity = 0.45; col.append(meta); }
      const t = el('div', null, m.text);
      Object.assign(t.style, { color: z.color, fontSize: U(z.fontSize), fontWeight: z.weight || 700, fontFamily: ff, whiteSpace: 'nowrap', lineHeight: 1.15,
        textAlign: col.style.alignItems === 'center' ? 'center' : 'left', maxWidth: '100%' });
      col.append(t); d.append(col);
      return { d, t, col };
    };
    // Shrink a long headline to fit; past 60% size, let it wrap instead.
    const fit = (col, t) => {
      t.style.fontSize = U(z.fontSize); t.style.whiteSpace = 'nowrap';
      const room = col.clientWidth;
      if (!(room > 0) || t.scrollWidth <= room) return;
      const r = room / t.scrollWidth;
      if (r >= 0.6) t.style.fontSize = U(Math.floor(z.fontSize * r));
      else { t.style.fontSize = U(Math.floor(z.fontSize * 0.6)); t.style.whiteSpace = 'normal'; }
    };
    let i = 0, cur = null;
    const show = first => {
      const m = msgs[i % msgs.length]; i++;
      const s = make(m);
      const animate = live && msgs.length > 1 && !first;
      if (animate) { s.d.style.transform = s.d.style.webkitTransform = off(1); if (dir === 'fade') s.d.style.opacity = 0; }
      c.append(s.d);
      fit(s.col, s.t);
      if (z.font || z.metaFont) whenFontsReady(() => fit(s.col, s.t));
      if (animate) {
        const old = cur;
        requestAnimationFrame(() => requestAnimationFrame(() => {
          s.d.style.transform = s.d.style.webkitTransform = 'translateX(0)'; s.d.style.opacity = 1;
          if (old) { old.style.transform = old.style.webkitTransform = off(-1); if (dir === 'fade') old.style.opacity = 0; }
        }));
        if (old) { const id = setTimeout(() => { const k = timers.indexOf(id); if (k >= 0) timers.splice(k, 1); old.remove(); }, 700); timers.push(id); }
      } else if (cur) cur.remove();
      cur = s.d;
      if (live && msgs.length > 1) { const id = setTimeout(() => { const k = timers.indexOf(id); if (k >= 0) timers.splice(k, 1); if (alive()) show(false); }, Math.max(2, m.dur) * 1000); timers.push(id); }
    };
    c.style.position = 'absolute'; c.style.overflow = 'hidden';
    show(true);
    return;
  }
  if (z.type === 'ticker') {
    c.style.display = 'flex'; c.style.alignItems = 'center';
    const items = (z.items || []).filter(i => i.text);
    const t = el('div', 'tick');
    if (!items.length) t.textContent = String(z.text || '').replace(/\n/g, '  •  ');
    const ffs = fontFamily(z);
    items.forEach((it, k) => {
      if (k) t.append(document.createTextNode('     •     '));
      if (z.showImage !== false && it.image) {
        const im = el('span');
        Object.assign(im.style, { display: 'inline-block', width: '1.2em', height: '1.2em', verticalAlign: 'middle', marginRight: '0.5em',
          borderRadius: U(Math.round((z.imgRadius == null ? 18 : +z.imgRadius) * 0.5)), backgroundImage: 'url("' + encodeURI(it.image) + '")', backgroundSize: 'cover', backgroundPosition: 'center' });
        t.append(im);
      }
      const meta = metaLine(z, ffs, it, 'span');
      if (meta) { meta.style.verticalAlign = 'middle'; meta.style.marginRight = '0.6em'; t.append(meta); }
      t.append(document.createTextNode(it.text.replace(/\n/g, ' ')));
    });
    Object.assign(t.style, { color: z.color, fontSize: U(z.fontSize), fontWeight: z.weight || 700, whiteSpace: 'nowrap', flexShrink: 0, fontFamily: fontFamily(z) });
    c.append(t);
    let anim = null;
    const run = () => {
      const bw = c.offsetWidth, tw = t.offsetWidth;
      if (!bw || !t.animate) return;
      if (anim) anim.cancel();
      // speed is in design pixels per second; scale it to this screen
      const pxPerSec = Math.max(20, +z.speed || 160) * (bw / (z.w / 100 * window.SIGN_W) || 1);
      anim = t.animate([{ transform: 'translateX(' + bw + 'px)' }, { transform: 'translateX(' + (-tw) + 'px)' }],
        { duration: (bw + tw) / pxPerSec * 1000, iterations: Infinity });
    };
    requestAnimationFrame(run);
    if (z.font) whenFontsReady(run);   // re-measure once the chosen font has loaded
    return;
  }
  if (z.type === 'clock') {
    c.style.display = 'flex'; c.style.flexDirection = 'column'; c.style.alignItems = 'center'; c.style.justifyContent = 'center';
    const tm = el('div'), dt = el('div');
    const ff = fontFamily(z);
    Object.assign(tm.style, { color: z.color, fontSize: U(z.fontSize), fontWeight: z.weight || 700, lineHeight: 1, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', fontFamily: ff });
    Object.assign(dt.style, { color: z.color, opacity: .7, fontSize: U(Math.round(z.fontSize * .32)), marginTop: U(Math.round(z.fontSize * .18)), fontWeight: 500, fontFamily: ff });
    const tick = () => {
      const d = new Date();
      tm.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: z.format !== '24' });
      dt.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };
    tick(); timers.push(setInterval(tick, 1000));
    c.append(tm); if (z.showDate) c.append(dt);
  }
};
