const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initReveals() {
  const revealEls = document.querySelectorAll('.reveal, .reveal-stagger');

  if (reducedMotion) {
    revealEls.forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -60px 0px'
  });

  revealEls.forEach(el => observer.observe(el));
}

function initParallaxBlobs() {
  if (reducedMotion) return;

  const blobs = document.querySelectorAll('.parallax-blob');
  if (!blobs.length) return;

  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const docHeight = document.body.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? scrollY / docHeight : 0;

        blobs.forEach((blob, index) => {
          const speed = (index + 1) * 0.08;
          const y = progress * 120 * speed;
          blob.style.transform = `translateY(${y}px)`;
        });

        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

function initPaperPlane() {
  const plane = document.querySelector('.paper-plane');
  if (!plane) return;

  plane.addEventListener('click', () => {
    plane.classList.add('is-flying');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      plane.classList.remove('is-flying');
    }, 900);
  });
}

function initCoffeeProgress() {
  const progress = document.querySelector('.coffee-progress');
  const liquid = document.querySelector('.coffee-progress__liquid');
  if (!progress || !liquid) return;

  if (reducedMotion) {
    progress.classList.add('is-visible');
    liquid.style.height = '100%';
    return;
  }

  let ticking = false;

  function updateLiquid() {
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / docHeight) * 100)) : 0;

    liquid.style.height = `${pct}%`;

    if (pct > 2 && pct < 98) {
      progress.classList.add('is-visible');
    } else {
      progress.classList.remove('is-visible');
    }

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateLiquid);
      ticking = true;
    }
  }, { passive: true });

  updateLiquid();
}

