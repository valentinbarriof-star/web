// ============================================================================
// valentin3 — SPA portfolio
// ----------------------------------------------------------------------------
// Toda la web vive en esta sola página. Este script:
//   1. lee `data.json` (proyectos)
//   2. pinta la home (tiras/strips + scroll infinito random)
//   3. pinta cada proyecto (ficha + galería + audios + textos)
//   4. enlaza URLs limpias (`/bolder`) con pushState + 404.html fallback
//   5. anima las transiciones con un "iris" en dos fases
//   6. muestra imágenes en un lightbox con FLIP-style animation
// ============================================================================


// ============================================================================
// BASE PATH
// ----------------------------------------------------------------------------
// Detectamos dónde está desplegado el sitio leyendo la URL del propio script.
// Esto hace que funcione igual en `meowrhino.github.io/valentin3/` (subdir)
// que en un dominio propio en la raíz (`valentinbarrio.com/`).
// ============================================================================
const BASE_PATH = new URL('../', import.meta.url).pathname;

/** Convierte una ruta relativa del repo en una URL absoluta válida. */
const asset = (p) => BASE_PATH + String(p).replace(/^\.?\/+/, '');

/** URL a un archivo dentro de `_PROJECTS/<slug>/`. */
const projectsAsset = (slug, file) => asset(`_PROJECTS/${slug}/${file}`);

/** URL a la imagen N-ésima de un proyecto (se asume .webp). */
const projectImgUrl = (slug, n) => projectsAsset(slug, `${n}.webp`);

/** URL a un archivo de banner (vídeo decorativo intercalado en la home). */
const bannerAsset = (file) => asset(`_BANNERS/${file}`);

/** Lee el slug actual desde la URL, o null si estamos en la home. */
function slugFromPath() {
  let p = location.pathname;
  if (p.startsWith(BASE_PATH)) p = p.slice(BASE_PATH.length);
  p = p.replace(/^\/+|\/+$/g, '');
  return p ? decodeURIComponent(p) : null;
}

/** URL canónica para un slug (o la raíz si slug=null). */
const urlForSlug = (slug) => slug ? BASE_PATH + encodeURIComponent(slug) : BASE_PATH;


// ============================================================================
// UTILIDADES
// ============================================================================
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Evitamos que el navegador restaure el scroll en el popstate: la restauración
// ocurre ANTES del handler y haría un salto visible antes de que el iris cubra.
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

/** Pequeño helper para crear elementos. `h('div', {class: 'x'}, 'hola')`. */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** Fisher-Yates shuffle (no muta el array original). */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Anima un valor de `from` a `to` en `duration`ms, llamando a `apply` cada frame. */
function animateValue(from, to, duration, easing, apply) {
  return new Promise((resolve) => {
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      apply(from + (to - from) * easing(p));
      if (p < 1) requestAnimationFrame(frame);
      else resolve();
    }
    requestAnimationFrame(frame);
  });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));


// ============================================================================
// DATA
// ============================================================================
let DATA = null;

async function loadData() {
  if (DATA) return DATA;
  const res = await fetch(asset('data.json'));
  if (!res.ok) throw new Error(`data.json ${res.status}`);
  DATA = await res.json();
  return DATA;
}

/** Busca un proyecto por slug. */
function findProject(data, slug) {
  if (!slug) return null;
  return (data.projects || []).find((p) => p.slug === slug) || null;
}


