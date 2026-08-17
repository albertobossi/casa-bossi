document.getElementById('year').textContent = new Date().getFullYear();

const cssNum = (name) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)) || 0;
const STAGGER = cssNum('--cb-stagger');
const DUR_FILTER = cssNum('--cb-dur-filter');
const REVEAL_THRESHOLD = cssNum('--cb-reveal-threshold') || 0.15;
const PARALLAX = cssNum('--cb-parallax-hero') || 0;
const MENU_TRIGGER = cssNum('--cb-menu-scroll-trigger') || 80;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ===== Dados válidos (com local conhecido) ===== */
const VALID_PHOTOS = PHOTOS.filter(p => p.local && p.local !== 'sem GPS' && p.local !== '?');

/* contagem hero */
const countries = new Set(VALID_PHOTOS.map(p => p.pais).filter(Boolean));
document.getElementById('heroCountries').textContent = countries.size;
document.getElementById('heroPhotos').textContent = PHOTOS.length;

/* ===== Menu ===== */
const menu = document.getElementById('menu');
window.addEventListener('scroll', () => {
  menu.classList.toggle('is-scrolled', window.scrollY > MENU_TRIGGER);
}, { passive: true });

const burger = document.getElementById('menuBurger');
const overlay = document.getElementById('menuOverlay');
const overlayClose = document.getElementById('menuOverlayClose');
function openOverlay() {
  overlay.classList.add('open');
  burger.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}
function closeOverlay() {
  overlay.classList.remove('open');
  burger.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
burger.addEventListener('click', openOverlay);
overlayClose.addEventListener('click', closeOverlay);
overlay.querySelectorAll('a').forEach(a => a.addEventListener('click', closeOverlay));

/* ===== Hero parallax ===== */
const heroMedia = document.getElementById('heroMedia');
const hero = document.getElementById('topo');
if (!reducedMotion) {
  window.addEventListener('scroll', () => {
    const rect = hero.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > window.innerHeight) return;
    const progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);
    heroMedia.style.transform = `translateY(${progress * rect.height * PARALLAX}px)`;
  }, { passive: true });
}

/* ===== Reveal on scroll (shared) ===== */
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: REVEAL_THRESHOLD });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

/* ===== Galeria (masonry) ===== */
const masonry = document.getElementById('masonry');
let activeLocal = null;

const tileObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-visible');
      tileObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

function revealTiles(tiles) {
  tiles.forEach((tile, i) => {
    tile.style.transitionDelay = `${(i % 6) * STAGGER}ms`;
    tileObserver.observe(tile);
  });
}

function buildTiles(themeFilter) {
  masonry.innerHTML = '';
  const tiles = [];
  PHOTOS.forEach(p => {
    if (themeFilter !== 'all' && p.theme !== themeFilter) return;
    if (activeLocal && p.local !== activeLocal) return;

    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.theme = p.theme;
    tile.dataset.local = p.local;
    tile.dataset.id = p.id;
    tile.setAttribute('role', 'button');
    tile.setAttribute('tabindex', '0');
    const place = p.cidade ? `${p.cidade}, ${p.pais}` : p.theme;
    tile.setAttribute('aria-label', `Ver fotografia — ${place}`);

    const cityLine = p.cidade ? `<b>${p.cidade}, ${p.pais}</b>${p.frase}` : `<b>${p.theme}</b>${p.frase}`;
    tile.innerHTML = `
      <img src="${p.src}" alt="${place}" loading="lazy">
      <div class="tile-overlay"><p class="tile-loc">${cityLine}</p></div>
    `;
    const open = () => openLightbox(p.id);
    tile.addEventListener('click', open);
    tile.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    masonry.appendChild(tile);
    tiles.push(tile);
  });
  return tiles;
}

function renderGallery(themeFilter = 'all') {
  const tiles = buildTiles(themeFilter);
  revealTiles(tiles);
}
renderGallery();

function switchFilter(themeFilter) {
  if (reducedMotion) { renderGallery(themeFilter); return; }
  masonry.classList.add('is-filtering');
  setTimeout(() => {
    const tiles = buildTiles(themeFilter);
    masonry.classList.remove('is-filtering');
    requestAnimationFrame(() => revealTiles(tiles));
  }, DUR_FILTER);
}

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-chip');
  if (!btn) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeLocal = null;
  document.querySelectorAll('.legend-chip').forEach(c => c.classList.remove('active'));
  switchFilter(btn.dataset.theme);
});

/* ===== Mapa (mundi real, com zoom no hover) ===== */
const svg = document.getElementById('worldMap');
const NS = 'http://www.w3.org/2000/svg';
const W = 1000, H = 500;

function project(lat, lon) {
  const x = (lon + 180) / 360 * W;
  const y = (90 - lat) / 180 * H;
  return [x, y];
}

