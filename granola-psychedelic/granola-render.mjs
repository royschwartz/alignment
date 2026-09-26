import {W,H,clamp,mix,smooth,segment,motion,slots,choices} from './granola-motion.mjs';

const TAU=Math.PI*2;
const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const hash=n=>{let x=Math.imul(n^0x45d9f3b,0x45d9f3b);x=Math.imul(x^(x>>>16),0x45d9f3b);return((x^(x>>>16))>>>0)/4294967295;};
const surface=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
const digits={
 '0':['01110','11011','11011','11011','11011','11011','01110'],
 '1':['00100','01100','00100','00100','00100','00100','01110'],
 '2':['01110','11011','00011','00110','01100','11000','11111'],
 '3':['11110','00011','00011','01110','00011','00011','11110'],
 '4':['00011','00111','01011','11011','11111','00011','00011'],
 '5':['11111','11000','11000','11110','00011','11011','01110'],
 '6':['01110','11000','11000','11110','11011','11011','01110'],
 '7':['11111','00011','00110','00110','01100','01100','01100'],
 '8':['01110','11011','11011','01110','11011','11011','01110'],
 '9':['01110','11011','11011','01111','00011','00011','01110'],
 '+':['00000','00100','00100','11111','00100','00100','00000'],
 '−':['00000','00000','00000','11111','00000','00000','00000'],
};
function numberSprite(value,scale=3){const str=String(value),c=surface((str.length*6-1)*scale,7*scale),g=c.getContext('2d');g.fillStyle='#000';[...str].forEach((s,i)=>digits[s]?.forEach((row,y)=>[...row].forEach((v,x)=>{if(v==='1')g.fillRect((i*6+x)*scale,y*scale,scale,scale);})));return c;}
function textSprite(value,font='16px Times',pad=2){const c=surface(1,1),g=c.getContext('2d');g.font=font;const metrics=g.measureText(value);c.width=Math.ceil(metrics.width)+pad*2;c.height=Math.ceil(metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent)+pad*2;g.font=font;g.fillStyle='#000';g.textBaseline='alphabetic';g.fillText(value,pad,pad+metrics.actualBoundingBoxAscent);const d=g.getImageData(0,0,c.width,c.height);for(let i=0;i<d.data.length;i+=4)d.data[i+3]=d.data[i+3]>=105?255:0;g.putImageData(d,0,0);return c;}
function line(g,x1,y1,x2,y2){g.beginPath();g.moveTo(Math.round(x1)+.5,Math.round(y1)+.5);g.lineTo(Math.round(x2)+.5,Math.round(y2)+.5);g.stroke();}
function rect(g,x,y,w,h){g.strokeRect(Math.round(x)+.5,Math.round(y)+.5,Math.round(w)-1,Math.round(h)-1);}
function center(g,s,x,y){g.drawImage(s,Math.round(x-s.width/2),Math.round(y-s.height/2));}