// ============================================================================
// IRIS — transición en dos fases
// ----------------------------------------------------------------------------
// Usamos un overlay a pantalla completa con un `mask-image` radial que
// animamos para abrir/cerrar un círculo. Cuatro animaciones disponibles,
// agrupadas en dos ejes: estructura de máscara (cover/reveal) × dirección
// del radio (creciente/decreciente):
//
//                      crece 0 → max        encoge max → 0
//   inner=#000        COVER (expande)       UNCOVER (encoge)
//   inner=transparent REVEAL (expande)      CLOSE (encoge)
//
//   COVER   · círculo NEGRO crece desde un punto hasta tapar todo (expansión).
//   REVEAL  · agujero TRANSPARENTE crece desde un punto descubriendo (expansión).
//   CLOSE   · inverso del reveal: el agujero transparente se ENCOGE hasta un
//             punto (el fondo entra desde los bordes y colapsa). Contracción.
//   UNCOVER · inverso del cover: el círculo negro se ENCOGE hasta desaparecer,
//             revelando la página. Contracción.
//
// Flujos:
//   ABRIR  (a proyecto): cover(dot) → reveal(centro)    — dos expansiones.
//   CERRAR (a home):     close(centro) → uncover(centro) — dos contracciones.
//
// Mientras el iris está animando marcamos `busy=true` y le damos
// `pointer-events: auto` para bloquear clicks.
// ============================================================================
const Iris = (() => {
  let el = null;
  let busy = false;

  const COVER_MS = 550;
  const PAUSE_MS = 90;   // pausa corta en negro entre fases
  const REVEAL_MS = 650;

  function ensure() {
    if (el) return el;
    el = h('div', { class: 'iris', 'aria-hidden': 'true' });
    document.body.appendChild(el);
    setMask(0, 0, 0, true); // arranca "revelado" (overlay oculto)
    return el;
  }

  function setBusy(v) {
    busy = v;
    ensure(); // garantiza que el overlay existe antes de tocar pointer-events
    el.style.pointerEvents = v ? 'auto' : 'none';
  }

  /** Radio máximo necesario para que el círculo cubra la pantalla desde (x,y). */
  function maxRadius(x, y) {
    return Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 40;
  }

  function setMask(x, y, r, covering) {
    if (!el) return;
    const inner = covering ? '#000' : 'transparent';
    const outer = covering ? 'transparent' : '#000';
    const grad = `radial-gradient(circle at ${x}px ${y}px, ${inner} ${r}px, ${outer} ${r + 1}px)`;
    el.style.webkitMaskImage = grad;
    el.style.maskImage = grad;
  }

  /** `origins` puede ser un único `{x,y}` o un array de varios. Cuando son
   *  varios, se construye un mask-image con un radial-gradient por origen
   *  (las áreas negras se suman, así dos círculos creciendo se fusionan al
   *  solaparse). */
  function cover(origins, duration = COVER_MS) {
    ensure();
    const arr = Array.isArray(origins) ? origins : [origins];
    if (REDUCED_MOTION) {
      const grads = arr.map((o) =>
        `radial-gradient(circle at ${o.x}px ${o.y}px, #000 99999px, transparent 100000px)`
      ).join(', ');
      el.style.maskImage = grads;
      el.style.webkitMaskImage = grads;
      return Promise.resolve();
    }
    const maxR = Math.max(...arr.map((o) => maxRadius(o.x, o.y)));
    return animateValue(0, maxR, duration, easeInOutCubic, (r) => {
      const grads = arr.map((o) =>
        `radial-gradient(circle at ${o.x}px ${o.y}px, #000 ${r}px, transparent ${r + 1}px)`
      ).join(', ');
      el.style.maskImage = grads;
      el.style.webkitMaskImage = grads;
    });
  }

  function reveal(x, y, duration = REVEAL_MS) {
    ensure();
    if (REDUCED_MOTION) { setMask(x, y, 99999, false); return Promise.resolve(); }
    return animateValue(0, maxRadius(x, y), duration, easeInOutCubic,
      (r) => setMask(x, y, r, false));
  }

  // El agujero transparente se encoge hasta colapsar en (x,y). Empieza con
  // todo visible y termina con todo tapado. Misma máscara que reveal, radio
  // animado al revés. Se usa como primera fase del flujo CERRAR.
  function close(x, y, duration = COVER_MS) {
    ensure();
    if (REDUCED_MOTION) { setMask(x, y, 0, false); return Promise.resolve(); }
    return animateValue(maxRadius(x, y), 0, duration, easeInOutCubic,
      (r) => setMask(x, y, r, false));
  }

  // El círculo negro se encoge hasta desaparecer. Empieza con todo tapado y
  // termina con todo visible. Misma máscara que cover, radio animado al revés.
  // Visualmente un punto negro colapsa en (x,y) revelando la nueva página.
  // Segunda fase del flujo CERRAR (encadena con close para dar sensación
  // continua de contracción hacia el centro).
  function uncover(x, y, duration = REVEAL_MS) {
    ensure();
    if (REDUCED_MOTION) { setMask(x, y, 0, true); return Promise.resolve(); }
    return animateValue(maxRadius(x, y), 0, duration, easeInOutCubic,
      (r) => setMask(x, y, r, true));
  }

  const pause = () => delay(PAUSE_MS);

  return { cover, reveal, close, uncover, pause, setBusy, isBusy: () => busy };
})();