// graticule sutil
const gridGroup = document.createElementNS(NS, 'g');
gridGroup.setAttribute('opacity', '0.05');
gridGroup.setAttribute('stroke', 'currentColor');
for (let i = 0; i <= 8; i++) {
  const x = i * W / 8;
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', x); l.setAttribute('y1', 0); l.setAttribute('x2', x); l.setAttribute('y2', H);
  gridGroup.appendChild(l);
}
for (let j = 0; j <= 4; j++) {
  const y = j * H / 4;
  const l = document.createElementNS(NS, 'line');
  l.setAttribute('x1', 0); l.setAttribute('y1', y); l.setAttribute('x2', W); l.setAttribute('y2', y);
  gridGroup.appendChild(l);
}
svg.appendChild(gridGroup);

// continentes (contornos simplificados, mesma projeção equiretangular dos pontos)
const LANDMASSES = [
  { name: 'América do Norte', points: [[83,-70],[70,-95],[68,-133],[71,-156],[66,-165],[58,-162],[55,-160],[48,-125],[40,-124],[32,-117],[23,-110],[20,-105],[16,-95],[14,-92],[9,-83],[8,-77],[10,-83.5],[16,-88],[21,-87],[25,-97],[29,-89],[25,-80],[30,-81],[35,-76],[40,-74],[44,-67],[47,-70],[55,-60],[60,-65],[68,-83],[75,-90],[83,-70]] },
  { name: 'América do Sul', points: [[8,-77],[11,-72],[10,-64],[8,-59],[5,-52],[-1,-48],[-5,-35],[-8,-34.9],[-13,-38.5],[-20,-40],[-23,-43],[-24,-46.5],[-26,-48.5],[-30,-50],[-34,-58],[-38,-62],[-45,-67],[-50,-69],[-53,-68],[-55,-68],[-52,-73],[-45,-74],[-38,-73],[-33,-71.6],[-23,-70.4],[-18,-70.3],[-12,-77],[-3,-80.7],[1,-79],[4,-77],[8,-77]] },
  { name: 'Europa', points: [[71,25],[65,25],[60,30],[55,38],[47,40],[45,36],[41,29],[40,26],[38,24],[36,23],[40,19],[41,16],[38,15],[41,9],[43,7],[36,-6],[37,-9],[38.7,-9.4],[43,-9],[46,-2],[49,-5],[51,2],[53,8],[55,12],[58,11],[60,5],[62,6],[67,15],[71,25]] },
  { name: 'Reino Unido/Irlanda', points: [[58.5,-3],[57,-2],[53,0],[51,1.5],[50,-5],[51,-5.5],[53,-4.5],[55,-6],[58.5,-3]] },
  { name: 'África', points: [[37,10],[32,32],[15,39],[11,43],[-1,42],[-6,39],[-18,35],[-26,33],[-34,20],[-29,17],[-17,11.7],[4,9],[6,-3],[15,-17],[21,-17],[31,-9.5],[35,-6],[37,10]] },
  { name: 'Madagascar', points: [[-12,49],[-16,50],[-22,47.5],[-25,45],[-21,43.5],[-16,44.5],[-12,49]] },
  { name: 'Ásia', points: [[77,105],[70,140],[66,170],[60,163],[51,157],[45,142],[40,128],[31,122],[22,114],[16,108],[10,106],[1,104],[6,95],[8,77],[15,73],[24,68],[25,57],[30,49],[29,34.5],[37,36],[42,41],[47,40],[55,60],[70,60],[77,105]] },
  { name: 'Japão', points: [[45,141],[43,145],[38,141],[35,140],[33,130],[31,130],[34,135],[38,138],[41,140],[45,141]] },
  { name: 'Austrália', points: [[-11,132],[-12,141],[-17,146],[-23,151],[-28,153.5],[-33,151.3],[-38,147],[-38,144.9],[-35,137.8],[-32,133],[-34,115],[-32,115.8],[-25,113.5],[-20,113.5],[-16,123],[-11,132]] },
];

