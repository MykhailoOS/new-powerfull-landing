// Utilities
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Preloader
const preloader = (() => {
  let loaded = 0;
  let raf; 
  const minShow = 1400; // ms
  const start = performance.now();
  const bar = document.getElementById('loaderBar');
  const percent = document.getElementById('loaderPercent');

  const finish = () => {
    const el = document.getElementById('preloader');
    el.style.transition = 'opacity .5s ease, transform .6s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-6px)';
    setTimeout(() => el.remove(), 650);
  };

  const update = (now) => {
    loaded = lerp(loaded, 100, 0.06);
    const p = clamp(Math.round(loaded), 0, 100);
    bar.style.width = p + '%';
    percent.textContent = p + '%';
    if (p >= 100 && now - start > minShow) {
      cancelAnimationFrame(raf);
      finish();
      return;
    }
    raf = requestAnimationFrame(update);
  };

  window.addEventListener('load', () => {
    // Snap to 100 on load
    loaded = 100;
  });

  raf = requestAnimationFrame(update);
})();

// Starfield parallax background
(function starfield() {
  const canvas = document.getElementById('space');
  const ctx = canvas.getContext('2d');
  let w, h, dpr = Math.max(1, window.devicePixelRatio || 1);
  let stars = [];
  const STAR_COUNT = 220;
  let pointer = { x: 0.5, y: 0.5 };

  function resize() {
    w = canvas.width = Math.floor(innerWidth * dpr);
    h = canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
  }

  function resetStar(s) {
    s.x = (Math.random() * w - w / 2);
    s.y = (Math.random() * h - h / 2);
    s.z = Math.random() * w;
    s.size = (Math.random() * 0.6 + 0.2) * dpr;
  }

  function init() {
    stars = new Array(STAR_COUNT).fill(0).map(() => ({ x:0,y:0,z:0,size:1 }));
    for (const s of stars) resetStar(s);
  }

  function draw() {
    ctx.clearRect(0,0,w,h);
    ctx.save();
    ctx.translate(w/2, h/2);

    for (const s of stars) {
      s.z -= 0.6 * dpr; // speed
      if (s.z <= 0) resetStar(s);

      const k = 128 / s.z;
      const px = (s.x + (pointer.x - 0.5) * 1200) * k;
      const py = (s.y + (pointer.y - 0.5) * 800) * k;

      if (px < -w || px > w || py < -h || py > h) {
        resetStar(s); continue;
      }

      const alpha = clamp(1 - s.z / w, 0.05, 0.9);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fillRect(px, py, s.size, s.size);
    }

    ctx.restore();
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX / innerWidth; pointer.y = e.clientY / innerHeight;
  });

  resize(); init(); draw();
})();

// 3D Parallax Scene (mouse + slight scroll)
(function scene3D(){
  const scene = document.getElementById('scene');
  if (!scene) return;
  const layers = Array.from(scene.querySelectorAll('.layer'));
  let targetRX = 0, targetRY = 0, rx = 0, ry = 0;

  function onMove(e){
    const rect = scene.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    targetRY = x * 10; // deg
    targetRX = -y * 8; // deg
  }

  function onScroll(){
    const rect = scene.getBoundingClientRect();
    const vis = clamp(1 - Math.abs((rect.top + rect.height/2 - innerHeight/2) / innerHeight), 0, 1);
    scene.style.opacity = String(lerp(0.6, 1, vis));
  }

  function animate(){
    rx = lerp(rx, targetRX, 0.08);
    ry = lerp(ry, targetRY, 0.08);
    scene.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

    for (const l of layers){
      const depth = Number(l.dataset.depth || 0);
      const tx = ry * depth * -0.2;
      const ty = rx * depth * 0.2;
      l.style.transform = `translateZ(${depth}px) translate(${tx}px, ${ty}px)`;
    }
    requestAnimationFrame(animate);
  }

  scene.addEventListener('pointermove', onMove);
  window.addEventListener('scroll', onScroll, { passive: true });
  animate();
})();

// Intersection reveal
(function reveal(){
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) e.target.classList.add('in');
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
})();

// Floating stack subtle motion
(function stack(){
  const stack = document.getElementById('stack');
  if (!stack) return;
  stack.addEventListener('pointermove', (e) => {
    const r = stack.getBoundingClientRect();
    const x = (e.clientX - r.left)/r.width - 0.5;
    const y = (e.clientY - r.top)/r.height - 0.5;
    const cards = stack.querySelectorAll('.stack-card');
    cards.forEach((c, i) => {
      const d = (i - cards.length/2);
      c.style.transform = `translateZ(${60 - i*30}px) rotateX(${y*4}deg) rotateY(${x*-6}deg) translate(${x*d*8}px, ${y*d*8}px)`;
    });
  });
})();

// Magnetic buttons
(function magnetic(){
  const strength = 12;
  const buttons = document.querySelectorAll('.magnetic');
  buttons.forEach(btn => {
    let r;
    btn.addEventListener('pointerenter', () => { r = btn.getBoundingClientRect(); });
    btn.addEventListener('pointermove', (e) => {
      const x = (e.clientX - r.left - r.width/2) / (r.width/2);
      const y = (e.clientY - r.top - r.height/2) / (r.height/2);
      btn.style.transform = `translate(${x*strength}px, ${y*strength}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = 'translate(0,0)'; });
  });
})();

// Cursor follower
(function cursor(){
  const c = document.getElementById('cursor');
  let x = innerWidth/2, y = innerHeight/2, tx = x, ty = y;
  const follow = () => {
    x = lerp(x, tx, 0.15); y = lerp(y, ty, 0.15);
    c.style.left = x + 'px'; c.style.top = y + 'px';
    requestAnimationFrame(follow);
  };
  window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; });
  follow();
})();

// Year
document.getElementById('year').textContent = new Date().getFullYear();