// ============================================================================
// LIGHTBOX
// ----------------------------------------------------------------------------
// Al clicar una imagen de la galería, la ampliamos a pantalla completa con
// una animación FLIP: medimos el rect del thumbnail, posicionamos el <img>
// encima, y animamos sus dimensiones al espacio final. Al cerrar se invierte.
// Se navega con flechas, se cierra con ESC, click en el fondo o en las X.
// ============================================================================
const Lightbox = (() => {
  let el = null, imgEl = null;
  let images = [];
  let idx = 0;
  let isOpen = false;
  let sourceRect = null;

  function ensure() {
    if (el) return el;
    el = h('div', { class: 'lightbox lightbox--hidden' });
    el.innerHTML = `
      <img class="lightbox__img" alt="" />
      <button class="lightbox__close lightbox__close--tl" aria-label="close">×</button>
      <button class="lightbox__close lightbox__close--tr" aria-label="close">×</button>
      <button class="lightbox__close lightbox__close--bl" aria-label="close">×</button>
      <button class="lightbox__close lightbox__close--br" aria-label="close">×</button>
    `;
    document.body.appendChild(el);
    imgEl = el.querySelector('.lightbox__img');
    bind();
    return el;
  }

  function bind() {
    // click sobre el fondo o la propia imagen => cerrar
    el.addEventListener('click', (e) => {
      if (e.target === el || e.target === imgEl) close();
    });
    // cada esquina tiene su X
    el.querySelectorAll('.lightbox__close').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    });
    // teclado global (sólo activo si el lightbox está abierto)
    document.addEventListener('keydown', (e) => {
      if (!isOpen) return;
      if (e.key === 'Escape')      { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); swap(idx - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); swap(idx + 1); }
    });
  }

  function open(srcs, startIdx, fromEl) {
    ensure();
    images = srcs;
    idx = startIdx || 0;
    isOpen = true;
    sourceRect = fromEl ? fromEl.getBoundingClientRect() : null;

    imgEl.src = images[idx];

    if (sourceRect) {
      // Fase 1: colocamos la imagen en las mismas coords que el thumbnail.
      Object.assign(imgEl.style, {
        transition: 'none',
        position: 'fixed',
        left: sourceRect.left + 'px',
        top: sourceRect.top + 'px',
        width: sourceRect.width + 'px',
        height: sourceRect.height + 'px',
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'cover',
      });

      el.classList.remove('lightbox--hidden');
      el.style.background = 'transparent';
      void imgEl.offsetHeight; // forzar reflow antes de la transición

      // Fase 2: animamos al tamaño completo (80dvw × 80dvh).
      imgEl.style.transition = 'all 0.45s cubic-bezier(0.4, 0, 0.2, 1)';
      imgEl.style.left = '10dvw';
      imgEl.style.top = '10dvh';
      imgEl.style.width = '80dvw';
      imgEl.style.height = '80dvh';
      imgEl.style.objectFit = 'contain';

      setTimeout(() => {
        el.style.transition = 'background 0.25s ease';
        el.style.background = '';
      }, 40);

      // Tras la animación, limpiamos los estilos inline para que ceda al CSS.
      setTimeout(() => {
        Object.assign(imgEl.style, {
          transition: '', position: '', left: '', top: '',
          width: '', height: '', maxWidth: '', maxHeight: '', objectFit: '',
        });
      }, 500);
    } else {
      el.classList.remove('lightbox--hidden');
    }
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;

    if (sourceRect) {
      // FLIP inverso: congelamos la posición actual y animamos de vuelta al thumbnail.
      const cur = imgEl.getBoundingClientRect();
      Object.assign(imgEl.style, {
        transition: 'none',
        position: 'fixed',
        left: cur.left + 'px',
        top: cur.top + 'px',
        width: cur.width + 'px',
        height: cur.height + 'px',
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'contain',
      });
      void imgEl.offsetHeight;

      imgEl.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      imgEl.style.left = sourceRect.left + 'px';
      imgEl.style.top = sourceRect.top + 'px';
      imgEl.style.width = sourceRect.width + 'px';
      imgEl.style.height = sourceRect.height + 'px';
      imgEl.style.objectFit = 'cover';

      el.style.transition = 'background 0.25s ease';
      el.style.background = 'transparent';

      setTimeout(() => {
        el.classList.add('lightbox--hidden');
        Object.assign(imgEl.style, {
          transition: '', position: '', left: '', top: '',
          width: '', height: '', maxWidth: '', maxHeight: '', objectFit: '',
        });
        el.style.transition = '';
        el.style.background = '';
      }, 420);
    } else {
      el.classList.add('lightbox--hidden');
    }
  }

  /** Pasa a la imagen `newIdx` (con wrap-around) con un fade corto. */
  function swap(newIdx) {
    if (!isOpen || images.length <= 1) return;
    idx = (newIdx + images.length) % images.length;
    imgEl.style.transition = 'opacity 0.15s ease';
    imgEl.style.opacity = '0';
    setTimeout(() => {
      imgEl.src = images[idx];
      const done = () => { imgEl.style.opacity = '1'; };
      imgEl.addEventListener('load', done, { once: true });
      setTimeout(done, 120); // fallback si ya estaba cacheada
    }, 150);
  }

  return { open, close, isOpen: () => isOpen };
})();