const landmassGroup = document.createElementNS(NS, 'g');
landmassGroup.setAttribute('class', 'landmass-group');
LANDMASSES.forEach(({ name, points }) => {
  const d = points.map(([lat, lon], i) => {
    const [x, y] = project(lat, lon);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ') + 'Z';
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('class', 'landmass');
  path.setAttribute('aria-label', name);
  landmassGroup.appendChild(path);
});
svg.appendChild(landmassGroup);

// zoom sutil seguindo o cursor
const mapWrap = document.querySelector('.map-wrap');
if (mapWrap && !reducedMotion) {
  mapWrap.addEventListener('mousemove', (e) => {
    const rect = mapWrap.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    svg.style.transformOrigin = `${xPct}% ${yPct}%`;
  });
}

// agrupar por local
const byLocal = {};
VALID_PHOTOS.forEach(p => {
  if (!byLocal[p.local]) byLocal[p.local] = { lat: p.lat, lon: p.lon, cidade: p.cidade, pais: p.pais, count: 0 };
  byLocal[p.local].count++;
});

const pinsGroup = document.createElementNS(NS, 'g');
const pinEls = [];
Object.entries(byLocal).forEach(([local, info]) => {
  const [x, y] = project(info.lat, info.lon);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'map-pin reveal-pin');
  g.setAttribute('role', 'button');
  g.setAttribute('tabindex', '0');
  g.setAttribute('aria-label', `${info.cidade}, ${info.pais} — ${info.count} fotografia${info.count > 1 ? 's' : ''}`);
  g.dataset.local = local;

  const halo = document.createElementNS(NS, 'circle');
  halo.setAttribute('class', 'dot-halo');
  halo.setAttribute('cx', x); halo.setAttribute('cy', y);
  halo.setAttribute('r', 3 + Math.min(info.count, 5) + 6);
  g.appendChild(halo);

  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('class', 'dot');
  circle.setAttribute('cx', x); circle.setAttribute('cy', y);
  circle.setAttribute('r', 3 + Math.min(info.count, 5));
  g.appendChild(circle);

  const hit = document.createElementNS(NS, 'circle');
  hit.setAttribute('cx', x); hit.setAttribute('cy', y); hit.setAttribute('r', 12);
  hit.setAttribute('fill', 'transparent');
  g.appendChild(hit);

  const label = document.createElementNS(NS, 'text');
  label.setAttribute('class', 'map-pin-label');
  label.setAttribute('x', x + 10); label.setAttribute('y', y + 4);
  label.textContent = info.cidade;
  g.appendChild(label);

  function activate() {
    document.querySelectorAll('.map-pin').forEach(el => el.classList.remove('active'));
    g.classList.add('active');
    activeLocal = local;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-chip[data-theme="all"]').classList.add('active');
    document.querySelectorAll('.legend-chip').forEach(c => c.classList.toggle('active', c.dataset.local === local));
    switchFilter('all');
    document.getElementById('galeria').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }
  g.addEventListener('click', activate);
  g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });

  pinsGroup.appendChild(g);
  pinEls.push(g);
});
svg.appendChild(pinsGroup);

// acende os pontos em sequência quando o mapa entra na tela
const mapReveal = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      pinEls.forEach((pin, i) => {
        pin.style.transitionDelay = `${(i % 6) * STAGGER}ms`;
        pin.classList.add('is-visible');
      });
      mapReveal.unobserve(entry.target);
    }
  });
}, { threshold: REVEAL_THRESHOLD });
mapReveal.observe(svg);

// legendas clicáveis abaixo do mapa
const legend = document.getElementById('mapLegend');
Object.entries(byLocal).sort((a, b) => b[1].count - a[1].count).forEach(([local, info]) => {
  const chip = document.createElement('button');
  chip.className = 'legend-chip';
  chip.dataset.local = local;
  chip.textContent = `${info.cidade} (${info.count})`;
  chip.addEventListener('click', () => {
    document.querySelector(`.map-pin[data-local="${CSS.escape(local)}"]`).dispatchEvent(new Event('click'));
  });
  legend.appendChild(chip);
});

/* ===== Lightbox ===== */
const lightbox = document.getElementById('lightbox');
const lbImg = document.getElementById('lbImg');
const lbLocation = document.getElementById('lbLocation');
const lbPhrase = document.getElementById('lbPhrase');
const lbClose = document.getElementById('lbClose');
const lbPrev = document.getElementById('lbPrev');
const lbNext = document.getElementById('lbNext');
let currentIndex = 0;
let currentList = PHOTOS;
let lastFocused = null;

function openLightbox(id) {
  lastFocused = document.activeElement;
  currentList = PHOTOS.filter(p => !document.querySelector(`.tile[data-id="${p.id}"]`)?.classList.contains('hidden'));
  if (!currentList.length) currentList = PHOTOS;
  currentIndex = currentList.findIndex(p => p.id === id);
  showSlide();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
  lbClose.focus();
}
function showSlide() {
  const p = currentList[currentIndex];
  lbImg.src = p.src;
  lbImg.alt = p.cidade ? `${p.cidade}, ${p.pais}` : p.theme;
  lbLocation.innerHTML = p.cidade
    ? `${p.cidade} <span class="country">— ${p.pais}</span>`
    : p.theme;
  lbPhrase.textContent = p.frase;
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
  if (lastFocused) lastFocused.focus();
}
lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
lbPrev.addEventListener('click', () => { currentIndex = (currentIndex - 1 + currentList.length) % currentList.length; showSlide(); });
lbNext.addEventListener('click', () => { currentIndex = (currentIndex + 1) % currentList.length; showSlide(); });

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') { closeLightbox(); return; }
  if (e.key === 'ArrowLeft') { lbPrev.click(); return; }
  if (e.key === 'ArrowRight') { lbNext.click(); return; }
  if (e.key === 'Tab') {
    const focusables = Array.from(lightbox.querySelectorAll(FOCUSABLE));
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
