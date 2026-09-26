// Presentation-only choreography. No game state, storage or manuscript writes.
export const W = 415, H = 830;
export const GAIN_MS = 9000, LOSS_MS = 7700;
export const clamp = x => Math.max(0, Math.min(1, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
export const segment = (t, from, to) => clamp((t - from) / (to - from));
export const slots = { rapture: { x: 111, y: 136 }, disquiet: { x: 304, y: 136 } };
export const choices = [
  { label: 'throw it in the hole', x: 17, y: 552, w: 182, h: 108, stat: 'disquiet', delta: 1 },
  { label: 'don’t', x: 216, y: 552, w: 182, h: 108, stat: 'rapture', delta: -1 },
];
export function motion(card, elapsed, reduced = false) {
  const total = reduced ? 450 : card.delta > 0 ? GAIN_MS : LOSS_MS;
  const t = Math.max(0, elapsed), origin = { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  const target = slots[card.stat];
  if (reduced) return { x: origin.x, y: origin.y, opacity: 1 - smooth(t / total), scale: 1,
    dissolve: smooth(t / total), field: 0, strain: 0, tether: false, detached: false,
    phase: t >= total ? 'complete' : 'dissolving', arrived: t >= total, done: t >= total };
  if (card.delta > 0) {
    const rise = segment(t, 1400, 7900), travel = smooth(rise);
    const wander = Math.sin(Math.PI * rise);
    return {
      x: mix(origin.x, target.x, travel) + wander * (36 * Math.sin(rise * Math.PI * 3.1) - 14 * Math.sin(rise * Math.PI * 5)),
      y: mix(origin.y - 8, target.y, travel) + wander * 9 * Math.sin(rise * Math.PI * 4),
      scale: 1 + .09 * Math.sin(rise * Math.PI * 3) * wander,
      opacity: smooth(segment(t, 850, 1700)) * (1 - smooth(segment(t, 7600, 8120))),
      dissolve: smooth(segment(t, 150, 4800)),
      field: smooth(segment(t, 150, 2000)) * (1 - smooth(segment(t, 7900, total))),
      strain: 0, tether: false, detached: false,
      phase: t < 1400 ? 'releasing' : t < 7600 ? 'floating' : t < total ? 'absorbing' : 'complete',
      arrived: t >= 7900, done: t >= total,
    };
  }
  const pry = segment(t, 600, 3550), fall = segment(t, 3550, 6500);
  // Two resisted pulls, then a third pull that breaks the connection.
  const tug = Math.sin(pry * Math.PI * 5) * Math.sin(pry * Math.PI) * 19;
  const pullY = target.y + 15 + 90 * pry + tug;
  const pullX = target.x + 8 + 18 * pry + Math.sin(pry * Math.PI * 4) * 4 * Math.sin(pry * Math.PI);
  const acceleration = fall * fall * (1.5 - .5 * fall);
  const helix = Math.sin(Math.PI * fall) * Math.sin(fall * Math.PI * 4.5) * 22;
  return {
    x: t < 3550 ? pullX : mix(target.x + 26, origin.x, acceleration) + helix,
    y: t < 3550 ? pullY : mix(target.y + 105, origin.y, acceleration),
    scale: 1 - .5 * smooth(segment(t, 6000, 6700)),
    opacity: smooth(segment(t, 800, 1550)) * (1 - smooth(segment(t, 6150, 6650))),
    dissolve: smooth(segment(t, 200, 7200)),
    field: smooth(segment(t, 100, 2100)) * (1 - smooth(segment(t, 6650, total))),
    strain: t < 3550 ? clamp(pry * .8 + tug / 80) : (1 - smooth(segment(t, 3550, 4000))) * .8,
    tether: t >= 600 && t < 3550, detached: t >= 3550,
    phase: t < 600 ? 'gripping' : t < 3550 ? 'prying' : t < 6500 ? 'falling' : t < total ? 'absorbing' : 'complete',
    arrived: t >= 6500, done: t >= total,
  };
}