// ============================================================================
// AUDIO PLAYER (reutilizable)
// ----------------------------------------------------------------------------
// Un solo audio suena a la vez. `currentAudio` apunta al que está activo,
// al reproducir otro pausamos el anterior.
// ============================================================================
let currentAudio = null;

function fmtTime(t) {
  if (!isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function buildAudioBlock(slug, item) {
  const btn  = h('button', { type: 'button', class: 'audio-player__btn', textContent: '▶ play' });
  const time = h('span',   { class: 'audio-player__time', textContent: '0:00' });
  const fill = h('div',    { class: 'audio-player__fill' });
  const bar  = h('div',    { class: 'audio-player__bar' }, fill);

  const audio = new Audio();
  audio.src = projectsAsset(slug, item.src);
  audio.preload = 'metadata';

  btn.addEventListener('click', () => {
    if (audio.paused) {
      if (currentAudio && currentAudio !== audio) currentAudio.pause();
      audio.play();
      currentAudio = audio;
      btn.textContent = '❚❚ pause';
    } else {
      audio.pause();
      btn.textContent = '▶ play';
    }
  });
  audio.addEventListener('timeupdate', () => {
    time.textContent = fmtTime(audio.currentTime);
    if (audio.duration) fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
  });
  audio.addEventListener('ended', () => {
    btn.textContent = '▶ play';
    fill.style.width = '0%';
  });
  // Seek clicando en la barra.
  bar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const r = bar.getBoundingClientRect();
    audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
  });

  return h('div', { class: 'audio-block' },
    h('div', { class: 'audio-player' }, btn, bar, time)
  );
}


// ============================================================================
// HOME — strips iniciales en orden + scroll infinito random
// ----------------------------------------------------------------------------
// El primer pase muestra los proyectos en el orden del JSON. A partir de
// ahí, al acercarse al fondo se añaden batches de strips aleatorios tomados
// de un pool (triple de los proyectos, barajado).
// ============================================================================

// Estado del infinito. Se resetea en cada entrada a home.
const InfState = {
  pool: [],       // array barajado de proyectos para ir consumiendo
  poolPtr: 0,     // puntero dentro del pool; al agotarse se re-baraja
  stripsEl: null, // contenedor DOM donde se insertan las nuevas strips
  lastSlug: null, // último slug añadido, para evitar repetición inmediata
  videoIO: null,  // IntersectionObserver para lazy-load de vídeos portada
};

const PORTADA_VIDEO_EXTS = ['mp4', 'webm', 'mov'];

/** Construye el medio del strip.
 *  Por defecto carga portada.webm de forma lazy (data-src + IntersectionObserver).
 *  Si el proyecto define `portadaExt` en data.json, usa esa extensión en su lugar.
 *  Para extensiones de imagen usa loading="lazy" estándar.
 *  Si el archivo no existe, el strip queda transparente (hover sigue funcionando). */
function buildStripMedia(slug, alt, portadaExt) {
  const ext = portadaExt || 'webm';

  if (PORTADA_VIDEO_EXTS.includes(ext)) {
    const video = h('video', {
      'data-src': projectsAsset(slug, `portada.${ext}`),
      autoplay: true,
      muted: true,
      loop: true,
      playsInline: true,
      preload: 'none',
      class: 'strip__media strip__media--pending',
    });
    video.addEventListener('error', () => video.remove(), { once: true });
    return video;
  }

  const img = h('img', {
    src: projectsAsset(slug, `portada.${ext}`),
    alt,
    loading: 'lazy',
    class: 'strip__media',
  });
  img.addEventListener('error', () => img.remove(), { once: true });
  return img;
}

/** Crea un banner decorativo (vídeo en bucle, no clickable) para intercalar
 *  en la home entre proyectos. `item.banner` es el nombre del archivo dentro
 *  de `_BANNERS/`. Comparte forma con `.strip` (3:1 full width) pero sin
 *  link, hover ni dots. */
function buildBanner(item) {
  const video = h('video', {
    src: bannerAsset(item.banner),
    autoplay: true,
    muted: true,
    loop: true,
    playsInline: true,
    preload: 'metadata',
    class: 'strip__media',
  });
  return h('div', { class: 'strip strip--banner', 'aria-hidden': 'true' }, video);
}

/** Crea un <a class="strip"> con medio + overlay + dot único para un proyecto.
 *  Reposo: solo se ve el dot centrado.
 *  Hover (desktop): aparece velo oscuro + título centrado; el dot sigue ahí.
 *  Click: la transición de iris arranca desde el dot. */
