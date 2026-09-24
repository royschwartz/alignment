// Real-time choreography in milliseconds. No game writes.
export const W = 415, H = 830;
export const DEAL_MS = 325, GAIN_MS = 860, LOSS_MS = GAIN_MS, CARD_REDEAL = 280;
export const CARD_ENTRY_STAGGER = 65, CARD_EXIT_STAGGER = 35;
export const cardExitKind=(card,selected,transfers=[])=>
  (selected!=null&&card.action===selected)||transfers.some(t=>t.action===card.action&&t.delta<0)?'disintegration':'withdrawal';
export const withdrawalWindow=index=>({start:25+index*CARD_EXIT_STAGGER,end:160+index*CARD_EXIT_STAGGER});
// Sound and pixels share these per-card start times; no extra game time is added.
export function cardSoundTimeline({outgoing=[],incoming=[],selected,transfers=[],reduced=false,hasHand=false}={}){
  const events=outgoing.map((card,index)=>{
    const cue=cardExitKind(card,selected,transfers),window=withdrawalWindow(index);
    return {cue,card:card.action,index,
      start:reduced?index*18:cue==='disintegration'?20:window.start,
      end:reduced?90:cue==='disintegration'?(hasHand&&card.action===selected?650:CARD_REDEAL):window.end};
  });
  return events.concat(incoming.map((card,index)=>({cue:'arrival',card:card.action,index,
    start:reduced?90+index*18:CARD_REDEAL+index*CARD_ENTRY_STAGGER,end:reduced?180:GAIN_MS})));
}
export const GAIN_LAUNCH = 100, GAIN_COAST = 270, GAIN_ARRIVAL = GAIN_MS;
export const LOSS_RELEASE = 391 / 1.3, LOSS_ARRIVAL = LOSS_MS;
// Keep the fast opening flicker, then stretch the pull to the shared finish.
const lossTime = ms => ms <= 391 ? ms / 1.3 : LOSS_RELEASE + (ms-391)*(LOSS_ARRIVAL-LOSS_RELEASE)/(860-391);
export const clamp = x => Math.max(0, Math.min(1, x));
export const mix = (a, b, t) => a + (b - a) * t;
export const smooth = x => { const p = clamp(x); return p * p * (3 - 2 * p); };
const smoother = x => { const p = clamp(x); return p*p*p*(p*(p*6-15)+10); };
export const segment = (t, from, to) => clamp((t - from) / (to - from));
const hermite = (p, startSlope, endSlope) => (p*p*p-2*p*p+p)*startSlope + (-2*p*p*p+3*p*p) + (p*p*p-p*p)*endSlope;
export function entry(card, index, elapsed, reduced = false, duration = DEAL_MS, viewportHeight = H) {
  const progress = reduced ? 1 : smoother(segment(elapsed, index * CARD_ENTRY_STAGGER, duration));
  return {x: card.x, y: mix(viewportHeight + 1, card.y, progress), progress};
}
export function withdrawal(index,elapsed){
  const {start,end}=withdrawalWindow(index);
  return smooth(segment(elapsed,start,end));
}
export const inkVisible = (rank, reveal, erase = 0) => rank < reveal && rank >= erase;
// Brief on/off flashes affect only the traveling number, never the page.
export const STROBE_START = 100, STROBE_END = 820, STROBE_PERIOD = 120, STROBE_ON = 65;
export const numberVisible = t => t < STROBE_START || t >= STROBE_END || (t - STROBE_START) % STROBE_PERIOD < STROBE_ON;
// Ten faster flashes stay near rapture, then the scattered pull carries the number away.
const nearFlashes = 10;
const lossFlashes = [[20,38],[56,75],[93,111],[129,149],[167,185],[203,221],[239,259],[277,295],[313,333],[351,369],[391,416],[434,456],[475,496],[516,540],[559,580],[601,623],[644,664],[685,709],[731,752],[773,796],[817,839]].map(pair=>pair.map(lossTime));
const lossNumberVisible = t => t >= LOSS_ARRIVAL || lossFlashes.some(([start,end]) => t >= start && t < end);
// Each deal gets a fresh pattern; each flash holds its position instead of jittering every frame.
const flashRandom = (card, index) => {
  let n = (card.flashSeed ?? 731) ^ Math.imul(index + 1, 0x9e3779b9);
  n = Math.imul(n ^ (n >>> 16), 0x21f0aaad);
  n = Math.imul(n ^ (n >>> 15), 0x735a2d97);
  return ((n ^ (n >>> 15)) >>> 0) / 0x100000000;
};
export function motion(card, elapsed, reduced = false) {
  const total = reduced ? 450 : card.delta > 0 ? GAIN_MS : LOSS_MS;
  const t = Math.max(0, elapsed), origin = {x: card.x + card.w / 2, y: card.y + card.h / 2};
  const target = card.target;
  if(!target)throw new Error("A transfer needs its attribute target.");
  const shared = {
    duration: total,
    redealAfter: reduced ? total : CARD_REDEAL,
    prose: 1 - smooth(segment(t, 40, 145)),
    retreat: smooth(segment(t, 25, reduced ? 250 : 160)),
    labelDissolve: smooth(segment(t, 20, 80)),
    dissolve: .40 * smooth(segment(t, 20, 140)) + .60 * smooth(segment(t, 140, CARD_REDEAL)),
    flashVisible: !reduced && numberVisible(t),
  };
  if(reduced) return {...shared, ...origin, reveal: 0, erase: 0, strain: 0, tether: false, sourceShift: 0,
    dissolve: smooth(t / total), phase: t >= total ? 'complete' : 'dissolving', arrived: t >= total, done: t >= total};
  if(card.delta > 0) {
    const launch = segment(t, GAIN_LAUNCH, GAIN_COAST);
    const lift = hermite(launch, 0, .30);
    const rise = segment(t, GAIN_COAST, GAIN_ARRIVAL);
    // Match both velocity components at the launch/coast join, then settle at the total.
    const liftDistance = Math.min(145, Math.max(0, (origin.y-target.y)*.65));
    const coastMs=GAIN_ARRIVAL-GAIN_COAST,launchMs=GAIN_COAST-GAIN_LAUNCH;
    // Hermite coordinates avoid division by a near-zero horizontal/vertical span.
    const coast=(from,to,velocity)=>rise>=1?to:from+(to-from)*smooth(rise)+(rise*rise*rise-2*rise*rise+rise)*velocity*coastMs;
    return {
      ...shared,
      x: t < GAIN_COAST ? origin.x + 8 * lift : coast(origin.x+8,target.x,8*.30/launchMs),
      y: t < GAIN_COAST ? origin.y - liftDistance * lift : coast(origin.y-liftDistance,target.y,-liftDistance*.30/launchMs),
      reveal: smooth(segment(t, 35, 140)), erase: smooth(segment(t, 750, GAIN_MS)),
      strain: 0, tether: false, sourceShift: 0,
      phase: t < GAIN_LAUNCH ? 'releasing' : t < GAIN_COAST ? 'launching' : t < GAIN_ARRIVAL ? 'floating' : t < total ? 'absorbing' : 'complete',
      arrived: t >= GAIN_ARRIVAL, done: t >= total,
    };
  }
  let {x,y} = origin;
  // Increasing radius makes every flash farther from rapture, while its angle scatters.
  // Choose the next spot in the dark gap, and hold it for the whole visible flash.
  const index = lossFlashes.findIndex(([,end]) => t < end);
  if(index >= 0) {
    const distance = Math.hypot(origin.x - target.x, origin.y - target.y);
    const radius = index < nearFlashes
      ? mix(26, 60, index / (nearFlashes - 1))
      : mix(60, distance, (index - nearFlashes + 1) / (lossFlashes.length - nearFlashes + 1));
    const progress = (radius - 26) / (distance - 26);
    const spread = Math.min(1.05, 78 / radius) * (1 - smooth(segment(progress,.72,1)));
    const angle = Math.atan2(origin.y - target.y, origin.x - target.x) + (flashRandom(card,index) * 2 - 1) * spread;
    x = target.x + Math.cos(angle) * radius;
    y = target.y + Math.sin(angle) * radius;
    // Edge attributes keep their scattered flashes on the canvas, without
    // reducing the outward distance or rerolling a position mid-flash.
    const boundedX=Math.max(18,Math.min((card.viewportWidth??W)-18,x));
    if(boundedX!==x){x=boundedX;y=target.y+Math.sqrt(Math.max(0,radius*radius-(x-target.x)**2));}
  }
  return {
    ...shared,
    x, y,
    flashVisible: lossNumberVisible(t),
    reveal: smooth(segment(t, lossTime(10), lossTime(32))), erase: smooth(segment(t, 750, LOSS_MS)),
    strain: 0, tether: false, sourceShift: 0,
    phase: t < LOSS_RELEASE ? 'blinking' : t < LOSS_ARRIVAL ? 'falling' : t < total ? 'absorbing' : 'complete',
    arrived: t >= LOSS_ARRIVAL, done: t >= total,
  };
}
