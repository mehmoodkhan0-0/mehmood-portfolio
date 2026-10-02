import html2canvas from 'html2canvas';

const COUNTDOWN_MS = 3000;
const GLITCH_MS = 210;
const WAVE_MS = 1250;
const TAIL_MS = 1550;
const MAX_PARTICLES = 9000;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function createFallbackSnapshot(width, height, scale) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#090807');
  gradient.addColorStop(.5, '#130f09');
  gradient.addColorStop(1, '#030304');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(216,186,124,.22)';
  ctx.lineWidth = 1;
  for (let y = 32; y < height; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  return canvas;
}

async function captureViewport(width, height, scale) {
  try {
    return await Promise.race([
      html2canvas(document.body, {
        backgroundColor: '#050507',
        scale,
        width,
        height,
        x: window.scrollX,
        y: window.scrollY,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        windowWidth: width,
        windowHeight: height,
        logging: false,
        useCORS: true,
        ignoreElements: (element) => element.classList?.contains('disintegrate-overlay')
      }),
      wait(1100).then(() => { throw new Error('capture timeout'); })
    ]);
  } catch {
    return createFallbackSnapshot(width, height, scale);
  }
}

function createParticleField(snapshot, width, height, scale, origin) {
  const sample = document.createElement('canvas');
  sample.width = width;
  sample.height = height;
  const sampleCtx = sample.getContext('2d', { willReadFrequently: true });
  sampleCtx.drawImage(snapshot, 0, 0, width, height);
  const pixels = sampleCtx.getImageData(0, 0, width, height).data;

  let stride = width < 700 ? 6 : 5;
  while (Math.ceil(width / stride) * Math.ceil(height / stride) > MAX_PARTICLES) stride += 1;

  const candidates = [];
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < 24) continue;
      candidates.push([x, y, pixels[i], pixels[i + 1], pixels[i + 2]]);
    }
  }

  const count = candidates.length;
  const state = {
    count,
    stride,
    x: new Float32Array(count),
    y: new Float32Array(count),
    vx: new Float32Array(count),
    vy: new Float32Array(count),
    spin: new Float32Array(count),
    angle: new Float32Array(count),
    delay: new Float32Array(count),
    life: new Float32Array(count),
    size: new Float32Array(count),
    r: new Uint8Array(count),
    g: new Uint8Array(count),
    b: new Uint8Array(count)
  };

  const maxDistance = Math.hypot(Math.max(origin.x, width - origin.x), Math.max(origin.y, height - origin.y));
  for (let i = 0; i < count; i++) {
    const [x, y, r, g, b] = candidates[i];
    const dx = x - origin.x;
    const dy = y - origin.y;
    const distance = Math.hypot(dx, dy) || 1;
    const noise = Math.random() * 150 - 75;
    const outward = .012 + Math.random() * .026;
    state.x[i] = x;
    state.y[i] = y;
    state.vx[i] = dx * outward + (Math.random() - .5) * .65;
    state.vy[i] = dy * outward * .22 - (.45 + Math.random() * 1.5);
    state.angle[i] = Math.random() * Math.PI;
    state.spin[i] = (Math.random() - .5) * .12;
    state.delay[i] = clamp((distance / maxDistance) * WAVE_MS + noise, 0, WAVE_MS);
    state.life[i] = 850 + Math.random() * 700;
    state.size[i] = .7 + Math.random() * 1.7;
    const luminance = r * .2126 + g * .7152 + b * .0722;
    const ember = Math.max(0, 34 - luminance);
    state.r[i] = Math.min(255, r + ember * 2.1);
    state.g[i] = Math.min(255, g + ember * 1.25);
    state.b[i] = Math.min(255, b + ember * .35);
  }
  return state;
}

function createOverlay(snapshot, width, height, scale) {
  const canvas = document.createElement('canvas');
  canvas.className = 'disintegrate-overlay';
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.drawImage(snapshot, 0, 0, width, height);
  document.body.appendChild(canvas);
  return { canvas, ctx };
}

function runReducedMotion(snapshot, width, height, scale) {
  const { canvas } = createOverlay(snapshot, width, height, scale);
  canvas.classList.add('is-glitching');
  return wait(GLITCH_MS).then(() => {
    canvas.classList.remove('is-glitching');
    canvas.classList.add('is-fading');
    return wait(650);
  });
}