function buildStrip(p) {
  const media = buildStripMedia(p.slug, p.nombre || p.slug, p.portadaExt);
  const overlay = h('div', { class: 'strip__overlay' },
    h('span', { class: 'strip__title', textContent: p.nombre || p.slug }),
  );
  const dot = h('span', { class: 'dot' });
  const a = h('a', {
    class: 'strip',
    href: urlForSlug(p.slug),
    dataset: { slug: p.slug },
    'aria-label': p.nombre || p.slug,
  }, media, overlay, dot);

  a.addEventListener('click', (e) => {
    // respetar cmd/ctrl/shift-click (abrir en pestaña nueva, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    const r = dot.getBoundingClientRect();
    navigateTo(p.slug, {
      origins: [{ x: r.left + r.width / 2, y: r.top + r.height / 2 }],
    });
  });
  return a;
}

function appendRandomBatch(n = 6) {
  if (!InfState.stripsEl || !InfState.pool.length) return;
  const frag = document.createDocumentFragment();
  const newStrips = [];
  for (let i = 0; i < n; i++) {
    if (InfState.poolPtr >= InfState.pool.length) {
      InfState.pool = shuffle(InfState.pool);
      InfState.poolPtr = 0;
    }
    // Si el siguiente coincide con el último añadido, avanzamos uno más
    if (InfState.pool.length > 1 && InfState.pool[InfState.poolPtr].slug === InfState.lastSlug) {
      InfState.poolPtr++;
      if (InfState.poolPtr >= InfState.pool.length) {
        InfState.pool = shuffle(InfState.pool);
        InfState.poolPtr = 0;
      }
    }
    const p = InfState.pool[InfState.poolPtr++];
    InfState.lastSlug = p.slug;
    const strip = buildStrip(p);
    newStrips.push(strip);
    frag.appendChild(strip);
  }
  InfState.stripsEl.appendChild(frag);
  if (InfState.videoIO) newStrips.forEach(el => InfState.videoIO.observe(el));
}

function setupInfiniteScroll(projects, signal) {
  // Triplicamos para que el ciclo de "re-baraja" no sea tan frecuente.
  InfState.pool = shuffle([...projects, ...projects, ...projects]);
  InfState.poolPtr = 0;

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const total = document.documentElement.scrollHeight;
      const scrollBottom = window.scrollY + innerHeight;
      // Cargamos más cuando quedan <80% de pantalla por scrollear.
      if (total - scrollBottom < innerHeight * 0.8) appendRandomBatch(6);
    });
  };
  addEventListener('scroll', onScroll, { passive: true, signal });

  // Garantiza un mínimo de contenido para que el scroll empiece en pantallas altas.
  const ensureFill = () => {
    let guard = 0;
    while (document.documentElement.scrollHeight < innerHeight * 1.6 && guard < 20) {
      appendRandomBatch(6);
      guard++;
    }
  };
  ensureFill();
  addEventListener('resize', ensureFill, { signal });
}

function setupVideoLazyLoad(container) {
  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const video = entry.target.querySelector('video.strip__media--pending');
      if (video?.dataset.src) {
        video.src = video.dataset.src;
        delete video.dataset.src;
        video.classList.remove('strip__media--pending');
        video.load();
      }
      io.unobserve(entry.target);
    }
  }, { rootMargin: '300px' });

  container.querySelectorAll('.strip').forEach(el => io.observe(el));
  return io;
}

function renderHome(data) {
  document.title = data.meta?.nombre || 'valentin barrio';

  const aboutSlug = data.meta?.about_slug;
  const nameEl = aboutSlug
    ? h('a', { class: 'name', href: urlForSlug(aboutSlug), textContent: data.meta?.nombre || '' })
    : h('div', { class: 'name', textContent: data.meta?.nombre || '' });
  if (aboutSlug) {
    nameEl.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      const r = nameEl.getBoundingClientRect();
      navigateTo(aboutSlug, { origins: [{ x: r.left + r.width / 2, y: r.top + r.height / 2 }] });
    });
  }

  const header = h('header', { class: 'home-header' },
    nameEl,
    data.meta?.tagline ? h('div', { class: 'tagline', textContent: data.meta.tagline }) : null,
    data.meta?.email
      ? h('a', { class: 'email', href: `mailto:${data.meta.email}`, textContent: data.meta.email })
      : null,
    data.meta?.instagram
      ? h('a', {
          class: 'instagram',
          href: `https://instagram.com/${data.meta.instagram}`,
          target: '_blank',
          rel: 'noopener noreferrer',
          textContent: `@${data.meta.instagram}`,
        })
      : null,
  );

  const strips = h('div', { class: 'strips' });
  // Orden inicial: proyectos visibles + banners, en el orden del JSON.
  // Los banners son decorativos, no clickables, y solo aparecen en esta pasada.
  (data.projects || [])
    .filter((it) => it.banner || it.visible !== false)
    .forEach((it) => {
      strips.appendChild(it.banner ? buildBanner(it) : buildStrip(it));
    });

  const main = h('main', { class: 'page page-home' }, header, strips);
  mount(main);

  InfState.videoIO = setupVideoLazyLoad(strips);

  // El infinito baraja los proyectos visibles (sin banners).
  const shufflable = (data.projects || []).filter(p => !p.banner && p.visible !== false);
  InfState.stripsEl = strips;
  setupInfiniteScroll(shufflable, pageAbort.signal);
}