function initLightbox() {
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = lightbox.querySelector('.lightbox__img');
  const closeBtn = lightbox.querySelector('.lightbox__close');
  if (!lightbox || !lightboxImg) return;

  function open(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('.card__img, .snapshot__img').forEach(img => {
    img.addEventListener('click', () => open(img.src, img.alt));
  });

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
}

function alignThreadsToRope() {
  const track = document.querySelector('.garland__track');
  const ropeLine = track ? track.querySelector('.garland__rope-line') : null;
  const ropeSvg = ropeLine ? ropeLine.querySelector('.garland__rope-svg') : null;
  const ropePath = ropeSvg ? ropeSvg.querySelector('.garland__rope') : null;
  if (!track || !ropeLine || !ropeSvg || !ropePath) return;

  const totalLength = ropePath.getTotalLength();
  const svgViewBox = ropeSvg.viewBox.baseVal;

  // Use rope-line's actual offsetHeight for Y scaling (more reliable than getBoundingClientRect)
  const ropeHeight = ropeLine.offsetHeight;
  const scaleY = ropeHeight / (svgViewBox.height || 80);

  // SVG width relative to track for X mapping
  const svgWidth = ropeLine.offsetWidth;

  const cards = track.querySelectorAll('.garland__card');
  cards.forEach(card => {
    const thread = card.querySelector('.garland__thread');
    if (!thread) return;

    // Use offsetLeft/offsetTop to avoid sway animation distorting positions
    const cardCenterX = card.offsetLeft + card.offsetWidth / 2;

    // Map card center x to SVG path position
    const fraction = cardCenterX / svgWidth;
    const pathLength = fraction * totalLength;

    // Get the point on the SVG path at this position
    const point = ropePath.getPointAtLength(Math.max(0, Math.min(totalLength, pathLength)));

    // Convert SVG y to rendered pixel y relative to rope-line top
    const renderedY = point.y * scaleY;

    // Card top relative to track (using offsetTop which isn't affected by transforms)
    const cardTop = card.offsetTop;
    // Push thread top a few pixels above the rope path so the dot clearly overlaps the rope stroke
    const threadTop = renderedY - 5;
    const threadHeight = cardTop - threadTop;

    // Thread is positioned relative to the card
    thread.style.top = `${threadTop - cardTop}px`;
    thread.style.height = `${Math.max(threadHeight, 8)}px`;
  });
}

function initGarland() {
  const garland = document.querySelector('.garland');
  const track = document.querySelector('.garland__track');
  if (!garland || !track) return;

  // Align each card's thread to the rope wave
  alignThreadsToRope();

  // Re-align on window resize
  window.addEventListener('resize', () => alignThreadsToRope());
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => alignThreadsToRope());
  }
  
  // State
  let offset = 0;           // current translateX position
  let velocity = 0;         // current velocity (px/s)
  let isDragging = false;
  let coasting = false;     // true when recovering momentum after drag
  let isPaused = false;     // true when hovering (pause auto-scroll)
  let dragStartX = 0;
  let dragStartY = 0;
  let axis = null;          // null = undecided, 'x' = drag, 'y' = let page scroll
  let dragStartOffset = 0;
  let lastPointerX = 0;
  let lastTime = performance.now();
  let rafId = null;

  const SCROLL_SPEED = reducedMotion ? 0 : -40; // px per second auto-scroll
  const FRICTION = 0.94;    // friction when coasting after drag release

  function getSetWidth() {
    const cards = track.querySelectorAll('.garland__card');
    if (cards.length < 2) return 0;
    const half = Math.floor(cards.length / 2);
    return cards[half].offsetLeft - cards[0].offsetLeft;
  }

  function wrapOffset(value) {
    const setWidth = getSetWidth();
    if (setWidth <= 0) return value;
    let wrapped = value % setWidth;
    if (wrapped > 0) wrapped -= setWidth;
    return wrapped;
  }

  function tick(now) {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    if (!isDragging && !isPaused) {
      if (coasting) {
        // Apply friction to decay momentum after drag release
        velocity *= FRICTION;
        // Once momentum is nearly gone, switch back to constant auto-scroll
        if (Math.abs(velocity) < 2) {
          coasting = false;
          velocity = SCROLL_SPEED;
        }
      } else {
        // Constant speed auto-scroll — no friction
        velocity = SCROLL_SPEED;
      }
      offset += velocity * dt;
    }

    offset = wrapOffset(offset);
    track.style.transform = `translateX(${offset}px)`;

    rafId = requestAnimationFrame(tick);
  }

  function onPointerDown(e) {
    if (e.button && e.button !== 0) return; // only left click
    const touch = !!e.touches;
    isDragging = true;
    coasting = false;
    dragStartX = touch ? e.touches[0].clientX : e.clientX;
    dragStartY = touch ? e.touches[0].clientY : e.clientY;
    dragStartOffset = offset;
    lastPointerX = dragStartX;

    if (touch) {
      // Don't commit yet — first move decides drag vs. page scroll
      axis = null;
    } else {
      axis = 'x';
      isPaused = false;
      velocity = 0;
      garland.classList.add('is-dragging');
      e.preventDefault();
    }
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;

    if (axis === null) {
      const dx = Math.abs(x - dragStartX);
      const dy = Math.abs(y - dragStartY);
      if (dx < 6 && dy < 6) return;   // too small to judge yet
      if (dy > dx) {                  // vertical → hand it back to the page
        axis = 'y';
        isDragging = false;
        velocity = SCROLL_SPEED;
        return;
      }
      axis = 'x';
      isPaused = false;
      velocity = 0;
      garland.classList.add('is-dragging');
    }

    offset = wrapOffset(dragStartOffset + (x - dragStartX));
    track.style.transform = `translateX(${offset}px)`;

    velocity = (x - lastPointerX) * 60; // px/sec approx
    lastPointerX = x;
    if (e.cancelable) e.preventDefault();
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;
    const wasDrag = axis === 'x';
    axis = null;
    garland.classList.remove('is-dragging');
    if (!wasDrag || reducedMotion) {
      coasting = false;
      velocity = SCROLL_SPEED;
      return;
    }
    if (Math.abs(velocity) > 2) {
      coasting = true;
    } else {
      coasting = false;
      velocity = SCROLL_SPEED;
    }
  }

  // Mouse events
  garland.addEventListener('mousedown', onPointerDown);
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);

  // Touch events
  garland.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  // Pause auto-scroll on hover (when not dragging)
  garland.addEventListener('mouseenter', () => {
    if (!isDragging) {
      isPaused = true;
      coasting = false;
    }
  });
  garland.addEventListener('mouseleave', () => {
    if (!isDragging) {
      isPaused = false;
      coasting = false;
      velocity = SCROLL_SPEED;
    }
  });

  // Start loop (drag still works without it — onPointerMove sets transform directly)
  if (!reducedMotion) {
    rafId = requestAnimationFrame(tick);
  }}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initReveals();
    initParallaxBlobs();
    initPaperPlane();
    initCoffeeProgress();
    initLightbox();
    initGarland();
  });
} else {
  initReveals();
  initParallaxBlobs();
  initPaperPlane();
  initCoffeeProgress();
  initLightbox();
  initGarland();
}
