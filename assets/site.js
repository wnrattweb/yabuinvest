/* Progressive enhancement only: no framework, tracking, cookies or form backend. */
(() => {
  'use strict';
  const dataElement = document.getElementById('site-data');
  if (!dataElement) return;
  let config;
  try { config = JSON.parse(dataElement.textContent); }
  catch (error) { console.error('YABU: invalid site configuration.', error); return; }
  const t = config.strings;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  document.documentElement.classList.add('js');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const assetURL = path => config.assetBase + path;
  const arrowMarkup = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" stroke-width="1.5"/></svg>';
  const watchedImages = new WeakSet();

  // The deploy folders are overlays: existing image paths remain unchanged.
  // If a path is missing in a local preview, try the two original live sites once.
  function watchImage(img) {
    if (watchedImages.has(img)) return;
    watchedImages.add(img);
    let attempt = 0;
    const originalPath = img.dataset.asset;
    const candidates = originalPath ? [
      `https://yabu.com.tr/${originalPath}`,
      `https://yabuinvest.com/${originalPath}`
    ].filter((url, i, list) => url !== img.src && list.indexOf(url) === i) : [];
    function fail() {
      if (attempt < candidates.length) { img.src = candidates[attempt++]; return; }
      img.classList.add('asset-unavailable');
      const host = img.closest('.hero-slide, .card-media, .about-visual, .project-dialog-media');
      if (host && !host.querySelector('.media-unavailable')) {
        const fallback = document.createElement('span');
        fallback.className = 'media-unavailable';
        fallback.setAttribute('aria-hidden', 'true');
        const caption = document.createElement('span');
        caption.textContent = img.alt;
        fallback.append(caption);
        host.append(fallback);
      }
      if (img.classList.contains('brand-logo') || img.classList.contains('footer-logo')) {
        if (!img.parentElement.querySelector('.brand-fallback')) {
          img.style.display = 'none';
          const fallback = document.createElement('span');
          fallback.className = 'brand-fallback';
          fallback.textContent = 'YABU';
          img.insertAdjacentElement('afterend', fallback);
        }
      }
    }
    img.addEventListener('error', fail);
    img.addEventListener('load', () => {
      img.classList.remove('asset-unavailable');
      img.closest('.hero-slide, .card-media, .about-visual, .project-dialog-media')?.querySelector('.media-unavailable')?.remove();
    });
    if (img.complete && img.naturalWidth === 0) fail();
  }
  $$('img[data-asset]').forEach(watchImage);
  function makeImage(path, alt) {
    const img = document.createElement('img');
    img.src = assetURL(path); img.alt = alt; img.dataset.asset = path;
    img.decoding = 'async'; watchImage(img); return img;
  }

  // Mobile navigation remains a regular in-flow landmark, not an inaccessible overlay.
  const menuButton = $('.menu-button');
  const mobileMenu = $('#mobile-menu');
  function setMenu(open, restoreFocus = false) {
    mobileMenu.hidden = !open;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? t.menuClose : t.menu);
    if (restoreFocus) menuButton.focus({preventScroll:true});
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  $$('a', mobileMenu).forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileMenu.hidden) setMenu(false, true);
  });
  window.matchMedia('(min-width:1061px)').addEventListener('change', event => {
    if (event.matches) setMenu(false);
  });

  // Manual carousel: no unsolicited autoplay, timers or background video downloads.
  const featured = config.portfolio.filter(project => project.image);
  const heroStage = $('.hero-stage');
  const slides = $$('[data-slide]');
  const slideTabs = $$('[data-go-slide]');
  let currentSlide = 0;
  function setSlide(index) {
    currentSlide = (index + featured.length) % featured.length;
    const project = featured[currentSlide];
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === currentSlide);
      slide.setAttribute('aria-hidden', String(i !== currentSlide));
      const img = $('img', slide);
      if (i === currentSlide && img) img.loading = 'eager';
    });
    slideTabs.forEach((button, i) => {
      button.classList.toggle('is-active', i === currentSlide);
      button.setAttribute('aria-pressed', String(i === currentSlide));
    });
    $('#hero-index').textContent = String(currentSlide + 1).padStart(2, '0');
    $('#hero-city').textContent = t.cities[project.city] || '';
    $('#hero-category').textContent = t.categoryNames[project.category];
    $('#hero-project-name').textContent = project.short;
    const link = $('#hero-video');
    link.href = `https://www.youtube.com/watch?v=${project.video}`;
    link.dataset.video = project.video;
    link.dataset.videoTitle = project.short;
  }
  $$('[data-slide-direction]').forEach(button => button.addEventListener('click', () => setSlide(currentSlide + Number(button.dataset.slideDirection))));
  slideTabs.forEach(button => button.addEventListener('click', () => setSlide(Number(button.dataset.goSlide))));
  heroStage.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      setSlide(currentSlide + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  let pointerStart = null;
  heroStage.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' && !event.target.closest('a,button')) pointerStart = {x:event.clientX,y:event.clientY};
  }, {passive:true});
  heroStage.addEventListener('pointerup', event => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x, dy = event.clientY - pointerStart.y;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) setSlide(currentSlide + (dx < 0 ? 1 : -1));
    pointerStart = null;
  }, {passive:true});
  heroStage.addEventListener('pointercancel', () => { pointerStart = null; });

  const cards = $$('.portfolio-card');
  const filterButtons = $$('[data-filter]');
  function filterProjects(category, scroll = false) {
    if (!filterButtons.some(button => button.dataset.filter === category)) return;
    let visible = 0;
    cards.forEach(card => {
      const show = category === 'all' || card.dataset.category === category;
      card.hidden = !show;
      card.classList.remove('filter-enter');
      if (show) {
        visible++;
        if (!reducedMotion.matches) { void card.offsetWidth; card.classList.add('filter-enter'); }
      }
    });
    filterButtons.forEach(button => {
      const active = button.dataset.filter === category;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    $('#filter-status').textContent = `${visible} ${t.projectCount}`;
    if (scroll) {
      $('#investments').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});
      $(`[data-filter="${category}"]`)?.focus({preventScroll:true});
    }
  }
  filterButtons.forEach(button => button.addEventListener('click', () => filterProjects(button.dataset.filter)));
  $$('[data-sector-filter]').forEach(button => button.addEventListener('click', () => filterProjects(button.dataset.sectorFilter, true)));

  // Dialogs have native keyboard focus trapping and Escape support.
  const projectDialog = $('#project-dialog');
  const videoDialog = $('#video-dialog');
  const allDialogs = [projectDialog, videoDialog];
  const returnTargets = new WeakMap();
  let projectOpener = null;
  let videoId = null;
  let videoName = '';
  const initialVideoHTML = $('#video-host').innerHTML;
  function openModal(dialog, opener) {
    allDialogs.filter(other => other !== dialog && other.open).forEach(other => other.close());
    returnTargets.set(dialog, opener || document.activeElement);
    dialog.showModal();
    document.body.classList.add('modal-open');
    $('.dialog-close', dialog)?.focus({preventScroll:true});
  }
  function closeModal(dialog) { if (dialog.open) dialog.close(); }
  allDialogs.forEach(dialog => {
    $$('[data-close]', dialog).forEach(button => button.addEventListener('click', () => closeModal(dialog)));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeModal(dialog);
    });
    dialog.addEventListener('close', () => {
      if (dialog === videoDialog) { $('#video-host').innerHTML = initialVideoHTML; videoId = null; }
      if (!allDialogs.some(other => other.open)) {
        document.body.classList.remove('modal-open');
        const target = returnTargets.get(dialog);
        if (target?.isConnected && !target.closest('dialog:not([open])')) target.focus({preventScroll:true});
      }
    });
  });
  function makeLink(label, href, className, external = false) {
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    const text = document.createElement('span'); text.textContent = label;
    link.append(text);
    link.insertAdjacentHTML('beforeend', arrowMarkup);
    if (external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    return link;
  }
  function openProject(id, opener) {
    const project = config.portfolio.find(item => item.id === id);
    if (!project) return;
    projectOpener = opener;
    const media = $('#project-dialog-media');
    media.className = `project-dialog-media ${project.image ? '' : 'logo-only'} theme-${project.theme}`;
    media.replaceChildren(makeImage(project.image || project.logo, project.name));
    $('#project-dialog-title').textContent = project.name;
    $('#project-dialog-category').textContent = t.categoryNames[project.category] + (project.city ? ` / ${t.cities[project.city]}` : '');
    const logo = $('#project-dialog-logo');
    logo.replaceChildren();
    logo.className = `project-dialog-logo ${project.theme === 'dark' ? 'logo-dark' : ''}`;
    logo.hidden = !project.image;
    if (project.image) logo.append(makeImage(project.logo, project.name));
    const actions = $('#project-dialog-actions');
    actions.replaceChildren();
    if (project.url) actions.append(makeLink(t.visitWebsite, project.url, 'button button-dark', true));
    else {
      const p = document.createElement('p'); p.textContent = t.noWebsite; actions.append(p);
      actions.append(makeLink(t.contactUs, `mailto:${config.lang === 'tr'?'info@yabu.com.tr':'info@yabuinvest.com'}`, 'button button-dark'));
    }
    if (project.video) {
      const film = makeLink(t.watch, `https://www.youtube.com/watch?v=${project.video}`, 'text-link', true);
      film.dataset.video = project.video; film.dataset.videoTitle = project.short;
      actions.append(film);
    }
    openModal(projectDialog, opener);
  }
  $$('[data-project]').forEach(button => button.addEventListener('click', () => openProject(button.dataset.project, button)));

  function openVideo(id, title, opener) {
    if (!/^[\w-]{11}$/.test(id)) return;
    const focusTarget = projectDialog.open ? projectOpener : opener;
    // Reset the consent view before each new video; no iframe is loaded yet.
    $('#video-host').innerHTML = initialVideoHTML;
    videoId = id; videoName = title || t.videoTitle;
    $('#video-dialog-title').textContent = videoName;
    $('#video-external').href = `https://www.youtube.com/watch?v=${id}`;
    if (config.preview) {
      $('#video-load').replaceChildren(document.createTextNode(t.youtubeLink));
    }
    openModal(videoDialog, focusTarget);
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-video]');
    if (!link) return;
    event.preventDefault();
    openVideo(link.dataset.video, link.dataset.videoTitle, link);
  });
  videoDialog.addEventListener('click', event => {
    if (!event.target.closest('#video-load') || !videoId) return;
    // file:// previews lack the HTTP referrer required by some YouTube embeds.
    if (config.preview) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank', 'noopener,noreferrer');
      return;
    }
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`;
    iframe.title = videoName;
    iframe.allow = 'accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    $('#video-host').replaceChildren(iframe);
  });

  // No map embed or API key is required. Links point to the selected city.
  $$('.location-card').forEach(card => {
    const region = card.dataset.region;
    $$('[data-city]', card).forEach(button => button.addEventListener('click', () => {
      const key = button.dataset.city;
      const query = config.countryMap[region]?.[key];
      if (!query) return;
      $$('[data-city]', card).forEach(other => {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      $('.country-caption', card).textContent = t.cities[key];
      $('.location-map', card).href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    }));
  });
  function updateClocks() {
    const now = new Date();
    $$('time[data-timezone]').forEach(time => {
      try {
        time.textContent = new Intl.DateTimeFormat('en-GB', {hour:'2-digit',minute:'2-digit',hour12:false,timeZone:time.dataset.timezone}).format(now);
        time.dateTime = now.toISOString();
      } catch { time.textContent = '—:—'; }
    });
    $$('[data-year]').forEach(node => { node.textContent = String(now.getFullYear()); });
  }
  updateClocks();
  const clockTimer = window.setInterval(() => { if (!document.hidden) updateClocks(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) updateClocks(); });
  window.addEventListener('pagehide', () => window.clearInterval(clockTimer), {once:true});

  // Production switches domains, never auto-redirects people by country or IP.
  // The standalone preview switches its two locally embedded documents instead.
  $$('[data-locale]').filter(node => node.tagName === 'A').forEach(link => {
    link.addEventListener('click', event => {
      const language = link.dataset.locale;
      if (language === config.lang) { event.preventDefault(); return; }
      if (config.preview) {
        event.preventDefault();
        if (window.parent !== window) {
          window.parent.postMessage({type:'yabu:setLocale',locale:language,hash:window.location.hash}, '*');
        } else {
          const filename = language === 'tr' ? 'YABU-Turkce.html' : 'YABU-English.html';
          window.location.href = new URL(filename + window.location.hash, window.location.href).href;
        }
      } else {
        const next = new URL(link.href);
        next.hash = window.location.hash;
        link.href = next.href;
      }
    });
  });
  if (config.preview && window.parent !== window) {
    window.addEventListener('message', event => {
      if (event.source !== window.parent || event.data?.type !== 'yabu:scroll') return;
      const hash = typeof event.data.hash === 'string' ? event.data.hash : '';
      if (/^#[a-zA-Z0-9_-]+$/.test(hash)) document.getElementById(hash.slice(1))?.scrollIntoView({behavior:'instant'});
    });
  }
})();
