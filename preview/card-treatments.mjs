// Display-lab treatments for pain and need cards. Black and white canvas drawing
// only: every frame passes through the game's monochrome threshold, so shading
// is done with ordered-dither patterns. Nothing here changes rules or charges.
import {wrapText,placeText} from './text-layout.mjs';

export const PAIN=[
  {id:'none',name:'none',note:'The current game: no mark.'},
  {id:'thorns-1997',name:'1.3.7 thorns',note:'Triangular thorns on every edge, from the published 1.3.7 build.'},
  {id:'bramble',name:'bramble border',note:'A thorny stem winds along the edge. A placeholder until Roy’s vine art arrives.'},
  {id:'barbed-across',name:'barbed wire across',note:'Two twisted strands wrapped across the card, above and below the label, running past the edges.'},
  {id:'barbed-border',name:'barbed-wire border',note:'Barbed wire replaces the card’s outline.'},
  {id:'pressed',name:'pressed in',note:'The card sinks into the page: a heavy inner edge and a dithered rim.'}
];
export const NEED=[
  {id:'none',name:'none',note:'The current game: no mark.'},
  {id:'chain',name:'chain to the heart',note:'Roy’s choice: a chain runs from the heart to the card. Left unchosen, the card is withdrawn up the chain and takes rapture with it.'},
  {id:'flashes-1997',name:'1.3.7 flashes',note:'Small crosses blink in two corners, from the published 1.3.7 build.'},
  {id:'heartbeat',name:'heartbeat',note:'A hollow heart in the corner beats lub-dub and the outline swells with it, like a Tamagotchi calling.'},
  {id:'lit',name:'lit on the beat',note:'The card briefly inverts, twice per beat, like HyperCard’s hilite.'},
  {id:'lifted',name:'lifted',note:'The card rises off the page on a hard shadow and breathes.'},
  {id:'ring',name:'glowing ring',note:'The classic Mac default-button ring. Its dither density pulses like Aqua’s default button.'},
  {id:'pulled',name:'pulled in',note:'Mac zoom rectangles converge onto the card, the reverse of a window opening.'},
  {id:'thread',name:'thread to the heart',note:'A dotted thread runs from the header heart to the card and sways.'}
];
// Each pairing sets the two treatments along one opposite axis.
export const PAIRINGS=[
  {pain:'bramble',need:'chain',name:'thorns / chain (Roy’s chain)'},
  {pain:'thorns-1997',need:'flashes-1997',name:'1.3.7 baseline'},
  {pain:'bramble',need:'heartbeat',name:'still thorns / beating heart'},
  {pain:'barbed-across',need:'lit',name:'covered / lit'},
  {pain:'pressed',need:'lifted',name:'pressed in / lifted'},
  {pain:'barbed-border',need:'ring',name:'wire border / glowing ring'},
  {pain:'thorns-1997',need:'pulled',name:'points out / pulls in'},
  {pain:'barbed-across',need:'thread',name:'barbed wire / thread'}
];
export const isAnimated=need=>need&&need!=='none';
export const isTethered=need=>need==='thread'||need==='chain';

// Motion: a stronger burst when the choices appear, then a slower, smaller beat.
// Lub-dub stays at two changes per beat, under the three-flashes-per-second limit.
const ARRIVAL=7200;
export function pulse(t,since) {
  const elapsed=Math.max(0,t-since),calm=elapsed>ARRIVAL,period=calm?4200:2400,amp=calm?.7:1,p=elapsed%period;
  const bump=(start,len)=>p>=start&&p<start+len?Math.sin((p-start)/len*Math.PI):0;
  return amp*Math.max(bump(0,150),.8*bump(250,150));
}
export function breath(t,since) {
  const elapsed=Math.max(0,t-since),period=elapsed>ARRIVAL?3600:2000;
  return (1-Math.cos(2*Math.PI*(elapsed%period)/period))/2;
}

