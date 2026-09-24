// Pixel compositors inspired by the monochrome HyperCard visual command.
// Independent implementations; timing and zoom outlines are not ROM emulation.
export const EFFECTS = [
  'plain', 'dissolve', 'checkerboard', 'venetian blinds',
  'barn door open', 'barn door close', 'iris open', 'iris close',
  ...['wipe', 'scroll', 'push'].flatMap(kind => ['left', 'right', 'up', 'down'].map(dir => `${kind} ${dir}`)),
  ...['top', 'center', 'bottom'].map(anchor => `shrink to ${anchor}`),
  ...['top', 'center', 'bottom'].map(anchor => `stretch from ${anchor}`),
  'zoom open', 'zoom close', 'zoom in', 'zoom out', 'flash'
];
export const SPEEDS = { 'very fast': 120, fast: 250, normal: 500, slow: 900, 'very slow': 1400 };
export const TARGETS = ['card', 'black', 'white', 'gray', 'inverse'];
const WHITE = 0xffffffff, BLACK = 0xff000000;
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export function makeTarget(from, to, width, target = 'card') {
  if (target === 'card') return to;
  const out = new Uint32Array(to.length);
  for (let i = 0; i < out.length; i++) {
    out[i] = target === 'black' ? BLACK : target === 'white' ? WHITE :
      target === 'inverse' ? (from[i] ^ 0x00ffffff) >>> 0 :
      ((i % width + Math.floor(i / width)) % 2 ? BLACK : WHITE);
  }
  return out;
}

export function composeFrame(from, to, width, height, progress, effect = 'dissolve', output) {
  if (!EFFECTS.includes(effect)) throw new Error(`Unknown visual effect: ${effect}`);
  if (from.length !== width * height || to.length !== from.length) throw new Error('Mismatched card sizes');
  const out = output || new Uint32Array(from.length);
  const p = clamp(progress, 0, 1);
  if (p >= 1 || effect === 'plain') { out.set(to); return out; }
  if (p <= 0) { out.set(from); return out; }
  const cx = width / 2, cy = height / 2;
  const horizontal = effect.endsWith('left') || effect.endsWith('right');
  const negative = effect.endsWith('left') || effect.endsWith('up');
  const span = horizontal ? width : height, shift = Math.floor(span * p);
  const anchor = effect.endsWith('top') ? 0 : effect.endsWith('bottom') ? height : cy;
  const sample = (arr, x, y) => arr[clamp(Math.floor(y), 0, height - 1) * width + clamp(Math.floor(x), 0, width - 1)];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    let reveal = false, value;
    if (effect === 'dissolve') {
      // A stable permutation avoids flickering pixels and guarantees monotone replacement.
      let n = (Math.imul(i + 1, 0x45d9f3b) ^ 0x1234abcd) >>> 0;
      n = (Math.imul(n ^ (n >>> 16), 0x45d9f3b)) >>> 0;
      reveal = n / 4294967296 < p;
    } else if (effect === 'checkerboard') {
      const odd = (Math.floor(x / 16) + Math.floor(y / 16)) % 2;
      reveal = (y % 16) < clamp(p * 2 - odd, 0, 1) * 16;
    } else if (effect === 'venetian blinds') reveal = y % 16 < p * 16;
    else if (effect.startsWith('barn door')) {
      const radius = Math.abs(x - cx) / cx;
      reveal = effect.endsWith('open') ? radius < p : radius > 1 - p;
    } else if (effect.startsWith('iris')) {
      const radius = Math.sqrt(((x - cx) / cx) ** 2 + ((y - cy) / cy) ** 2) / Math.SQRT2;
      reveal = effect.endsWith('open') ? radius < p : radius > 1 - p;
    } else if (effect.startsWith('wipe')) {
      const pos = horizontal ? x : y;
      reveal = negative ? pos >= span - shift : pos < shift;
    } else if (effect.startsWith('scroll') || effect.startsWith('push')) {
      const pos = horizontal ? x : y;
      const oldPos = pos + (negative ? shift : -shift);
      const newPos = oldPos + (negative ? -span : span);
      if (oldPos < 0 || oldPos >= span) value = horizontal ? sample(to, newPos, y) : sample(to, x, newPos);
      else if (effect.startsWith('scroll') && from[i] === to[i]) value = from[i];
      else value = horizontal ? sample(from, oldPos, y) : sample(from, x, oldPos);
    } else if (effect.startsWith('shrink') || effect.startsWith('stretch')) {
      const stretching = effect.startsWith('stretch');
      const scale = stretching ? p : 1 - p;
      const sy = (y - anchor) / scale + anchor;
      value = sy >= 0 && sy < height ? sample(stretching ? to : from, x, sy) : (stretching ? from[i] : to[i]);
    } else if (effect === 'zoom in') value = sample(to, cx + (x - cx) * (2 - p), cy + (y - cy) * (2 - p));
    else if (effect === 'zoom out') {
      const sx = (x - cx) / (1 - p) + cx, sy = (y - cy) / (1 - p) + cy;
      value = sx >= 0 && sy >= 0 && sx < width && sy < height ? sample(from, sx, sy) : to[i];
    } else if (effect.startsWith('zoom')) {
      const radius = Math.max(Math.abs(x - cx) / cx, Math.abs(y - cy) / cy);
      reveal = effect.endsWith('open') ? radius < p : radius > 1 - p;
      // Expanding/contracting rectangular outlines, typical of classic Mac zooms.
      for (let j = 0; j < 3; j++) {
        const edge = effect.endsWith('open') ? p - j * 0.05 : 1 - p + j * 0.05;
        if (edge > 0 && edge < 1 && Math.abs(radius - edge) < 2 / Math.max(width, height)) value = BLACK;
      }
    } else if (effect === 'flash') value = p < 0.45 ? (from[i] ^ 0x00ffffff) >>> 0 : to[i];
    out[i] = value === undefined ? (reveal ? to[i] : from[i]) : value;
  }
  return out;
}

export function monochrome(context, width, height) {
  const data = context.getImageData(0, 0, width, height);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = data.data[i] * 0.2126 + data.data[i + 1] * 0.7152 + data.data[i + 2] * 0.0722 >= 160 ? 255 : 0;
    data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  context.putImageData(data, 0, 0);
  return new Uint32Array(data.data.buffer);
}