function runDisintegration(snapshot, width, height, scale, origin) {
  const { canvas, ctx } = createOverlay(snapshot, width, height, scale);
  canvas.classList.add('is-glitching');

  return wait(GLITCH_MS).then(() => new Promise((resolve) => {
    canvas.classList.remove('is-glitching');
    document.body.classList.add('blackout-bg', 'is-disintegrating');

    const remaining = document.createElement('canvas');
    remaining.width = canvas.width;
    remaining.height = canvas.height;
    const remainingCtx = remaining.getContext('2d');
    remainingCtx.drawImage(snapshot, 0, 0, remaining.width, remaining.height);

    const particles = createParticleField(snapshot, width, height, scale, origin);
    let started = performance.now();
    let previous = started;
    let frameHandle = 0;
    let slowFrames = 0;
    let drawStride = 1;

    const frame = (now) => {
      const elapsed = now - started;
      const dt = Math.min(2, (now - previous) / 16.67);
      previous = now;
      if (dt > 1.55) slowFrames += 1;
      else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 8) drawStride = 2;

      remainingCtx.save();
      remainingCtx.setTransform(scale, 0, 0, scale, 0, 0);
      remainingCtx.globalCompositeOperation = 'destination-out';
      remainingCtx.fillStyle = '#000';
      remainingCtx.beginPath();
      for (let i = 0; i < particles.count; i++) {
        const local = elapsed - particles.delay[i];
        if (local >= 0 && local < 24) {
          const radius = particles.stride * (.72 + Math.random() * .48);
          remainingCtx.moveTo(particles.x[i] + radius, particles.y[i]);
          remainingCtx.arc(particles.x[i], particles.y[i], radius, 0, Math.PI * 2);
        }
      }
      remainingCtx.fill();
      remainingCtx.restore();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(remaining, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      for (let i = 0; i < particles.count; i += drawStride) {
        const age = elapsed - particles.delay[i];
        if (age < 0 || age > particles.life[i]) continue;
        const progress = age / particles.life[i];
        const turbulence = Math.sin(age * .012 + i * 1.73) * .035;
        particles.vx[i] += turbulence * dt;
        particles.vy[i] -= (.003 + Math.cos(age * .009 + i) * .002) * dt;
        particles.vx[i] *= Math.pow(.992, dt);
        particles.vy[i] *= Math.pow(.995, dt);
        particles.x[i] += particles.vx[i] * dt;
        particles.y[i] += particles.vy[i] * dt;
        particles.angle[i] += particles.spin[i] * dt;

        const alpha = Math.pow(1 - progress, 1.35) * (drawStride === 2 ? .82 : .96);
        const size = particles.size[i] * (1 - progress * .48);
        ctx.fillStyle = `rgba(${particles.r[i]},${particles.g[i]},${particles.b[i]},${alpha})`;
        if (size > 1.25 && i % 5 === 0) {
          ctx.save();
          ctx.translate(particles.x[i], particles.y[i]);
          ctx.rotate(particles.angle[i]);
          ctx.fillRect(-size, -.45, size * 2.3, .9);
          ctx.restore();
        } else {
          ctx.fillRect(particles.x[i], particles.y[i], size, size);
        }
        if (i % 19 === 0) {
          ctx.fillStyle = `rgba(232,190,104,${alpha * .45})`;
          ctx.fillRect(particles.x[i] - .5, particles.y[i] - .5, size + 1, size + 1);
        }
      }

      if (elapsed < WAVE_MS + TAIL_MS) frameHandle = requestAnimationFrame(frame);
      else {
        cancelAnimationFrame(frameHandle);
        resolve();
      }
    };

    frameHandle = requestAnimationFrame(frame);
  }));
}

export async function startSelfDestruct(button, startedAt, reduceMotion) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const scale = Math.min(window.devicePixelRatio || 1, width < 700 ? 1 : 1.35);
  const rect = button.getBoundingClientRect();
  const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  const snapshotPromise = captureViewport(width, height, scale);
  let countdownTimer;
  let reloading = false;

  const reload = () => {
    if (reloading) return;
    reloading = true;
    clearInterval(countdownTimer);
    window.location.reload();
  };

  const updateCountdown = () => {
    const remaining = Math.max(0, COUNTDOWN_MS - (performance.now() - startedAt));
    button.textContent = `[ ${Math.ceil(remaining / 1000)} ]`;
  };

  updateCountdown();
  countdownTimer = setInterval(updateCountdown, 100);
  await wait(Math.max(0, COUNTDOWN_MS - (performance.now() - startedAt)));
  clearInterval(countdownTimer);
  button.textContent = '[ 0 ]';

  const snapshot = await snapshotPromise;
  if (reduceMotion) await runReducedMotion(snapshot, width, height, scale);
  else await runDisintegration(snapshot, width, height, scale, origin);
  reload();
}