// ============================================================================
// PROYECTO
// ----------------------------------------------------------------------------
// Estructura:
//   .proj-margin--top   ← 20dvh con un dot centrado
//   .proj-body          ← descripción + ficha técnica
//   .gallery            ← imágenes 1..N (auto-discovered) con extras
//                          (texto/audio) intercalados según `posicion`
//   .proj-margin--bottom ← 20dvh con dot
//   .home-link-wrap     ← "back to home"
// ============================================================================

function buildFichaRow(key, value) {
  return h('li', {},
    h('span', { class: 'k', textContent: key }),
    h('span', { class: 'v', textContent: value }),
  );
}

function buildFicha(p) {
  const ul = h('ul');
  if (p.tipo)  ul.appendChild(buildFichaRow('type',  p.tipo));
  if (p.lugar) ul.appendChild(buildFichaRow('place', p.lugar));
  if (p.fecha) ul.appendChild(buildFichaRow('date',  p.fecha));
  if (Array.isArray(p.equipo)) {
    p.equipo.forEach(({ nombre, rol, url }) => {
      if (!nombre) return;
      const valueNode = url
        ? h('a', { class: 'v', href: url, target: '_blank', rel: 'noopener noreferrer', textContent: nombre })
        : h('span', { class: 'v', textContent: nombre });
      ul.appendChild(h('li', {},
        h('span', { class: 'k', textContent: rol || 'team' }),
        valueNode,
      ));
    });
  }
  if (!ul.children.length) return null;
  return h('aside', { class: 'ficha' }, ul);
}

function buildDescription(p) {
  const children = [];
  if (p.nombre) children.push(h('h2', { textContent: p.nombre }));
  if (p.descripcion) children.push(h('p', { textContent: p.descripcion }));
  if (!children.length) return null;
  return h('div', { class: 'desc' }, ...children);
}

/** Sondeo doblado + binario para descubrir cuántas imágenes numeradas existen
 *  en `_PROJECTS/<slug>/`. Eficiente incluso para galerías grandes (~13 HEAD
 *  requests para 81 imágenes). Devuelve 0 si no hay ninguna. */