const BAYER=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5],tiles=new Map();
export const ditherFill=(c,level)=>dither(c,level);
function dither(c,level) {
  level=Math.max(0,Math.min(16,Math.round(level)));
  if(!tiles.has(level)) {
    const tile=document.createElement('canvas');tile.width=tile.height=4;
    const t=tile.getContext('2d');t.fillStyle='#fff';t.fillRect(0,0,4,4);t.fillStyle='#000';
    BAYER.forEach((value,i)=>{if(value<level)t.fillRect(i%4,Math.floor(i/4),1,1);});
    tiles.set(level,tile);
  }
  return c.createPattern(tiles.get(level),'repeat');
}
function rng(id) {
  let s=2166136261;for(const ch of String(id))s=Math.imul(s^ch.charCodeAt(0),16777619)>>>0;
  return ()=>{s=(s+0x6d2b79f5)>>>0;let n=s;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
// A point on the card outline at arc length s, clockwise from the top-left corner.
function perimeter(x,y,w,h,s) {
  const total=2*(w+h);s=((s%total)+total)%total;
  if(s<w)return {px:x+s,py:y,nx:0,ny:-1,tx:1,ty:0};s-=w;
  if(s<h)return {px:x+w,py:y+s,nx:1,ny:0,tx:0,ty:1};s-=h;
  if(s<w)return {px:x+w-s,py:y+h,nx:0,ny:1,tx:-1,ty:0};s-=w;
  return {px:x,py:y+h-s,nx:-1,ny:0,tx:0,ty:-1};
}
function box(c,x,y,w,h) {c.fillStyle='#fff';c.fillRect(x,y,w,h);c.strokeStyle='#000';c.lineWidth=1;c.strokeRect(x+.5,y+.5,w-1,h-1);}
function roundRect(c,x,y,w,h,r) {
  c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
function heart(c,cx,cy,s) {
  c.beginPath();c.moveTo(cx,cy+s*.45);
  c.bezierCurveTo(cx-s*.62,cy+s*.02,cx-s*.42,cy-s*.52,cx,cy-s*.16);
  c.bezierCurveTo(cx+s*.42,cy-s*.52,cx+s*.62,cy+s*.02,cx,cy+s*.45);c.closePath();
}

// ---- pain: still, heavy, pointing outward ----
function thorns1997(c,x,y,w,h,level=2) {
  // The published 1.3.7 drawOffer() thorns; level 2 is the original spacing and size.
  const gap=[26,17,11][level-1],k=[.8,1,1.3][level-1];c.fillStyle='#000';
  for(let yy=y+12;yy<y+h-7;yy+=gap)for(const side of [-1,1]){const edge=side<0?x:x+w;c.beginPath();c.moveTo(edge,yy-5*k);c.lineTo(edge+side*5*k,yy+1);c.lineTo(edge,yy+5*k);c.lineTo(edge-side*4,yy);c.closePath();c.fill();}
  for(let xx=x+15;xx<x+w-8;xx+=gap+2)for(const side of [-1,1]){const edge=side<0?y:y+h;c.beginPath();c.moveTo(xx-4*k,edge);c.lineTo(xx+1,edge+side*5*k);c.lineTo(xx+5*k,edge);c.closePath();c.fill();}
}
function bramble(c,x,y,w,h,id,level=2) {
  const r=rng('bramble:'+id),total=2*(w+h),a=2+r()*1.5,ph=r()*6.28,ph2=r()*6.28;
  const spacing=[[13,7],[8,7],[5,4]][level-1],grow=(level-2)*1.5;
  const offset=s=>a*Math.sin(s/11+ph)+1.2*Math.sin(s/4.7+ph2);
  const at=s=>{const p=perimeter(x,y,w,h,s),d=offset(s);return {...p,X:p.px+p.nx*d,Y:p.py+p.ny*d};};
  c.strokeStyle='#000';c.lineWidth=[1.5,2,2.5][level-1];c.lineJoin='round';c.beginPath();
  for(let s=0;s<=total;s+=2){const p=at(s);s?c.lineTo(p.X,p.Y):c.moveTo(p.X,p.Y);}
  c.closePath();c.stroke();
  c.fillStyle='#000';
  for(let s=r()*6;s<total;s+=spacing[0]+r()*spacing[1]) {
    // Rose-style thorn: a wide base on the stem, the tip bent back along it.
    const p=at(s),out=r()<.72?1:-1,len=Math.max(3,4+r()*3+grow);
    c.beginPath();c.moveTo(p.X-p.tx*2.5,p.Y-p.ty*2.5);c.lineTo(p.X+p.tx*2.5,p.Y+p.ty*2.5);
    c.lineTo(p.X+p.nx*out*len-p.tx*len*.55,p.Y+p.ny*out*len-p.ty*len*.55);c.closePath();c.fill();
  }
}
function wire(c,x1,y1,x2,y2,id,spacing=24) {
  const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy),tx=dx/length,ty=dy/length,nx=-ty,ny=tx,r=rng('wire:'+id);
  c.lineCap='round';c.strokeStyle='#fff';c.lineWidth=6;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();
  c.strokeStyle='#000';c.lineWidth=1.3;
  for(const phase of [0,Math.PI]){c.beginPath();for(let s=0;s<=length;s++){const o=1.6*Math.sin(s/2.6+phase),X=x1+tx*s+nx*o,Y=y1+ty*s+ny*o;s?c.lineTo(X,Y):c.moveTo(X,Y);}c.stroke();}
  c.lineWidth=1.6;c.fillStyle='#000';
  for(let s=spacing*(.35+r()*.4);s<length-4;s+=spacing+r()*6-3) {
    const X=x1+tx*s,Y=y1+ty*s;
    for(const a of [.9,-.9]){const ux=nx*a+tx*.55,uy=ny*a+ty*.55,k=4.6/Math.hypot(ux,uy);c.beginPath();c.moveTo(X-ux*k,Y-uy*k);c.lineTo(X+ux*k,Y+uy*k);c.stroke();}
    c.fillRect(Math.round(X)-1,Math.round(Y)-1,3,3);
  }
  c.lineCap='butt';
}
function barbedAcross(c,x,y,w,h,id,level=2) {
  // Strung above and below the label, slightly slanted, so the words stay clear.
  // Heavier losses add strands: one, two, then two plus wraps over the corners.
  const spacing=[30,24,17][level-1];
  wire(c,x-7,y+h*.15,x+w+7,y+h*.27,id+':a',spacing);
  if(level>=2)wire(c,x-7,y+h*.87,x+w+7,y+h*.75,id+':b',spacing);
  if(level>=3){wire(c,x-6,y+h*.42,x+w*.2,y-6,id+':c',spacing);wire(c,x+w*.8,y+h+6,x+w+6,y+h*.58,id+':d',spacing);}
}
function barbedBorder(c,x,y,w,h,id,level=2) {
  const g=[30,21,13][level-1];
  wire(c,x-5,y,x+w+5,y,id+':t',g);wire(c,x+w,y-5,x+w,y+h+5,id+':r',g);
  wire(c,x+w+5,y+h,x-5,y+h,id+':b',g);wire(c,x,y+h+5,x,y-5,id+':l',g);
}
function pressed(c,x,y,w,h,level=2) {
  const rim=[3,4,6][level-1];c.fillStyle=dither(c,8);
  c.fillRect(x+1,y+h-rim-1,w-2,rim);c.fillRect(x+w-rim-1,y+1,rim,h-2);
  c.fillStyle='#000';c.fillRect(x+1,y+1,w-2,rim-1);c.fillRect(x+1,y+1,rim-1,h-2);
  c.strokeStyle='#000';c.lineWidth=1;c.strokeRect(x+rim+2.5,y+rim+2.5,w-2*rim-5,h-2*rim-5);
}

// ---- need: alive, light, pulling inward ----
function flashes1997(c,x,y,w,h) {
  // The published 1.3.7 corner flashes, unchanged.
  c.fillStyle='#000';
  for(const [cx,cy] of [[x+9,y+9],[x+w-9,y+h-9]]){c.fillRect(cx-4,cy,9,1);c.fillRect(cx,cy-4,1,9);c.fillRect(cx-1,cy-1,3,3);}
}
function heartbeat(c,x,y,w,h,k) {
  c.strokeStyle='#000';c.lineWidth=1;
  for(let i=1;i<=Math.round(k*2.4);i++)c.strokeRect(x-i+.5,y-i+.5,w+2*i-1,h+2*i-1);
  const s=12*(1+.35*k);heart(c,x+w-18,y+16,s);
  if(k>.3){c.fillStyle='#000';c.fill();} else {c.lineWidth=1.5;c.stroke();}
}
function ring(c,x,y,w,h,b) {
  roundRect(c,x-5.5,y-5.5,w+11,h+11,9);c.strokeStyle=dither(c,4+12*b);c.lineWidth=3;c.stroke();
}
function pulled(c,x,y,w,h,t,since,reduce) {
  c.strokeStyle=dither(c,8);c.lineWidth=1;
  const rect=off=>c.strokeRect(x-off+.5,y-off+.5,w+2*off-1,h+2*off-1);
  if(reduce){rect(5);rect(10);return;}
  const elapsed=Math.max(0,t-since),period=elapsed>ARRIVAL?5000:2800,p=elapsed%period,duration=620;
  if(p>=duration)return;
  for(let i=0;i<3;i++){const f=Math.min(1,Math.max(0,p/duration*1.6-i*.3));if(f>0&&f<1)rect(Math.round(3+18*(1-f)));}
}
export function drawChain(c,anchor,{x,y,w,routeX},t,since,reduce) {
  const end={x:x+w/2,y:y-1},sway=reduce?0:5*Math.sin(Math.max(0,t-since)/800);
  const mid={x:(anchor.x+end.x)/2+sway,y:Math.max(anchor.y,end.y)+10};
  const point=u=>{
    if(routeX!==undefined&&end.y>anchor.y+65){
      const bend=Math.min(anchor.y+48,end.y-30),low=end.y-22;
      if(u<.25){const p=u*4;return{x:anchor.x+(routeX-anchor.x)*(1-(1-p)**2),y:anchor.y+(bend-anchor.y)*p};}
      if(u<.85){const p=(u-.25)/.6;return{x:routeX+(reduce?0:Math.sin(p*Math.PI)*Math.sin(t/1100)),y:bend+(low-bend)*p};}
      const p=(u-.85)/.15;return{x:routeX+(end.x-routeX)*p*p,y:low+(end.y-low)*(1-(1-p)**2)};
    }
    return{x:(1-u)**2*anchor.x+2*(1-u)*u*mid.x+u*u*end.x,y:(1-u)**2*anchor.y+2*(1-u)*u*mid.y+u*u*end.y};
  };
  c.strokeStyle='#000';c.fillStyle='#000';let last=point(0),links=0;
  for(let i=1;i<=400;i++) {
    const p=point(i/400);if(Math.hypot(p.x-last.x,p.y-last.y)<6)continue;
    const a=Math.atan2(p.y-last.y,p.x-last.x),mx=(p.x+last.x)/2,my=(p.y+last.y)/2;
    c.save();c.translate(mx,my);c.rotate(a);
    if(links++%2===0){c.lineWidth=1.3;c.beginPath();c.ellipse(0,0,4.6,2.6,0,0,Math.PI*2);c.stroke();}
    else c.fillRect(-3.5,-.9,7,1.8);
    c.restore();last=p;
  }
  c.lineWidth=1.5;c.beginPath();c.arc(end.x,end.y,3,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.stroke();
}
// A single chain link, for the log row that records a withdrawn need card.
export function drawChainGlyph(c,x,y,size=16) {
  c.save();c.strokeStyle='#000';c.lineWidth=1.4;c.translate(x+size/2,y+size/2);c.rotate(-Math.PI/4);
  c.beginPath();c.ellipse(-3,0,4.2,2.4,0,0,Math.PI*2);c.stroke();c.beginPath();c.ellipse(3,0,4.2,2.4,0,0,Math.PI*2);c.stroke();c.restore();
}
// The face-down card: a patterned back in the same frame, nothing to read.
const backTile=(()=>{let tile=null;return ()=>{if(tile)return tile;tile=document.createElement('canvas');tile.width=tile.height=6;
  const t=tile.getContext('2d');t.fillStyle='#fff';t.fillRect(0,0,6,6);t.fillStyle='#000';for(let i=0;i<6;i++){t.fillRect(i,i,1,1);t.fillRect(5-i,i,1,1);}return tile;};})();
export function drawCardBack(c,x,y,w,h) {
  box(c,x,y,w,h);c.strokeStyle='#000';c.lineWidth=1;c.strokeRect(x+4.5,y+4.5,w-9,h-9);
  c.fillStyle=c.createPattern(backTile(),'repeat');c.fillRect(x+7,y+7,w-14,h-14);
  c.beginPath();c.ellipse(x+w/2,y+h/2,w*.16,h*.2,0,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.lineWidth=1.5;c.stroke();
}
// The check: an overhead fist after Roy's drawing (design-sources/roy-art-2026-09-23),
// drawn in code so its shape can follow the tap. lift 1 = raised, 0 = knuckles on the table.
// Raised, it is nearer and larger, its shadow thrown off to the side; on contact the
// fingers foreshorten as the knuckles turn down, the fist spreads a touch and the
// shadow tucks underneath it.
export function drawOverheadFist(c,cx,cy,size,lift=.35) {
  const u=size/64,L=Math.max(0,Math.min(1,lift)),k=(.9+.16*L)*u,squash=L<.08?1-(.08-L)*.9:1,f=.8+.2*L;
  c.save();
  const off=(1.5+8*L)*u;c.fillStyle=dither(c,Math.round(9-4*L));
  c.beginPath();c.ellipse(cx+off,cy+4*u+off,25*u*(1-.12*L),22*u*(1-.12*L),0,0,Math.PI*2);c.fill();
  c.translate(cx,cy);c.scale(k*(2-squash),k*squash);
  c.lineWidth=2.6;c.lineJoin='round';c.lineCap='round';c.strokeStyle='#000';c.fillStyle='#fff';
  // Forearm running off toward the player.
  c.beginPath();c.moveTo(-13,12);c.lineTo(-15,32);c.lineTo(15,32);c.lineTo(13,12);c.closePath();c.fill();
  c.beginPath();c.moveTo(-13,12);c.lineTo(-15,32);c.moveTo(13,12);c.lineTo(15,32);c.stroke();
  // Back of the hand, narrowing to the wrist.
  c.beginPath();c.moveTo(-23,-6);c.quadraticCurveTo(-25,8,-14,15);c.quadraticCurveTo(0,19,14,15);c.quadraticCurveTo(25,8,23,-6);c.closePath();c.fill();c.stroke();
  // Four curled fingers across the top, knuckles uppermost, with grooves between them.
  const top=-6-21*f;
  for(let i=0;i<4;i++){const x=-23+i*11.5;roundRect(c,x,top+(i===0||i===3?3*f:0),11.5,-top+2-(i===0||i===3?3*f:0),5.5);c.fill();c.stroke();}
  // Thumb folded along the right side.
  c.beginPath();c.moveTo(20,-5);c.quadraticCurveTo(30,4,20,13);c.quadraticCurveTo(15,9,17,1);c.closePath();c.fill();c.stroke();
  c.restore();
}
// Short marks around the fist at the moment its knuckles meet the table.
export function drawTapMarks(c,cx,cy,size,lift) {
  if(lift>=.06)return;
  c.fillStyle='#000';
  for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3+.35,r1=size*.5,r2=size*.64;
    c.save();c.translate(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);c.rotate(a);c.fillRect(0,-1,r2-r1,2);c.restore();}
}
// The check hand (WetPaint flat hand, prepared by research/card-display-2026-09-22/check-hand/
// make-check-hand.py). It rests flat on the table, then pats twice: lifted toward the player
// it grows and its shadow slides out; on contact the shadow returns under it and small
// marks show at the fingertips. The shadow is the hand's own silhouette in a dither.
export function handShadow(sprite) {
  const shadow=document.createElement('canvas');shadow.width=sprite.width;shadow.height=sprite.height;
  const s=shadow.getContext('2d');s.fillStyle=dither(s,7);s.fillRect(0,0,shadow.width,shadow.height);
  s.globalCompositeOperation='destination-in';s.drawImage(sprite,0,0);return shadow;
}
export function handLift(p) {
  const keys=[[0,0],[.18,1],[.3,0],[.48,.8],[.6,0],[1,0]];
  if(p==null)return 0;
  for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){const [a,la]=keys[i-1],[b,lb]=keys[i],q=(p-a)/(b-a);return la+(lb-la)*(lb<la?q*q:1-(1-q)**2);}
  return 0;
}
// tapping: true while a check plays, so the contact marks show only on the pats.
export function drawTapHand(c,sprite,shadow,cx,cy,lift,tapping=false) {
  const w=sprite.width,h=sprite.height,k=1+.14*lift,off=Math.round(1+7*lift);
  c.save();c.imageSmoothingEnabled=false;
  c.drawImage(shadow,Math.round(cx-w/2+off),Math.round(cy-h/2+off));
  c.translate(cx,cy+h*.08*lift);c.scale(k,k);c.drawImage(sprite,-w/2,-h/2);c.restore();
  if(tapping&&lift<.05){c.fillStyle='#000';const tipY=cy-h/2-3;
    for(const [dx,a] of [[-18,-2.3],[-6,-1.85],[6,-1.3],[18,-.85]]){c.save();c.translate(cx+dx,tipY);c.rotate(a);c.fillRect(2,-1,7,2);c.restore();}}
}
// The tap: raise, strike, rebound, strike, settle (two knocks on the table).
export function tapLift(p) {
  const keys=[[0,.35],[.16,1],[.28,0],[.46,.75],[.58,0],[.8,.2],[1,.35]];
  if(p==null)return .35;
  for(let i=1;i<keys.length;i++)if(p<=keys[i][0]){const [a,la]=keys[i-1],[b,lb]=keys[i],q=(p-a)/(b-a);return la+(lb-la)*(lb<la?q*q:1-(1-q)**2);}
  return .35;
}
// Placeholder fist for checking, drawn front-on with the knuckles down.
export function drawFist(c,x,y) {
  c.save();c.lineWidth=1.6;c.strokeStyle='#000';c.fillStyle='#fff';
  roundRect(c,x+13,y+30,16,9,1);c.fill();c.stroke();
  roundRect(c,x+3,y+11,36,21,6);c.fill();c.stroke();
  for(let i=0;i<4;i++){roundRect(c,x+4+i*8.5,y+3,8.5,14,4);c.fill();c.stroke();}
  roundRect(c,x+7,y+19,24,7,3.5);c.fill();c.stroke();
  c.restore();
}
export function drawThread(c,anchor,{x,y,w},t,since,reduce) {
  const end={x:x+w/2,y:y+1},sway=reduce?0:9*Math.sin(Math.max(0,t-since)/650);
  const mid={x:(anchor.x+end.x)/2+sway,y:Math.max(anchor.y,end.y)+24};
  c.fillStyle='#000';let last=null;
  for(let i=0;i<=240;i++) {
    const u=i/240,X=(1-u)**2*anchor.x+2*(1-u)*u*mid.x+u*u*end.x,Y=(1-u)**2*anchor.y+2*(1-u)*u*mid.y+u*u*end.y;
    if(!last||Math.hypot(X-last.x,Y-last.y)>=5){c.fillRect(Math.round(X)-1,Math.round(Y)-1,2,2);last={x:X,y:Y};}
  }
}

// Roy selected study 07, Worn ink. Keep the grain fixed to the card so it
// travels with the artwork instead of shimmering during the deal.
const inkNoise=(x,y,seed=0)=>{
  let n=Math.imul(x+seed*73,374761393)+Math.imul(y+19,668265263);
  n=Math.imul(n^(n>>>13),1274126177);
  return((n^(n>>>16))>>>0)/4294967296;
};
export function wornInkPixels(w,h,rim){
  const pixels=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const studyY=y+6,dx=Math.min(x,w-1-x),dy=Math.min(y,h-1-y);
    const edge=Math.min(dx,dy),frame=edge<rim,corner=dx<18&&dy<18,r=inkNoise(x,studyY,29);
    let black=frame;
    if(frame&&edge>=3&&!corner){
      const erosion=inkNoise(Math.floor(x/3),Math.floor(studyY/3),4)*2.8+inkNoise(x,studyY,8)*1.8;
      black=edge<rim-erosion&&(r>.065||edge<5);
    }else if(!frame){
      const inside=edge-rim;
      black=inside<7&&r<.07*(1-inside/7)&&inkNoise(Math.floor(x/4),Math.floor(studyY/4),9)>.4;
    }
    if(black)pixels[y*w+x]=1;
  }
  return pixels;
}
const inkFaces=new Map();
function drawWornInkFace(c,x,y,w,h,rim){
  const width=Math.round(w),height=Math.round(h),key=`${width}:${height}:${rim}`;
  let face=inkFaces.get(key);
  if(!face){
    face=document.createElement('canvas');face.width=width;face.height=height;
    const paint=face.getContext('2d'),data=paint.createImageData(width,height),pixels=wornInkPixels(width,height,rim);
    for(let i=0;i<pixels.length;i++){
      const value=pixels[i]?0:255,offset=i*4;
      data.data[offset]=data.data[offset+1]=data.data[offset+2]=value;data.data[offset+3]=255;
    }
    paint.putImageData(data,0,0);
    if(inkFaces.size>=16)inkFaces.delete(inkFaces.keys().next().value);
    inkFaces.set(key,face);
  }
  c.save();c.imageSmoothingEnabled=false;c.drawImage(face,x,y,w,h);c.restore();
}

export function drawChoiceCard(c,{x,y,w,h,label,textLayout,labelInset=14,available=true,pain='none',need='none',level=2,faceDown=false,id='',t=0,since=0,reduceMotion=false,fontFamily='monospace',bold=true}) {
  // A single inked top face replaces the stripes, within the same footprint.
  c.save();c.fillStyle='#000';
  for(let row=0;row<6;row++){
    const inset=6-row;c.fillRect(x+inset,y+row,w-2*inset,1);
  }
  c.fillStyle='#fff';
  for(let row=2;row<5;row++)for(let col=9;col<w-9;col++){
    if(inkNoise(Math.floor(col/2),Math.floor(row/2),47)>.8&&inkNoise(col,row,8)>.3)c.fillRect(x+col,y+row,1,1);
  }
  c.restore();y+=6;h-=6;
  const k=reduceMotion?.6:pulse(t,since),b=reduceMotion?1:breath(t,since);
  let fx=x,fy=y;
  if(need==='lifted'){const o=Math.round(1+2*b);fx=x-o;fy=y-o;c.fillStyle='#000';c.fillRect(x+o,y+o,w,h);}
  if(need==='ring')ring(c,x,y,w,h,b);
  if(need==='pulled')pulled(c,x,y,w,h,t,since,reduceMotion);
  // Roy's heavier frame is inset, so every card keeps the same outer size.
  const rim=Math.max(6,Math.round(w*.085));
  labelInset=Math.max(labelInset,rim+6);
  // A face-down card shows its back, but its need or pain marks stay visible.
  if(faceDown)drawCardBack(c,fx,fy,w,h);
  else drawWornInkFace(c,fx,fy,w,h,rim);
  if(pain==='pressed')pressed(c,fx,fy,w,h,level);
  if(pain==='thorns-1997')thorns1997(c,fx,fy,w,h,level);
  if(pain==='bramble')bramble(c,fx,fy,w,h,id,level);
  if(pain==='barbed-border')barbedBorder(c,fx,fy,w,h,id,level);
  if(pain==='barbed-across')barbedAcross(c,fx,fy,w,h,id,level);
  if(need==='heartbeat')heartbeat(c,fx,fy,w,h,k);
  if(need==='thread'){c.fillStyle='#000';c.fillRect(Math.round(fx+w/2)-2,fy-1,5,4);}
  if(need==='chain'){c.strokeStyle='#000';c.lineWidth=1.5;c.beginPath();c.arc(fx+w/2,fy-1,3,0,Math.PI*2);c.fillStyle='#fff';c.fill();c.stroke();}
  // The label matches the game's choice button: bold 13 px, centred unless placed.
  const size=13,leading=size+6;
  c.font=`${bold?'bold ':''}${size}px ${fontFamily}`;c.textBaseline='top';c.textAlign='left';
  const measure=value=>c.measureText(value).width,rows=faceDown?[]:wrapText(label,w-2*labelInset,measure);
  const placed=placeText(rows,{measure,bounds:{x:fx+labelInset,y:fy+rim+6,w:w-2*labelInset,h:h-2*(rim+6)},leading,fontSize:size,
    top:fy+(h-leading*rows.length)/2+3,layout:textLayout||{align:'center'},autoCenter:rows.length===1,scaleWidth:w,scaleHeight:h});
  if(pain==='barbed-across'){c.strokeStyle='#fff';c.lineWidth=4;c.lineJoin='round';placed.forEach(row=>c.strokeText(row.text,Math.round(row.x),Math.round(row.y)));}
  c.fillStyle='#000';placed.forEach(row=>c.fillText(row.text,Math.round(row.x),Math.round(row.y)));
  if(need==='flashes-1997'&&(reduceMotion||Math.max(0,t-since)%1000<500))flashes1997(c,fx,fy,w,h);
  if(need==='lit'&&k>.45){c.save();c.globalCompositeOperation='difference';c.fillStyle='#fff';c.fillRect(fx,fy,w,h);c.restore();}
  if(!available){c.fillStyle='#fff';for(let yy=fy+2;yy<fy+h-2;yy++)for(let xx=fx+2+(yy%2);xx<fx+w-2;xx+=2)c.fillRect(xx,yy,1,1);}
}
