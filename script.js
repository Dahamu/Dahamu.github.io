/* ============================================================
   Daham Bandara — PORTFOLIO SCRIPT
============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------------- Mobile nav ---------------- */

  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');

  function closeMenu() {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
  }

  navToggle?.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });

  navLinks?.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  /* ---------------- Active section highlight ---------------- */

  const sections = ['work', 'about', 'toolkit', 'contact']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  const navMap = {};
  navLinks?.querySelectorAll('a[data-nav]').forEach(a => {
    navMap[a.dataset.nav] = a;
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // The hero above #work has no nav link of its own, but depending
        // on viewport height its bottom edge can sit close enough to the
        // 40–45% highlight band that #work gets marked active on the very
        // first layout pass — before the user has scrolled at all. Treat
        // "still essentially at the top of the page" as "no section
        // active yet" instead.
        if (window.scrollY < 10) return;
        Object.values(navMap).forEach(a => a.classList.remove('active'));
        navMap[entry.target.id]?.classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

  sections.forEach(sec => observer.observe(sec));

  // The observer's rootMargin only "sees" a narrow band near the top of
  // the viewport, so a short final section like #contact can sit below
  // that band even when the page is scrolled all the way down — it would
  // never receive .active. Force it once the user hits the bottom.
  function checkBottomOfPage() {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 10;
    if (atBottom && navMap.contact) {
      Object.values(navMap).forEach(a => a.classList.remove('active'));
      navMap.contact.classList.add('active');
    }
  }

  // Symmetric case: the observer only adds .active on a *new* intersection
  // — it never explicitly clears it when nothing intersects anymore. So
  // scrolling back up into the hero after having visited another section
  // left that section's nav link stuck highlighted, since #work never
  // re-triggers an intersection event just by scrolling past it upward.
  function checkTopOfPage() {
    if (window.scrollY < 10) {
      Object.values(navMap).forEach(a => a.classList.remove('active'));
    }
  }

  /* ---------------- Scroll reveal ---------------- */

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ---------------- Scroll progress bar ---------------- */

  const scrollProgress = document.getElementById('scrollProgress');
  let progressTicking = false;
  let cachedDocHeight = 0;

  // Recomputing (scrollHeight - innerHeight) on every scroll frame is what
  // causes the jitter: on iOS Safari, innerHeight itself changes as the
  // URL bar shows/hides mid-scroll, so the same scroll position yields a
  // different percentage frame to frame. Cache the height and only
  // refresh it on resize/orientation change instead.
  function refreshDocHeight() {
    cachedDocHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  }

  function updateProgress() {
    const scrollTop = window.scrollY;
    const pct = cachedDocHeight > 0 ? (scrollTop / cachedDocHeight) * 100 : 0;
    if (scrollProgress) scrollProgress.style.width = Math.min(100, Math.max(0, pct)) + '%';
  }

  let resizeDebounce;
  window.addEventListener('resize', () => {
    clearTimeout(resizeDebounce);
    resizeDebounce = setTimeout(() => {
      refreshDocHeight();
      updateProgress();
    }, 150);
  });

  // One shared rAF-throttled scroll handler instead of separate listeners
  // each scheduling their own frame — fewer redundant callbacks per scroll
  // tick means less work fighting the browser for a smooth 60fps scroll.
  /* ---------------- Back to top ---------------- */

  const backToTop = document.getElementById('backToTop');

  function updateBackToTop() {
    // Show once scrolled roughly a screen's worth down, so it doesn't
    // appear while still in the hero.
    backToTop?.classList.toggle('visible', window.scrollY > window.innerHeight * 0.6);
  }

  function onScrollFrame() {
    updateProgress();
    checkBottomOfPage();
    checkTopOfPage();
    updateBackToTop();
    progressTicking = false;
  }

  window.addEventListener('scroll', () => {
    if (!progressTicking) {
      requestAnimationFrame(onScrollFrame);
      progressTicking = true;
    }
  }, { passive: true });
  refreshDocHeight();
  updateProgress();
  checkBottomOfPage();
  checkTopOfPage();
  updateBackToTop();
  // DOMContentLoaded fires before images have laid out, so gallery images
  // still report 0 height and cachedDocHeight comes out too small. Once
  // everything (including lazy images) has actually loaded, the true
  // document height is taller — refresh again so the bar isn't maxed out
  // early.
  window.addEventListener('load', () => {
    refreshDocHeight();
    updateProgress();
  });

  /* ---------------- Project lightbox ---------------- */

  const lightbox = document.getElementById('lightbox');
  const lightboxPanel = lightbox?.querySelector('.lightbox-panel');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxImage = document.getElementById('lightboxImage');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxDesc = document.getElementById('lightboxDesc');
  const lightboxTags = document.getElementById('lightboxTags');

  // Background landmarks to fully disable while the lightbox is open.
  // aria-hidden alone only hides these from screen readers — the
  // underlying links/buttons stay in the tab order, so a keyboard user
  // who Tabs from somewhere other than the first/last focusable element
  // in the modal (trapLightboxFocus only catches those two edges) could
  // still tab straight through to a hidden background link. `inert`
  // natively removes focusability and pointer/AT interaction too.
  const backgroundLandmarks = [
    document.getElementById('nav'),
    document.querySelector('main'),
    document.querySelector('.footer')
  ].filter(Boolean);

  let galleryImages = [];
  let galleryIndex = 0;
  let lastFocusedEl = null;

  function showGalleryImage(index) {
    galleryIndex = (index + galleryImages.length) % galleryImages.length;
    if (lightboxImage) lightboxImage.src = galleryImages[galleryIndex];
    const multi = galleryImages.length > 1;
    if (lightboxPrev) lightboxPrev.hidden = !multi;
    if (lightboxNext) lightboxNext.hidden = !multi;
    if (lightboxCounter) {
      lightboxCounter.hidden = !multi;
      if (multi) lightboxCounter.textContent = (galleryIndex + 1) + ' / ' + galleryImages.length;
    }
  }

  // Returns the currently focusable elements inside the lightbox panel,
  // in DOM order, so Tab/Shift+Tab can be trapped between the first and last.
  function getFocusableLightboxEls() {
    if (!lightboxPanel) return [];
    const selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(lightboxPanel.querySelectorAll(selector))
      .filter(el => !el.hidden && el.offsetParent !== null);
  }

  function trapLightboxFocus(e) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusableLightboxEls();
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  let lockedScrollY = 0;

  // iOS Safari ignores `overflow: hidden` on <body> for fixed overlays —
  // the background still scrolls/rubber-bands underneath a finger drag.
  // Pinning the body with position:fixed actually blocks it there too;
  // we just have to record and restore the scroll position ourselves
  // since fixing the body would otherwise snap it to the top.
  function lockBodyScroll() {
    // A rapid double-click (or repeated Enter) can fire openLightbox twice
    // before the first click's effects settle. Without this guard, the
    // second call would read window.scrollY as 0 (since the body is
    // already position:fixed from the first call) and overwrite
    // lockedScrollY with that 0 — so closing the modal would jump the
    // page to the very top instead of back to the gallery.
    if (document.body.style.position === 'fixed') return;

    lockedScrollY = window.scrollY;
    // Hiding the scrollbar (via overflow:hidden below) removes its width
    // from the layout, so the page reflows wider right at this instant —
    // that single jolt is the "shaky" jump when opening a card. Add back
    // exactly that width as padding so nothing shifts.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${lockedScrollY}px`;
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
      // .nav is position:fixed with width:100%, sized against the
      // viewport rather than body — so body's padding alone doesn't stop
      // it from visibly widening/shifting when the scrollbar disappears.
      // Give it the same compensation directly.
      const nav = document.getElementById('nav');
      if (nav) nav.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  function forceScrollTo(y) {
    // window.scrollTo(x, y) is supposed to be instant per spec, but some
    // browsers still honor html's global scroll-behavior:smooth for it —
    // suppress that for just this jump.
    const prevBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, y);
    document.documentElement.style.scrollBehavior = prevBehavior;
  }

  function unlockBodyScroll() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
    const nav = document.getElementById('nav');
    if (nav) nav.style.paddingRight = '';
    forceScrollTo(lockedScrollY);
  }

  function openLightbox(card) {
    const cardImg = card.querySelector('.card-thumb img');
    const galleryAttr = card.dataset.gallery;
    galleryImages = galleryAttr
      ? galleryAttr.split(',').map(s => s.trim()).filter(Boolean)
      : [cardImg ? cardImg.src : ''];

    if (lightboxImage) lightboxImage.alt = card.dataset.title || '';
    showGalleryImage(0);

    if (lightboxTitle) lightboxTitle.textContent = card.dataset.title || '';
    if (lightboxDesc) lightboxDesc.textContent = card.dataset.desc || '';
    if (lightboxTags) {
      lightboxTags.innerHTML = '';
      (card.dataset.tags || '').split(',').forEach(tag => {
        const span = document.createElement('span');
        span.textContent = tag.trim();
        lightboxTags.appendChild(span);
      });
    }

    lastFocusedEl = document.activeElement;
    lightbox?.classList.add('active');
    lightbox?.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    backgroundLandmarks.forEach(el => {
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
    });
    lightboxClose?.focus({ preventScroll: true });
  }

  function closeLightbox() {
    const targetScrollY = lockedScrollY;
    lightbox?.classList.remove('active');
    lightbox?.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    backgroundLandmarks.forEach(el => {
      el.removeAttribute('aria-hidden');
      el.inert = false;
    });
    // Return focus to whatever card/element opened the lightbox.
    if (lastFocusedEl && typeof lastFocusedEl.focus === 'function') {
      // preventScroll matters here: if the card wasn't *fully* inside the
      // viewport when it was clicked (e.g. a row partially cut off at the
      // edge), a plain .focus() call makes the browser auto-scroll it
      // fully into view. Not every browser (older/embedded WebKit builds
      // especially) actually honors preventScroll though, so as a
      // belt-and-suspenders measure we re-check and re-assert the scroll
      // position right after — both synchronously and on the next frame,
      // in case the browser's own correction happens a tick later.
      lastFocusedEl.focus({ preventScroll: true });
    }
    lastFocusedEl = null;
    if (window.scrollY !== targetScrollY) forceScrollTo(targetScrollY);
    requestAnimationFrame(() => {
      if (window.scrollY !== targetScrollY) forceScrollTo(targetScrollY);
    });
  }

  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openLightbox(card));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openLightbox(card);
      }
    });
  });

  lightboxPrev?.addEventListener('click', (e) => {
    e.stopPropagation();
    showGalleryImage(galleryIndex - 1);
  });
  lightboxNext?.addEventListener('click', (e) => {
    e.stopPropagation();
    showGalleryImage(galleryIndex + 1);
  });

  lightboxClose?.addEventListener('click', closeLightbox);
  lightbox?.addEventListener('click', (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (!lightbox?.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showGalleryImage(galleryIndex - 1);
    if (e.key === 'ArrowRight') showGalleryImage(galleryIndex + 1);
    trapLightboxFocus(e);
  });

  /* ---------------- Copy email button ---------------- */

  const emailCopyBtn = document.getElementById('emailCopyBtn');
  let emailCopyResetTimer;

  function showCopiedFeedback() {
    if (!emailCopyBtn) return;
    clearTimeout(emailCopyResetTimer);
    emailCopyBtn.classList.add('copied');
    emailCopyBtn.setAttribute('aria-label', 'Email address copied');
    emailCopyResetTimer = setTimeout(() => {
      emailCopyBtn.classList.remove('copied');
      emailCopyBtn.setAttribute('aria-label', 'Copy email address');
    }, 1600);
  }

  emailCopyBtn?.addEventListener('click', async () => {
    const email = emailCopyBtn.dataset.email || '';
    try {
      // Clipboard API requires a secure context (https/localhost) — GitHub
      // Pages qualifies, but this can silently be unavailable in other
      // embedded/dev contexts, hence the fallback below.
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(email);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      showCopiedFeedback();
    } catch {
      // Fallback: select a temporary offscreen textarea and use the
      // legacy execCommand copy path.
      try {
        const temp = document.createElement('textarea');
        temp.value = email;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.focus();
        temp.select();
        const copied = document.execCommand('copy');
        document.body.removeChild(temp);
        if (copied) showCopiedFeedback();
      } catch {
        // Last resort: at least the mailto link right next to this
        // button still works.
      }
    }
  });

  /* ---------------- Placeholder links ---------------- */
  // Links without a real destination yet (e.g. Behance, until the profile
  // URL is added) use aria-disabled + a "#" href so they're still visible
  // and readable, but shouldn't actually navigate — href="#" alone jumps
  // the page to the top, which reads as broken.
  document.querySelectorAll('a[aria-disabled="true"]').forEach(link => {
    link.addEventListener('click', (e) => e.preventDefault());
  });

  /* ---------------- Subtle card tilt on hover (desktop only) ---------------- */

  const supportsHover = window.matchMedia('(hover: hover)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (supportsHover && !reducedMotion) {
    document.querySelectorAll('.card-thumb').forEach(thumb => {
      let tiltTicking = false;
      let pendingX = 0;
      let pendingY = 0;

      thumb.addEventListener('mouseenter', () => {
        // JS now owns the transform every frame, so hand off the transition
        // to CSS only for the "settle" on mouseleave (see below).
        thumb.classList.add('is-tilting');
      });
      thumb.addEventListener('mousemove', (e) => {
        const rect = thumb.getBoundingClientRect();
        pendingX = (e.clientX - rect.left) / rect.width - 0.5;
        pendingY = (e.clientY - rect.top) / rect.height - 0.5;
        // A raw mousemove can fire far more often than the screen refreshes
        // (especially on high-poll-rate mice), and each one was writing to
        // style.transform directly — batch those writes to once per frame.
        if (!tiltTicking) {
          requestAnimationFrame(() => {
            thumb.style.transform = `translateY(-4px) rotateY(${pendingX * 8}deg) rotateX(${-pendingY * 8}deg)`;
            tiltTicking = false;
          });
          tiltTicking = true;
        }
      });
      thumb.addEventListener('mouseleave', () => {
        thumb.classList.remove('is-tilting');
        thumb.style.transform = '';
      });
    });
  }

});