async function discoverGalleryCount(slug, max = 500) {
  const head = (n) => fetch(projectImgUrl(slug, n), { method: 'HEAD' })
    .then((r) => r.ok)
    .catch(() => false);

  // Doubling: 1, 2, 4, 8, ... hasta encontrar el primer fallo.
  let lastOk = 0, firstFail = null, probe = 1;
  while (probe <= max) {
    if (await head(probe)) { lastOk = probe; probe *= 2; }
    else { firstFail = probe; break; }
  }
  if (!firstFail) return lastOk;

  // Búsqueda binaria entre el último OK y el primer fallo.
  let lo = lastOk, hi = firstFail;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (await head(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Crea un bloque suelto de extra (texto o audio). */
function buildExtraBlock(slug, extra) {
  if (extra.tipo === 'texto') {
    return h('blockquote', { class: 'text-block', textContent: extra.texto || '' });
  }
  if (extra.tipo === 'audio') {
    return buildAudioBlock(slug, { src: extra.src });
  }
  return null;
}

/** Rellena la galería con las `count` imágenes numeradas (1..count) e
 *  intercala los `extras` según su `posicion`:
 *   - posicion 0 → antes de la primera imagen
 *   - posicion N → justo después de la N-ésima imagen
 *  Varios extras pueden compartir posición; salen en el orden del array. */
function populateGallery(gallery, p, count) {
  const allImageUrls = [];
  for (let i = 1; i <= count; i++) allImageUrls.push(projectImgUrl(p.slug, i));

  const extrasByPos = {};
  for (const ex of (p.extras || [])) {
    const pos = ex.posicion ?? 0;
    (extrasByPos[pos] ||= []).push(ex);
  }
  const flushExtras = (pos) => {
    for (const ex of (extrasByPos[pos] || [])) {
      const block = buildExtraBlock(p.slug, ex);
      if (block) gallery.appendChild(block);
    }
  };

  flushExtras(0);
  for (let i = 1; i <= count; i++) {
    const myIdx = i - 1;
    const img = h('img', {
      src: projectImgUrl(p.slug, i),
      alt: `${p.nombre || p.slug} — ${i}`,
      loading: 'lazy',
      class: 'gallery__img',
    });
    img.addEventListener('click', () => Lightbox.open(allImageUrls, myIdx, img));
    gallery.appendChild(img);
    flushExtras(i);
  }
}

function buildGallery(_p) {
  // El relleno ocurre en renderProject tras el auto-discovery de count.
  return h('div', { class: 'gallery' });
}

/** Construye los dos margenes (arriba/abajo) de 20dvh con un dot centrado. */
const buildProjMargin = (pos) =>
  h('div', { class: `proj-margin proj-margin--${pos}` }, h('span', { class: 'dot' }));

function buildHomeLinkWrap(currentSlug, web) {
  const homeLink = h('a', {
    class: 'home-link',
    href: urlForSlug(null),
    textContent: 'back to home',
  });
  homeLink.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigateTo(null, { fromSlug: currentSlug });
  });

  const wrap = h('div', { class: 'home-link-wrap' }, homeLink);
  if (web) {
    wrap.appendChild(h('a', {
      class: 'home-link-credit',
      href: `https://${web}`,
      target: '_blank',
      rel: 'noopener noreferrer',
      textContent: `web: ${web}`,
    }));
  }
  return wrap;
}

function renderProject(data, slug) {
  const p = findProject(data, slug);
  if (!p) return renderNotFound(slug);

  const title = p.nombre || p.slug;
  document.title = `${title} — ${data.meta?.nombre || ''}`.trim();

  const body = h('section', { class: 'proj-body' });
  const desc = buildDescription(p);
  if (desc) body.appendChild(desc);
  const ficha = buildFicha(p);
  if (ficha) body.appendChild(ficha);

  const gallery = buildGallery(p);
  const main = h('main', { class: 'page page-project' },
    buildProjMargin('top'),
    body,
    gallery,
    buildProjMargin('bottom'),
    buildHomeLinkWrap(slug, p.web),
  );
  mount(main);

  // Auto-discovery de imágenes + intercalado de extras (texto/audio) según
  // su `posicion`. No bloquea la transición; aparece tras ~300-700ms.
  discoverGalleryCount(p.slug).then((count) => {
    if (!gallery.isConnected) return; // ya navegó a otra página
    if (count > 0 || p.extras?.length) populateGallery(gallery, p, count);
  });
}

function renderNotFound(slug) {
  const link = h('a', {
    class: 'home-link',
    href: urlForSlug(null),
    textContent: 'back to home',
  });
  link.addEventListener('click', (e) => { e.preventDefault(); navigateTo(null); });

  const main = h('main', { class: 'page page-notfound' },
    h('p', {},
      'no se encontró el proyecto ',
      h('code', { textContent: slug || '' }),
    ),
    link,
  );
  mount(main);
}


// ============================================================================
// ROUTER + FLOW DE TRANSICIÓN
// ----------------------------------------------------------------------------
// Dos transiciones con semántica distinta:
//
//   ABRIR (a proyecto):  cover(dot) → render → reveal(centro)
//     Dos expansiones: el iris "explota" desde el dot del strip hasta tapar
//     todo, luego un agujero crece desde el centro mostrando el proyecto.
//
//   CERRAR (a home):     close(centro) → render → uncover(centro)
//     Dos contracciones: el proyecto colapsa al centro (el negro entra desde
//     los bordes), luego el punto negro residual se encoge revelando la home.
//     En paralelo al negro scrolleamos al strip del proyecto de origen para
//     que la home quede posicionada donde estaba el usuario.
//
// `popstate` (botón atrás) usa el mismo patrón.
// ============================================================================

let lastSlug = null;      // slug actualmente renderizado (null = home)
let pageAbort = null;     // AbortController que cancela los listeners de la página saliente

function mount(main) {
  // Desmontar página anterior
  document.querySelector('main.page')?.remove();
  if (pageAbort) pageAbort.abort();
  pageAbort = new AbortController();

  // Reset de audio compartido (el <audio> de la página anterior se irá con el DOM).
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }

  // Insertar antes del iris para que el overlay quede siempre por encima.
  const iris = document.querySelector('.iris');
  if (iris) document.body.insertBefore(main, iris);
  else document.body.appendChild(main);

  scrollTo(0, 0);
}