export class GranolaRenderer {
 constructor(canvas,prose,icons){
  this.canvas=canvas;this.g=canvas.getContext('2d',{willReadFrequently:true});this.icons=icons;
  this.title=textSprite('A L I G N M E N T','bold 11px Geneva, Arial');
  this.captions=Object.fromEntries(Object.keys(slots).map(k=>[k,textSprite(k.toUpperCase(),'10px Geneva, Arial')]));
  this.prose=[];const words=prose.split(' ');let row='';for(const word of words){const trial=row?row+' '+word:word;if(textSprite(trial,'17px Times').width>363&&row){this.prose.push(textSprite(row,'17px Times'));row=word;}else row=trial;}if(row)this.prose.push(textSprite(row,'17px Times'));
  this.numbers=new Map();this.gain=numberSprite('+1');this.loss=numberSprite('−1');
  this.cards=choices.map((card,index)=>this.makeCard(card,index));
 }
 num(value){if(!this.numbers.has(value))this.numbers.set(value,numberSprite(value));return this.numbers.get(value);}
 makeCard(card,index){
  const c=surface(card.w,card.h),g=c.getContext('2d',{willReadFrequently:true});g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.strokeStyle='#000';g.lineWidth=1;rect(g,0,0,c.width,c.height);rect(g,4,4,c.width-8,c.height-8);
  // Offset checker weave: a printed border, not another illustration.
  for(let x=8;x<c.width-8;x++)for(let y=8;y<c.height-8;y++){if((x<15||x>c.width-16||y<15||y>c.height-16)&&((x+y)%4===0)){g.fillStyle='#000';g.fillRect(x,y,1,1);}}
  center(g,textSprite(card.label,'15px Times'),card.w/2,card.h/2);
  const pixels=g.getImageData(0,0,c.width,c.height).data,points=[];
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4]<128){const n=y*c.width+x+index*44000;points.push({x,y,seed:hash(n),phase:hash(n+11)*TAU,drift:hash(n+72)});}
  return {surface:c,points};
 }
 draw(state){
  const g=this.g,{time,elapsed,selected,reduced,balance,committed}=state,card=choices[selected],m=card?motion(card,elapsed,reduced):null;
  g.setTransform(1,0,0,1,0,0);g.globalAlpha=1;g.fillStyle='#fff';g.fillRect(0,0,W,H);g.strokeStyle='#000';g.lineWidth=1;g.imageSmoothingEnabled=false;
  this.field(reduced?0:time/1000,reduced?null:card,reduced?null:m,elapsed);
  this.frame();
  // Keep the authored sentence legible while the field moves around it.
  const proseOpacity=selected<0?1:1-smooth(segment(elapsed,600,1900));
  if(proseOpacity>0){g.globalAlpha=proseOpacity;this.prose.forEach((s,i)=>{const y=322+(i-(this.prose.length-1)/2)*24;g.fillStyle='#fff';g.fillRect((W-s.width)/2-10,y-s.height/2-7,s.width+20,s.height+14);center(g,s,W/2,y);});g.globalAlpha=1;}
  if(selected<0){choices.forEach((c,i)=>{const p=reduced?1:1-Math.pow(1-segment(elapsed,220+i*170,1150+i*170),3),x=c.x+(i?-1:1)*(1-p)*240,y=c.y+(1-p)*105;if(p>0){g.fillStyle='#000';g.fillRect(Math.round(x+3),Math.round(y+3),c.w,c.h);g.drawImage(this.cards[i].surface,Math.round(x),Math.round(y));}});}
  else {
   const other=1-selected,exit=smooth(segment(elapsed,0,reduced?180:1200)),c=choices[other];
   if(exit<1){g.globalAlpha=1-exit;g.drawImage(this.cards[other].surface,Math.round(c.x+(other?1:-1)*exit*210),c.y+Math.round(exit*20));g.globalAlpha=1;}
   this.dissolve(card,selected,m,elapsed,reduced);
  }
  this.headers(balance,card,m,elapsed,committed,reduced);
  if(card&&!reduced){this.tethers(card,m,elapsed);this.token(card,m,elapsed);this.arrival(card,m,elapsed);}
  this.monochrome();
 }
 frame(){
  const g=this.g;g.fillStyle='#fff';g.fillRect(0,0,W,27);g.strokeStyle='#000';rect(g,0,0,W,H);line(g,0,26,W,26);
  for(let y=5;y<=21;y+=3){line(g,5,y,121,y);line(g,294,y,409,y);}
  center(g,this.title,W/2,13);g.fillStyle='#fff';g.fillRect(12,7,12,12);rect(g,12,7,12,12);
  // HyperCard's small stacked-card device, purely interface ornament.
  g.fillStyle='#fff';g.fillRect(194,783,24,18);rect(g,199,786,16,12);rect(g,196,783,16,12);rect(g,193,780,16,12);
 }
 field(t,card,m,elapsed){
  const g=this.g,intensity=m?.field??0,pivot=smooth(segment(elapsed,0,1400));
  const cx=card?mix(W/2,card.x+91,pivot):W/2,cy=card?mix(604,card.y+54,pivot):604;
  g.save();g.beginPath();g.rect(1,27,W-2,H-29);g.clip();g.strokeStyle='#000';
  // Slowly breathing nested contours, cut from one-bit ink. No temporal noise.
  for(let ring=0;ring<22;ring++){
   const rx=75+ring*13,ry=34+ring*11;
   g.globalAlpha=ring%3===0?.84+intensity*.16:.43+intensity*.30;g.lineWidth=ring%5===0?2:1;g.beginPath();
   for(let step=0;step<=144;step++){
    const a=step/144*TAU,warp=Math.sin(a*5+t*.31+ring*.29)*(7+intensity*11)+Math.sin(a*3-t*.21)*5;
    const x=cx+Math.cos(a)*(rx+warp),y=cy+Math.sin(a)*(ry+warp*.65);
    if(step===0)g.moveTo(x,y);else g.lineTo(x,y);
   }g.stroke();
  }
  // Side margins are bent scan-lines: stronger as a card comes apart.
  g.globalAlpha=.54+intensity*.3;g.lineWidth=1;
  for(let side=0;side<2;side++)for(let k=0;k<9;k++){
   g.beginPath();for(let y=165;y<752;y+=3){const envelope=Math.sin((y-165)/587*Math.PI);const bend=(Math.sin(y*.014+t*.25+k*.20)*14+Math.cos(y*.025-t*.19)*8)*envelope;const x=side?W-5-k*4-bend:5+k*4+bend;if(y===165)g.moveTo(x,y);else g.lineTo(x,y);}g.stroke();
  }
  // A stable dust field, with a few drifting pinpoints rather than flickering pixels.
  g.globalAlpha=.75;g.fillStyle='#000';for(let i=0;i<120;i++){
   let x=hash(i+980)*W,y=182+hash(i+1890)*550;
   if(x>52&&x<363&&y<440)continue;
   x+=Math.sin(t*.17+i)*2;y+=Math.cos(t*.13+i)*2;
   g.fillRect(Math.round(x),Math.round(y),1,1);
  }
  if(card&&intensity>.01){
   // The traveling number bends its own small field of nested afterimages.
   g.globalAlpha=.67*intensity;
   for(let r=0;r<13;r++){
    const radius=22+r*7;g.beginPath();for(let j=0;j<=80;j++){
     const a=j/80*TAU,petal=Math.sin(a*3-t*.7+r*.31)*(3+r*.3);
     const x=m.x+Math.cos(a)*(radius+petal),y=m.y+Math.sin(a)*(radius*.65+petal);
     j?g.lineTo(x,y):g.moveTo(x,y);
    }g.stroke();
   }
   // Curving ribbons connect the dissolving card to the changing attribute.
   g.globalAlpha=.56*intensity;const top=slots[card.stat];
   for(let strand=0;strand<7;strand++){
    g.beginPath();for(let j=0;j<=100;j++){
     const p=j/100,spread=Math.sin(Math.PI*p);const x=mix(top.x,cx,p)+Math.sin(p*TAU*1.5-t*.44+strand*.25)*spread*(26+strand*7);
     const y=mix(top.y+20,cy,p);j?g.lineTo(x,y):g.moveTo(x,y);
    }g.stroke();
   }
  }
  g.restore();
 }
 dissolve(card,index,m,elapsed,reduced){
  const g=this.g;if(reduced){g.globalAlpha=1-m.dissolve;g.drawImage(this.cards[index].surface,card.x,card.y);g.globalAlpha=1;return;}
  if(m.dissolve>=1)return;
  // The paper is eaten in curling islands. Ink pixels are released separately.
  const p=m.dissolve,gain=card.delta>0;
  g.fillStyle='#fff';g.globalAlpha=1-p;g.fillRect(card.x,card.y,card.w,card.h);g.globalAlpha=1;g.fillStyle='#000';
  for(const bit of this.cards[index].points){
   const wave=(Math.sin(bit.x*.061+bit.y*.085)+1)/2;
   const threshold=.08+bit.seed*.36+wave*.42,breakage=clamp((p-threshold)/.35);
   const visibility=1-smooth(breakage);
   if(visibility<.03||bit.drift>visibility)continue;
   const loose=smooth(breakage),swirl=Math.sin(bit.phase+loose*5+elapsed/2400);
   const dx=loose*(Math.cos(bit.phase)*35+swirl*22);
   const dy=gain?-loose*(28+bit.drift*95):loose*(54-bit.y)*.95;
   const bow=Math.sin(bit.x/182*Math.PI)*Math.sin(elapsed/820)*p*(gain?5:10);
   g.fillRect(Math.round(card.x+bit.x+dx),Math.round(card.y+bit.y+dy+bow),1,1);
  }
 }
 headers(balance,card,m,elapsed,committed,reduced){
  const g=this.g;
  for(const [stat,pos]of Object.entries(slots)){
   g.fillStyle='#fff';g.fillRect(pos.x-46,48,92,108);
   if(this.icons[stat])g.drawImage(this.icons[stat],pos.x-16,54,32,32);
   center(g,this.captions[stat],pos.x,102);
   const sprite=this.num(balance[stat]);
   if(card?.stat===stat&&card.delta<0&&m.strain>0&&!reduced){
    // The total itself deforms, so the debit visibly belongs to it.
    const tension=m.strain,recoil=m.detached?Math.sin(segment(elapsed,3550,4000)*Math.PI*3)*3:0;
    for(let row=0;row<sprite.height;row++){
     const bottom=row/(sprite.height-1),stretch=bottom*bottom*tension*17;
     const shear=bottom*bottom*tension*8+recoil*(1-bottom);
     g.drawImage(sprite,0,row,sprite.width,1,Math.round(pos.x-sprite.width/2+shear),Math.round(pos.y-sprite.height/2+row+stretch),sprite.width,1+Math.ceil(tension*1.8*bottom));
    }
   }else center(g,sprite,pos.x,pos.y);
  }
 }
 tethers(card,m,t){
  if(card.delta>0)return;const g=this.g,source=slots[card.stat];
  if(m.tether){
   g.strokeStyle='#000';g.globalAlpha=.85;
   for(let i=0;i<6;i++){
    const sx=source.x-8+i*4,sy=source.y+9+m.strain*12,ex=m.x-11+i*4,ey=m.y-9;
    const sag=(1-m.strain)*18*Math.sin(i*1.9+t/850);
    g.beginPath();g.moveTo(sx,sy);g.bezierCurveTo(sx+sag,sy+(ey-sy)*.44,ex-sag,ey-(ey-sy)*.2,ex,ey);g.stroke();
    if(i%2===0)g.fillRect(Math.round(mix(sx,ex,.6)),Math.round(mix(sy,ey,.6)),2,2);
   }g.globalAlpha=1;
  }else if(t>=3550&&t<4250){
   const p=segment(t,3550,4250);g.globalAlpha=1-p;
   for(let i=0;i<7;i++){
    const a=i/7*TAU;
    line(g,source.x+15+Math.cos(a)*(8+p*15),source.y+45+Math.sin(a)*(12+p*20),source.x+15+Math.cos(a)*(14+p*27),source.y+45+Math.sin(a)*(18+p*28));
   }g.globalAlpha=1;
  }
 }
 token(card,m,t){
  if(m.opacity<=0)return;const g=this.g,sprite=card.delta>0?this.gain:this.loss;
  // Stippled echoes lag gently behind the number along the actual path.
  for(let i=4;i>=1;i--){
   const past=motion(card,Math.max(0,t-i*(card.delta>0?150:55)));
   if(past.opacity<=0)continue;g.globalAlpha=m.opacity*(.30-i*.045);
   center(g,sprite,past.x,past.y);
  }
  g.globalAlpha=1;const radius=24*m.scale;
  // White cutout protects the number inside the one-bit contour field.
  g.fillStyle='#fff';g.beginPath();g.ellipse(m.x,m.y,radius,17*m.scale,0,0,TAU);g.fill();
  g.save();g.translate(Math.round(m.x),Math.round(m.y));g.scale(m.scale,m.scale);g.globalAlpha=m.opacity;
  for(let row=0;row<sprite.height;row++){
   const drift=card.delta>0?Math.sin(t/1100+row*.12)*1.3:Math.sin(row*.20+t/530)*m.strain*2;
   g.drawImage(sprite,0,row,sprite.width,1,Math.round(-sprite.width/2+drift),row-Math.floor(sprite.height/2),sprite.width,1);
  }
  g.restore();g.globalAlpha=1;
  // Tiny orbiting fragments bind the floating figure to the dissolved ink.
  g.fillStyle='#000';g.globalAlpha=.6*m.opacity;
  for(let i=0;i<11;i++){
   const a=i/11*TAU+t/(card.delta>0?2600:950),r=28+(i%3)*5;
   g.fillRect(Math.round(m.x+Math.cos(a)*r),Math.round(m.y+Math.sin(a)*r*.62),1+(i%4===0?1:0),1);
  }g.globalAlpha=1;
 }
 arrival(card,m,t){
  const start=card.delta>0?7750:6350,p=segment(t,start,start+1100);if(p<=0||p>=1)return;
  const g=this.g,pos=card.delta>0?slots[card.stat]:{x:card.x+91,y:card.y+54};
  g.globalAlpha=(1-p)*.55;g.strokeStyle='#000';
  for(let i=0;i<3;i++){g.beginPath();g.ellipse(pos.x,pos.y,23+p*37+i*8,15+p*22+i*5,0,0,TAU);g.stroke();}
  g.globalAlpha=1;
 }
 monochrome(){
  const d=this.g.getImageData(0,0,W,H),a=d.data;
  // Screen-anchored ordered stipple, never random frame-to-frame noise.
  for(let y=0,i=0;y<H;y++)for(let x=0;x<W;x++,i+=4){const ink=1-a[i]/255;const v=ink>(bayer[(y%4)*4+x%4]+.5)/16?0:255;a[i]=a[i+1]=a[i+2]=v;a[i+3]=255;}
  this.g.putImageData(d,0,0);
 }
}
