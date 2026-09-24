import {TIME_RATES} from './author-legacy.mjs';

export const HUNGER_DEFAULTS=Object.freeze({enabled:false,rapidPerHour:2});
export const HUNGER_COLORS=Object.freeze({rapid:'#c62828',rising:'#b58900',stable:'#000000',falling:'#1565c0'});
const descriptions={rapid:'increasing quickly',rising:'increasing slowly',stable:'stable',falling:'decreasing'};
export function hungerTrend(state,config=HUNGER_DEFAULTS) {
  // The game advances through tasks. Use the latest measured interval, not the
  // accumulated hunger value. Instant adjustments use a one-minute interval.
  const event=state.events.findLast(e=>e.id!=='editor-preview'&&(e.minutes>0||e.delta.hunger!==0));
  const rate=event?event.delta.hunger*60/Math.max(1,event.minutes):TIME_RATES.hungerPerHour;
  const threshold=config.rapidPerHour??HUNGER_DEFAULTS.rapidPerHour;
  const trend=Math.abs(rate)<1e-6?'stable':rate<0?'falling':rate>=threshold?'rapid':'rising';
  return {rate,trend,color:HUNGER_COLORS[trend],description:descriptions[trend]};
}
export const displayedStats=(state,config=HUNGER_DEFAULTS)=>Object.entries(state.stats).filter(([id])=>id!=='hunger'||config.enabled===true);

// Tint only the already rasterized number so the existing monochrome artwork,
// text edges and dissolve effects retain their original pixels.
export function tintHungerNumber(pixels,width,height,number) {
  if(!number||number.color===HUNGER_COLORS.stable)return pixels;
  const rgb=number.color.slice(1).match(/../g).map(part=>parseInt(part,16));
  const color=new Uint32Array(Uint8Array.from([...rgb,255]).buffer)[0];
  const left=Math.max(0,Math.floor(number.x)),right=Math.min(width,Math.ceil(number.x+number.w));
  const top=Math.max(0,Math.floor(number.y)),bottom=Math.min(height,Math.ceil(number.y+number.h));
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[y*width+x]===0xff000000)pixels[y*width+x]=color;
  return pixels;
}
