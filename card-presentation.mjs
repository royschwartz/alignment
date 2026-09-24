import {GAIN_MS,CARD_REDEAL,entry,motion,smooth,segment,inkVisible} from './card-motion.mjs';
import {drawSelectionHand,SELECTION_HOLD_MS} from './selection-hand.mjs?v=1.4.4';

export const FORMAT_MS=GAIN_MS;
export const HEADER_BOTTOM=172;
export const MAC_FONT='Geneva, Helvetica, sans-serif';
const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
const seed=value=>[...String(value)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0;

export {cardLayout} from './phone-screen.mjs?v=1.4.4';

// Receipt amounts decide the glyphs. Net totals are deliberately independent:
// +5 direct rapture still reads +5 when task time also drains 4.
export function transferCards(feedback,changes,sources,fallback,targets){
 const visible=new Set(feedback.map(c=>c.stat));
 return changes.filter(c=>visible.has(c.stat)&&c.amount&&targets[c.stat]).map((change,index)=>({
  ...(sources[change.need]||fallback),stat:change.stat,delta:change.amount,target:targets[change.stat],
  viewportWidth:targets[change.stat].viewportWidth,
  flashSeed:seed(`${change.stat}:${change.need||''}:${index}:${fallback.flashSeed||0}`),
 }));
}

const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const fromPixels=(pixels,w,h)=>{const c=surface(w,h);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer,pixels.byteOffset,pixels.byteLength),w,h),0,0);return c;};
function ink(c){
 const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data,points=[];
 for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
  const i=(y*c.width+x)*4;if(data[i+3]>100&&data[i]<160)points.push({x,y,rank:hash(i+1909)});
 }
 return points;
}
function glyph(value){
 const c=surface(1,1),g=c.getContext('2d');g.font=`18px ${MAC_FONT}`;
 const m=g.measureText(value);c.width=Math.ceil(m.width)+4;c.height=24;
 g.font=`18px ${MAC_FONT}`;g.textBaseline='middle';g.fillText(value,2,12);
 return {width:c.width,height:c.height,points:ink(c)};
}
const amountText=amount=>`${amount>0?'+':'−'}${Number(Math.abs(amount).toFixed(6))}`;

// Presentation only. This layer cannot choose actions, change balances or save.
export class CardTransition {
 constructor({from,to,held,width,height,outgoing=[],incoming=[],selected,transfers=[],reduced=false,overlay=null,handImage=null,selectionPoint=null}){
  Object.assign(this,{width,height,selected,reduced,overlay,handImage,selectionPoint});this.duration=reduced?180:FORMAT_MS;
  this.selectedCard=outgoing.find(card=>card.action===selected);
  this.canvas=surface(width,height);this.g=this.canvas.getContext('2d',{willReadFrequently:true});this.g.imageSmoothingEnabled=false;
  this.from=fromPixels(from,width,height);this.to=fromPixels(to,width,height);this.held=fromPixels(held,width,height);
  const capture=(frame,card)=>{
   const c=surface(card.w+2,card.h+2),g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);
   g.drawImage(frame,card.x,card.y,c.width,c.height,0,0,c.width,c.height);
   return {card,surface:c,points:ink(c)};
  };
  this.outgoing=outgoing.map(c=>capture(this.from,c));this.incoming=incoming.map(c=>capture(this.to,c));
  this.transfers=transfers.map(card=>({card,glyph:glyph(amountText(card.delta))}));
  const old=surface(width,height),g=old.getContext('2d');g.drawImage(this.from,0,0);g.fillStyle='#fff';
  for(const c of outgoing)g.fillRect(c.x-2,c.y-5,c.w+4,c.h+9);
  g.fillRect(0,0,width,HEADER_BOTTOM);this.oldInk=ink(old);
 }
 frame(elapsed){
  const g=this.g,{width:w,height:h}=this;
  g.fillStyle='#fff';g.fillRect(0,0,w,h);
  if(elapsed>=this.duration){g.drawImage(this.to,0,0);return this.canvas;}
  // Header totals hold until the very same frame as card and number arrival.
  g.drawImage(this.held,0,0,w,HEADER_BOTTOM,0,0,w,HEADER_BOTTOM);
  g.strokeStyle='#000';g.strokeRect(.5,.5,w-1,h-1);
  if(this.reduced){
   g.drawImage(this.from,0,0);
   drawSelectionHand(g,this.handImage,this.selectedCard,w,h,elapsed,this.selectionPoint);
   this.overlay?.(g,elapsed/this.duration);return this.canvas;
  }
  g.fillStyle='#000';const erase=smooth(segment(elapsed,40,145));
  for(const p of this.oldInk)if(p.rank>=erase)g.fillRect(p.x,p.y,1,1);
  for(const item of this.outgoing){
   const {card,surface,points}=item,m=motion({...card,delta:1,target:{x:w/2,y:136}},elapsed);
   if(card.action===this.selected||this.transfers.some(t=>t.card.action===card.action&&t.card.delta<0)){
    // Let the selected outline linger under the hand while the number travels.
    // This overlaps the same 860 ms sequence rather than delaying its launch.
    const dissolve=card.action===this.selected&&this.handImage?smooth(segment(elapsed,160,SELECTION_HOLD_MS)):m.dissolve;
    for(const p of points){const progress=Math.abs(p.y-card.h/2)<24?Math.max(dissolve,m.labelDissolve):dissolve;if(p.rank>=progress)g.fillRect(card.x+p.x,card.y+p.y,1,1);}
   }else if(m.retreat<1)g.drawImage(surface,card.x,Math.round(card.y+m.retreat*(h-card.y+12)));
  }
  if(elapsed>=CARD_REDEAL)this.incoming.forEach(({card,surface},i)=>{
   const at=entry(card,i,elapsed-CARD_REDEAL,false,FORMAT_MS-CARD_REDEAL,h);g.drawImage(surface,Math.round(at.x),Math.round(at.y));
  });
  for(const {card,glyph} of this.transfers){
   const m=motion(card,elapsed);if(!m.flashVisible)continue;
   const x=Math.round(m.x-glyph.width/2),y=Math.round(m.y-glyph.height/2);g.fillStyle='#000';
   for(const p of glyph.points)if(inkVisible(p.rank,m.reveal,m.erase))g.fillRect(x+p.x,y+p.y,1,1);
  }
  drawSelectionHand(g,this.handImage,this.selectedCard,w,h,elapsed,this.selectionPoint);
  this.overlay?.(g,elapsed/this.duration);
  return this.canvas;
 }
}

// Start at the actual selection, not after preparation or an extra animation.
// Both callers keep controls disabled until this same clock reaches arrival.
export function playCardTransition({transition,context,startedAt,isCurrent,requestFrame=requestAnimationFrame,now=()=>performance.now()}) {
 return new Promise(resolve=>{
  const tick=time=>{
   if(!isCurrent()){resolve(false);return;}
   const elapsed=Math.max(0,time-startedAt);
   context.drawImage(transition.frame(elapsed),0,0);
   if(elapsed>=transition.duration)resolve(true);else requestFrame(tick);
  };
  tick(now());
 });
}