function render(slug) {
  if (!DATA) return;
  if (slug) renderProject(DATA, slug);
  else renderHome(DATA);
  lastSlug = slug || null;
}

const centerOfViewport = () => ({ x: innerWidth / 2, y: innerHeight / 2 });

/** Encuentra el dot del strip de un proyecto, scrolleando si está fuera de vista.
 *  Usamos `window.scrollTo(x, y)` imperativo (siempre instantáneo) en vez de
 *  `scrollIntoView({behavior:'instant'})`, que no está soportado en todos los
 *  navegadores y puede caer a smooth — causaría un scroll visible durante el
 *  reveal del iris. */
function findStripDotCenter(slug) {
  const strip = document.querySelector(`.strip[data-slug="${CSS.escape(slug)}"]`);
  if (!strip) return centerOfViewport();
  const target = strip.querySelector('.dot') || strip;
  let r = target.getBoundingClientRect();
  if (r.top < 0 || r.bottom > innerHeight) {
    const y = window.scrollY + r.top - (innerHeight - r.height) / 2;
    window.scrollTo(0, Math.max(0, y));
    r = target.getBoundingClientRect();
  }
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

async function navigateTo(slug, opts = {}) {
  if (Iris.isBusy()) return;                  // ya hay una transición en curso
  const targetURL = urlForSlug(slug);
  if (location.pathname === targetURL) return; // mismo destino, no hacemos nada

  const goingToProject = !!slug;

  Iris.setBusy(true);
  try {
    if (goingToProject) {
      // ABRIR: cover crece desde los dots del strip clicado (uno o dos) →
      // reveal crece desde el centro. `opts.origins` es un array de {x,y};
      // por compat también se admite el viejo `opts.originX/Y` (un solo punto).
      const origins = opts.origins?.length
        ? opts.origins
        : (typeof opts.originX === 'number'
            ? [{ x: opts.originX, y: opts.originY }]
            : [centerOfViewport()]);
      await Iris.cover(origins);

      history.pushState({ slug }, '', targetURL);
      render(slug);
      await Iris.pause();
      await new Promise((r) => requestAnimationFrame(r));

      const c = centerOfViewport();
      await Iris.reveal(c.x, c.y);
    } else {
      // CERRAR: dos contracciones hacia el centro. Close hace colapsar el
      // proyecto, uncover termina de encoger el punto negro residual.
      const c = centerOfViewport();
      await Iris.close(c.x, c.y);

      history.pushState({ slug }, '', targetURL);
      render(slug);

      // Scroll (side effect) al strip del proyecto de origen durante la fase
      // negra, para que al revelar la home esté ya posicionada.
      const anchor = opts.fromSlug || lastSlug;
      if (anchor) findStripDotCenter(anchor);

      await Iris.pause();
      await new Promise((r) => requestAnimationFrame(r));

      const c2 = centerOfViewport();
      await Iris.uncover(c2.x, c2.y);
    }
  } finally {
    Iris.setBusy(false);
  }
}

addEventListener('popstate', async () => {
  const slug = slugFromPath();
  if (slug === lastSlug) return;
  if (Iris.isBusy()) return;

  const goingToProject = !!slug;
  const prevSlug = lastSlug;

  Iris.setBusy(true);
  try {
    const c = centerOfViewport();

    if (goingToProject) {
      // Volvemos a un proyecto: sin coords del click, usamos el centro.
      await Iris.cover(c);
      render(slug);
      await Iris.pause();
      await new Promise((r) => requestAnimationFrame(r));
      await Iris.reveal(c.x, c.y);
    } else {
      // Volvemos a home: mismo patrón close → uncover que navigateTo.
      await Iris.close(c.x, c.y);
      render(slug);
      if (prevSlug) findStripDotCenter(prevSlug); // scroll al strip de origen
      await Iris.pause();
      await new Promise((r) => requestAnimationFrame(r));
      await Iris.uncover(c.x, c.y);
    }
  } finally {
    Iris.setBusy(false);
  }
});

// ESC en una página de proyecto = volver a home (a menos que el lightbox esté abierto).
addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (Lightbox.isOpen()) return;
  if (slugFromPath()) {
    e.preventDefault();
    navigateTo(null, { fromSlug: lastSlug });
  }
});


// ============================================================================
// INIT
// ============================================================================
(async () => {
  try {
    await loadData();
    render(slugFromPath());
  } catch (err) {
    console.error(err);
    document.body.appendChild(
      h('main', { class: 'page' },
        h('p', { style: 'padding:2rem 1.25rem', textContent: `error: ${err.message}` })
      )
    );
  }
})();
