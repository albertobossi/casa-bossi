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

/* ===== Mapa (constelação estilizada) ===== */
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
