document.getElementById('year').textContent = new Date().getFullYear();

/* ===== Dados válidos (com local conhecido) ===== */
const VALID_PHOTOS = PHOTOS.filter(p => p.local && p.local !== 'sem GPS' && p.local !== '?');
const NO_LOC_PHOTOS = PHOTOS.filter(p => !p.local || p.local === 'sem GPS' || p.local === '?');

/* contagem hero */
const countries = new Set(VALID_PHOTOS.map(p => p.pais).filter(Boolean));
document.getElementById('heroCountries').textContent = countries.size;
document.getElementById('heroPhotos').textContent = PHOTOS.length;

/* ===== Nav ===== */
const burger = document.getElementById('navBurger');
const navMobile = document.getElementById('navMobile');
burger.addEventListener('click', () => navMobile.classList.toggle('open'));
navMobile.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navMobile.classList.remove('open')));

let lastScroll = 0;
const floatNav = document.getElementById('floatNav');
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  floatNav.style.top = (y > 80 && y > lastScroll) ? '-90px' : '22px';
  lastScroll = y;
}, { passive: true });

/* ===== Galeria (masonry) ===== */
const masonry = document.getElementById('masonry');
let activeLocal = null;

function renderGallery(themeFilter = 'all') {
  masonry.innerHTML = '';
  PHOTOS.forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.dataset.theme = p.theme;
    tile.dataset.local = p.local;
    tile.dataset.id = p.id;
    if (themeFilter !== 'all' && p.theme !== themeFilter) tile.classList.add('hidden');
    if (activeLocal && p.local !== activeLocal) tile.classList.add('hidden');

    const cityLine = p.cidade ? `<b>${p.cidade}${p.pais ? ', ' + p.pais : ''}</b>${p.frase}` : `<b>${p.theme}</b>${p.frase}`;
    tile.innerHTML = `
      <img src="${p.src}" alt="${p.cidade || p.theme}" loading="lazy">
      <div class="tile-overlay"><p class="tile-loc">${cityLine}</p></div>
    `;
    tile.addEventListener('click', () => openLightbox(p.id));
    masonry.appendChild(tile);
  });
  observeTiles();
}
renderGallery();

const io = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); } });
}, { threshold: 0.08 });
function observeTiles() {
  document.querySelectorAll('.tile:not(.hidden)').forEach(t => io.observe(t));
}

document.getElementById('filters').addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-chip');
  if (!btn) return;
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  activeLocal = null;
  document.querySelectorAll('.legend-chip').forEach(c => c.classList.remove('active'));
  renderGallery(btn.dataset.theme);
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
gridGroup.setAttribute('class', 'map-graticule');
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
Object.entries(byLocal).forEach(([local, info]) => {
  const [x, y] = project(info.lat, info.lon);
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'map-pin');
  g.dataset.local = local;

  const circle = document.createElementNS(NS, 'circle');
  circle.setAttribute('cx', x); circle.setAttribute('cy', y);
  circle.setAttribute('r', 3 + Math.min(info.count, 5));
  circle.setAttribute('fill', '#d8c3a0');
  circle.setAttribute('fill-opacity', '0.85');
  g.appendChild(circle);

  const label = document.createElementNS(NS, 'text');
  label.setAttribute('class', 'map-pin-label');
  label.setAttribute('x', x + 8); label.setAttribute('y', y + 3);
  label.textContent = info.cidade;
  g.appendChild(label);

  g.addEventListener('click', () => {
    document.querySelectorAll('.map-pin').forEach(el => el.classList.remove('active'));
    g.classList.add('active');
    activeLocal = local;
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    document.querySelector('.filter-chip[data-theme="all"]').classList.add('active');
    document.querySelectorAll('.legend-chip').forEach(c => c.classList.toggle('active', c.dataset.local === local));
    renderGallery('all');
    document.getElementById('galeria').scrollIntoView({ behavior: 'smooth' });
  });

  pinsGroup.appendChild(g);
});
svg.appendChild(pinsGroup);

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
let currentIndex = 0;
let currentList = PHOTOS;

function openLightbox(id) {
  currentList = PHOTOS.filter(p => !document.querySelector(`.tile[data-id="${p.id}"]`)?.classList.contains('hidden'));
  if (!currentList.length) currentList = PHOTOS;
  currentIndex = currentList.findIndex(p => p.id === id);
  showSlide();
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function showSlide() {
  const p = currentList[currentIndex];
  lbImg.src = p.src;
  lbImg.alt = p.cidade || p.theme;
  lbLocation.innerHTML = p.cidade
    ? `${p.cidade} <span class="country">— ${p.pais}</span>`
    : p.theme;
  lbPhrase.textContent = p.frase;
}
function closeLightbox() {
  lightbox.classList.remove('open');
  document.body.style.overflow = '';
}
document.getElementById('lbClose').addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
document.getElementById('lbPrev').addEventListener('click', () => { currentIndex = (currentIndex - 1 + currentList.length) % currentList.length; showSlide(); });
document.getElementById('lbNext').addEventListener('click', () => { currentIndex = (currentIndex + 1) % currentList.length; showSlide(); });
document.addEventListener('keydown', (e) => {
  if (!lightbox.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') document.getElementById('lbPrev').click();
  if (e.key === 'ArrowRight') document.getElementById('lbNext').click();
});
