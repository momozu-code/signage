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
    let i = 0, curEl = null;
    const next = () => { if (alive()) show(); };
    const show = () => {
      const it = items[i % items.length]; i++;
      let m;
      if (it.kind === 'video') {
        m = el('video', 'm'); m.muted = true; m.playsInline = true; m.autoplay = true; m.src = it.url;
        if (items.length === 1) m.loop = true; else m.onended = next;
        m.onerror = () => timers.push(setTimeout(next, 3000));
        const p = m.play && m.play(); if (p && p.catch) p.catch(() => {});
      } else {
        m = el('img', 'm'); m.src = it.url;
        if (items.length > 1) timers.push(setTimeout(next, Math.max(1, +it.duration || 8) * 1000));
      }
      m.style.objectFit = z.fit; m.style.opacity = 0; c.append(m);
      requestAnimationFrame(() => requestAnimationFrame(() => { m.style.opacity = 1; }));
      const old = curEl; curEl = m;
      if (old) timers.push(setTimeout(() => { if (old.pause) old.pause(); old.remove(); }, 700));
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
  if (z.type === 'ticker') {
    c.style.display = 'flex'; c.style.alignItems = 'center';
    const msgs = (z.items || []).map(i => i.text).filter(Boolean);
    const t = el('div', 'tick', (msgs.length ? msgs.join('     •     ') : (z.text || '')).replace(/\n/g, '  •  '));
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
