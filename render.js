// Shared by the editor (index.html) and the player (player.html): draws one zone's content.
window.SIGN_W = 1920; window.SIGN_H = 1080;

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
    const items = (z.items || []).filter(i => i.url);
    if (!items.length) {
      if (!live) { const ph = el('div', 'ph'); ph.append(el('b', null, '＋'), el('span', null, 'Add images or videos')); c.append(ph); }
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
    c.style.padding = '48px';
    const t = el('div', null, z.text);
    Object.assign(t.style, { color: z.color, fontSize: z.fontSize + 'px', fontWeight: z.weight, textAlign: z.align, whiteSpace: 'pre-wrap', lineHeight: 1.2 });
    c.append(t); return;
  }
  if (z.type === 'ticker') {
    c.style.display = 'flex'; c.style.alignItems = 'center';
    const t = el('div', 'tick', (z.text || '').replace(/\n/g, '  •  '));
    Object.assign(t.style, { color: z.color, fontSize: z.fontSize + 'px', fontWeight: z.weight || 700, whiteSpace: 'nowrap', flexShrink: 0 });
    c.append(t);
    requestAnimationFrame(() => {
      const bw = c.offsetWidth, tw = t.offsetWidth;
      if (!bw || !t.animate) return;
      t.animate([{ transform: `translateX(${bw}px)` }, { transform: `translateX(${-tw}px)` }],
        { duration: (bw + tw) / Math.max(20, +z.speed || 160) * 1000, iterations: Infinity });
    });
    return;
  }
  if (z.type === 'clock') {
    c.style.display = 'flex'; c.style.flexDirection = 'column'; c.style.alignItems = 'center'; c.style.justifyContent = 'center';
    const tm = el('div'), dt = el('div');
    Object.assign(tm.style, { color: z.color, fontSize: z.fontSize + 'px', fontWeight: 700, lineHeight: 1, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' });
    Object.assign(dt.style, { color: z.color, opacity: .7, fontSize: Math.round(z.fontSize * .32) + 'px', marginTop: Math.round(z.fontSize * .18) + 'px', fontWeight: 500 });
    const tick = () => {
      const d = new Date();
      tm.textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: z.format !== '24' });
      dt.textContent = d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    };
    tick(); timers.push(setInterval(tick, 1000));
    c.append(tm); if (z.showDate) c.append(dt);
  }
};
