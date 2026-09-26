import {headerStatLayout} from './game-stats.mjs?v=1.4.11';
import {GAIN_MS,DEAL_MS,CARD_REDEAL,entry,motion,smooth,segment,inkVisible,cardExitKind,withdrawal,presentationDuration} from './card-motion.mjs?v=1.4.11';
import {drawSelectionHand,SELECTION_HOLD_MS} from './selection-hand.mjs?v=1.4.11';
import {animateFrames,requestAnimationTick,cancelAnimationTick} from './animation-clock.mjs';

export const FORMAT_MS=GAIN_MS;
export {presentationDuration} from './card-motion.mjs?v=1.4.11';
export const HEADER_BOTTOM=200;
export const MAC_FONT='Geneva, Helvetica, sans-serif';
const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
const seed=value=>[...String(value)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0;

export {cardLayout} from './phone-screen.mjs?v=1.4.11';

// Receipt amounts decide the glyphs. Net totals are deliberately independent:
// +5 direct rapture still reads +5 when task time also drains 4.
export function transferCards(feedback,changes,sources,fallback,targets){
 const visible=new Set(feedback.map(c=>c.stat));
 // Money keeps its header feedback and balance animation, with no traveling glyph.
 return changes.filter(c=>c.stat!=='money'&&visible.has(c.stat)&&c.amount&&targets[c.stat]).map((change,index)=>({
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
// Follow connected black pixels from the top of the branch. Distance through
// the ink makes elbows extend sideways instead of appearing all at once.
export function growingInk(data,width,height){
 const black=new Uint8Array(width*height),distance=new Int32Array(width*height).fill(-1),queue=[];
 let firstRow=height,maxDistance=0;
 for(let i=0;i<black.length;i++)if(data[i*4+3]>100&&data[i*4]<160){black[i]=1;firstRow=Math.min(firstRow,Math.floor(i/width));}
 for(let x=0;x<width;x++){const i=firstRow*width+x;if(black[i]){distance[i]=0;queue.push(i);}}
 for(let head=0;head<queue.length;head++){
  const i=queue[head],x=i%width,y=Math.floor(i/width);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(!dx&&!dy||x+dx<0||x+dx>=width||y+dy<0||y+dy>=height)continue;
   const next=i+dy*width+dx;
   if(black[next]&&distance[next]<0){distance[next]=distance[i]+1;maxDistance=Math.max(maxDistance,distance[next]);queue.push(next);}
  }
 }
 const points=[];
 for(let i=0;i<black.length;i++)if(black[i])points.push({x:i%width,y:Math.floor(i/width),
  rank:distance[i]>=0?(distance[i]+1)/(maxDistance+1):(Math.floor(i/width)+1)/height});
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
 constructor({from,to,held,width,height,outgoing=[],incoming=[],selected,transfers=[],reduced=false,overlay=null,handImage=null,selectionPoint=null,decision=null}){
  Object.assign(this,{width,height,selected,reduced,overlay,handImage,selectionPoint});this.duration=presentationDuration(incoming.length,reduced);
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
  // Present the new writing at selection, before dealing its next cards.
  this.description=surface(width,height);const g=this.description.getContext('2d');
  g.drawImage(this.to,0,0);g.fillStyle='#fff';
  for(const c of incoming)g.fillRect(c.x-2,c.y-5,c.w+4,c.h+9);
  g.fillRect(0,0,width,HEADER_BOTTOM);
  // Only an arriving decision defers its writing to the deal. Other descriptions
  // retain the author's existing immediate-update behavior.
  if(decision){
   this.decision={};
   for(const kind of ['prose','branch']){
    const bounds=decision[kind];if(!bounds||bounds.w<1||bounds.h<1)continue;
    const c=surface(bounds.w,bounds.h),context=c.getContext('2d',{willReadFrequently:true});
    context.drawImage(this.to,bounds.x,bounds.y,bounds.w,bounds.h,0,0,bounds.w,bounds.h);
    this.decision[kind]={bounds,points:kind==='branch'?growingInk(context.getImageData(0,0,c.width,c.height).data,c.width,c.height):ink(c)};
    g.fillStyle='#fff';g.fillRect(bounds.x,bounds.y,bounds.w,bounds.h);
   }
  }
 }
 frame(elapsed){
  const g=this.g,{width:w,height:h}=this;
  g.fillStyle='#fff';g.fillRect(0,0,w,h);
  if(elapsed>=this.duration){g.drawImage(this.to,0,0);return this.canvas;}
  g.drawImage(this.description,0,0);
  // The writing is already visible; totals wait for card and number arrival.
  g.drawImage(this.held,0,0,w,HEADER_BOTTOM,0,0,w,HEADER_BOTTOM);
  g.strokeStyle='#000';g.strokeRect(.5,.5,w-1,h-1);
  if(this.reduced){
   drawSelectionHand(g,this.handImage,this.selectedCard,w,h,elapsed,this.selectionPoint);
   this.overlay?.(g,elapsed/this.duration);return this.canvas;
  }
  g.fillStyle='#000';
  for(const [index,item] of this.outgoing.entries()){
   const {card,surface,points}=item,m=motion({...card,delta:1,target:{x:w/2,y:headerStatLayout(w).transferY}},elapsed);
   if(cardExitKind(card,this.selected,this.transfers.map(t=>t.card))==='disintegration'){
    // Let the selected outline linger under the hand while the number travels.
    // This overlaps the deal rather than delaying its launch.
    const dissolve=card.action===this.selected&&this.handImage?smooth(segment(elapsed,160,SELECTION_HOLD_MS)):m.dissolve;
    for(const p of points){const progress=Math.abs(p.y-card.h/2)<24?Math.max(dissolve,m.labelDissolve):dissolve;if(p.rank>=progress)g.fillRect(card.x+p.x,card.y+p.y,1,1);}
   }else {
    const retreat=withdrawal(index,elapsed);
    if(retreat<1)g.drawImage(surface,card.x,Math.round(card.y+retreat*(h-card.y+12)));
   }
  }
  if(elapsed>=CARD_REDEAL)this.incoming.forEach(({card,surface},i)=>{
   const at=entry(card,i,elapsed-CARD_REDEAL,false,DEAL_MS,h);g.drawImage(surface,Math.round(at.x),Math.round(at.y));
  });
  if(this.decision){
   const progress=smooth(segment(elapsed,CARD_REDEAL,this.duration));g.fillStyle='#000';
   for(const part of Object.values(this.decision))for(const p of part.points)if(p.rank<=progress)g.fillRect(part.bounds.x+p.x,part.bounds.y+p.y,1,1);
  }
  // Preserve the opening transfer gesture; its tail reaches the header when
  // the last individually dealt card lands, without touching any accounting.
  const transferElapsed=elapsed<=CARD_REDEAL?elapsed:CARD_REDEAL+(elapsed-CARD_REDEAL)*(GAIN_MS-CARD_REDEAL)/(this.duration-CARD_REDEAL);
  for(const {card,glyph} of this.transfers){
   const m=motion(card,transferElapsed);if(!m.flashVisible)continue;
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
export function playCardTransition({transition,context,startedAt,isCurrent,requestFrame=requestAnimationTick,cancelFrame=cancelAnimationTick,now=()=>performance.now()}) {
 return animateFrames({duration:transition.duration,startedAt,isCurrent,requestFrame,cancelFrame,now,
  draw:elapsed=>context.drawImage(transition.frame(elapsed),0,0)});
}
