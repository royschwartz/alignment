// Original procedural card artwork for Roy's display lab. No borrowed card art.
import {wrapText,placeText} from './text-layout.mjs';
import {drawFernBorder} from './studies/fern-border.mjs';
const photos=new Map(),rasters=new Map();
export let photoSources={};
export async function loadCardPhotos(){
  try{photoSources=await (await fetch(new URL('./art/photos/manifest.json',import.meta.url))).json();}catch{return;}
  await Promise.all(Object.entries(photoSources).map(([id,source])=>new Promise(resolve=>{
    const image=new Image();image.onload=()=>{photos.set(id,image);resolve();};image.onerror=resolve;image.src=new URL(source.file,import.meta.url);
  })));
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const hash=id=>{let h=2166136261;for(const ch of id)h=Math.imul(h^ch.charCodeAt(0),16777619);return h>>>0;};
function photoRaster(id,w,h,mode){
  const key=`${id}:${w}:${h}:${mode}`;if(rasters.has(key))return rasters.get(key);
  const image=photos.get(id);if(!image)return null;
  const can=document.createElement('canvas');can.width=w;can.height=h;
  const c=can.getContext('2d',{willReadFrequently:true}),crop=photoSources[id]?.crop||[0,0,1,1];
  const [cx,cy,cw,ch]=crop,sw=image.width*cw,sh=image.height*ch,k=Math.max(w/sw,h/sh);
  c.drawImage(image,image.width*cx+(sw-w/k)/2,image.height*cy+(sh-h/k)/2,w/k,h/k,0,0,w,h);
  const data=c.getImageData(0,0,w,h),values=new Float32Array(w*h),hist=new Array(256).fill(0);
  for(let i=0;i<values.length;i++){const v=Math.round(.299*data.data[i*4]+.587*data.data[i*4+1]+.114*data.data[i*4+2]);values[i]=v;hist[v]++;}
  // A small tonal stretch keeps the old scans readable at native card resolution.
  const percentile=p=>{let n=0;for(let i=0;i<256;i++){n+=hist[i];if(n>=values.length*p)return i;}return 255;};
  const lo=percentile(.015),hi=Math.max(lo+40,percentile(.985));
  for(let i=0;i<values.length;i++)values[i]=255*Math.pow(clamp((values[i]-lo)/(hi-lo),0,1),.92);
  const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x,v=values[i];let q;
    if(mode==='gray')q=Math.round(clamp(v,0,255)/17)*17;
    else if(mode==='ordered')q=v>(bayer[(y%4)*4+x%4]+.5)*16?255:0;
    else{
      q=v>=128?255:0;const e=(v-q)/8;
      // Atkinson's compact six-neighbour diffusion, calculated at final pixel size.
      for(const [dx,dy] of [[1,0],[2,0],[-1,1],[0,1],[1,1],[0,2]])if(x+dx>=0&&x+dx<w&&y+dy<h)values[(y+dy)*w+x+dx]+=e;
    }
    data.data[i*4]=data.data[i*4+1]=data.data[i*4+2]=q;data.data[i*4+3]=255;
  }
  c.putImageData(data,0,0);rasters.set(key,can);return can;
}
// Stepped corners: deliberately raster geometry, without shaded or bevelled edges.
function outline(c,x,y,w,h){
  c.beginPath();c.moveTo(x+4,y);c.lineTo(x+w-4,y);c.lineTo(x+w-4,y+1);c.lineTo(x+w-2,y+1);c.lineTo(x+w-2,y+3);c.lineTo(x+w,y+3);c.lineTo(x+w,y+h-3);c.lineTo(x+w-2,y+h-3);c.lineTo(x+w-2,y+h-1);c.lineTo(x+w-4,y+h-1);c.lineTo(x+w-4,y+h);c.lineTo(x+4,y+h);c.lineTo(x+4,y+h-1);c.lineTo(x+2,y+h-1);c.lineTo(x+2,y+h-3);c.lineTo(x,y+h-3);c.lineTo(x,y+3);c.lineTo(x+2,y+3);c.lineTo(x+2,y+1);c.lineTo(x+4,y+1);c.closePath();
}
function branch(c,x,y,len,dir,depth){
  if(depth<0||len<1)return;
  const dirs=[[1,0],[0,1],[-1,0],[0,-1]], [dx,dy]=dirs[(dir+4)%4];
  c.fillRect(Math.round(x),Math.round(y),dx?Math.max(1,Math.round(len)):1,dy?Math.max(1,Math.round(len)):1);
  // Draw signed branches with explicit endpoints to keep the lattice symmetrical.
  c.beginPath();c.moveTo(Math.round(x)+.5,Math.round(y)+.5);c.lineTo(Math.round(x+dx*len)+.5,Math.round(y+dy*len)+.5);c.stroke();
  if(depth){branch(c,x+dx*len,y+dy*len,len*.5,(dir+1)%4,depth-1);branch(c,x+dx*len,y+dy*len,len*.5,(dir+3)%4,depth-1);}
}
function ornament(c,x,y,w,h,rim,style,id){
  c.save();outline(c,x,y,w,h);c.clip();
  c.strokeStyle=c.fillStyle='#fff';c.lineWidth=1;
  const seed=hash(id),step=style==='maze'?12:16;
  const motif=(px,py,vertical)=>{
    c.save();c.translate(Math.round(px),Math.round(py));if(vertical)c.rotate(Math.PI/2);
    if(style==='plain'){c.fillRect(-3,0,7,1);c.fillRect(0,-2,1,5);}
    else if(style==='maze'){
      c.beginPath();c.moveTo(-5,2);c.lineTo(-5,-2);c.lineTo(4,-2);c.lineTo(4,2);c.lineTo(-1,2);c.lineTo(-1,0);c.stroke();
    }else{
      c.beginPath();c.moveTo(-6,.5);c.lineTo(6,.5);c.stroke();
      for(const side of [-1,1])for(const xx of [-4,0,4]){
        const len=xx===0?3:2;c.beginPath();c.moveTo(xx,.5);c.lineTo(xx+side*len,side*len+.5);c.stroke();
        c.fillRect(xx+side*len-1,side*len,1,1);
      }
    }
    c.restore();
  };
  const y1=y+Math.floor(rim/2),y2=y+h-Math.ceil(rim/2);
  for(let px=x+rim+6;px<x+w-rim;px+=step){motif(px,y1,false);motif(px,y2,false);}
  for(let py=y+rim+5;py<y+h-rim;py+=step){motif(x+Math.floor(rim/2),py,true);motif(x+w-Math.ceil(rim/2),py,true);}
  for(const [cx,cy] of [[x+5,y+5],[x+w-6,y+5],[x+5,y+h-6],[x+w-6,y+h-6]]){
    c.fillRect(cx-2,cy,5,1);c.fillRect(cx,cy-2,1,5);if(seed%2)c.fillRect(cx-1,cy-1,3,3);
  }
  c.restore();
}
// Negative ink: two twisted white filaments and barbs occupy the entire dark rim.
function whiteWire(c,x,y,w,h,rim,level){
  c.save();c.strokeStyle='#fff';c.fillStyle='#fff';c.lineWidth=1;
  const inset=rim/2,ww=w-rim,hh=h-rim,total=2*(ww+hh);
  const point=s=>{s=((s%total)+total)%total;if(s<ww)return[x+inset+s,y+inset,0];s-=ww;if(s<hh)return[x+w-inset,y+inset+s,1];s-=hh;if(s<ww)return[x+w-inset-s,y+h-inset,2];s-=ww;return[x+inset,y+h-inset-s,3];};
  const at=(s,offset=0)=>{const [px,py,d]=point(s),nx=[0,1,0,-1][d],ny=[-1,0,1,0][d];return[px+nx*offset,py+ny*offset];};
  for(const phase of [0,Math.PI])for(let s=0;s<=total;s++){
    const [px,py]=at(s,.9*Math.sin(s/3+phase));c.fillRect(Math.round(px),Math.round(py),1,1);
  }
  const len=rim<9?3:4;
  for(let s=8;s<total;s+=[28,20,14][clamp(level,1,3)-1]){
    const [px,py,d]=point(s),co=[1,0,-1,0][d],si=[0,1,0,-1][d];
    const dot=(u,v)=>c.fillRect(Math.round(px+u*co-v*si),Math.round(py+u*si+v*co),1,1);
    for(let n=-len;n<=len;n++){dot(n,n);dot(n,-n);}
    dot(-len+1,-len);dot(-len+2,-len);dot(len-1,len);dot(len-2,len);
  }
  c.restore();
}
export function drawPhotoBack(c,{x=0,y=0,w,h,border='fern',id='deck'}){
  c.save();c.fillStyle='#000';outline(c,x,y,w,h);c.fill();
  ornament(c,x,y,w,h,9,border,id);c.fillStyle='#fff';c.fillRect(x+10,y+10,w-20,h-20);
  c.fillStyle='#000';for(let yy=12;yy<h-12;yy++)for(let xx=12;xx<w-12;xx++)if(((xx&yy)&7)===0)c.fillRect(x+xx,y+yy,1,1);
  c.strokeStyle='#000';c.strokeRect(x+9.5,y+9.5,w-19,h-19);c.restore();
}
export function drawPhotoCard(c,{x=0,y=0,w,h,id,label='',pain=false,need=false,level=1,t=0,since=0,reduceMotion=false,photoMode='atkinson',border='fern',textLayout={},faceDown=false}){
  if(faceDown){drawPhotoBack(c,{x,y,w,h,border,id});return;}
  const baseRim=w<110?8:10,breath=need?(reduceMotion?1:Math.round(1.5-1.5*Math.cos((t-since)*Math.PI*2/3800))):0;
  const rim=baseRim+breath,outerX=x-breath,outerY=y-breath,ow=w+2*breath,oh=h+2*breath;
  c.save();c.fillStyle='#000';outline(c,outerX,outerY,ow,oh);c.fill();
  if(pain)whiteWire(c,outerX,outerY,ow,oh,rim,level);else if(border==='fern')drawFernBorder(c,{x:outerX,y:outerY,w:ow,h:oh,rim});else ornament(c,outerX,outerY,ow,oh,rim,border,id);
  const ix=x+baseRim,iy=y+baseRim,iw=w-baseRim*2,ih=h-baseRim*2,split=Math.round(y+h/2),ph=split-iy;
  c.fillStyle='#fff';c.fillRect(ix,iy,iw,ih);
  const photo=photoRaster(id,iw,ph,photoMode);
  c.imageSmoothingEnabled=false;if(photo){c.drawImage(photo,ix,iy);if(photoMode==='gray'){
    const tr=c.getTransform();(c.photoAreas??=[]).push({x:tr.a*ix+tr.e,y:tr.d*iy+tr.f,w:tr.a*iw,h:tr.d*ph});
  }}
  c.fillStyle='#000';c.fillRect(ix,split,iw,1);
  // A clear lower half for Roy's exact action label, with preserved explicit lines.
  const size=w<115?11:13,leading=size+5;
  c.font=`${size}px monospace`;c.textBaseline='top';c.textAlign='left';
  const measure=v=>c.measureText(v).width,rows=wrapText(label,iw-12,measure),bottom=y+h-baseRim;
  const placed=placeText(rows,{measure,bounds:{x:ix+6,y:split+7,w:iw-12,h:bottom-split-14},leading,fontSize:size,
    top:split+(bottom-split-rows.length*leading)/2+2,layout:{align:'center',...textLayout},autoCenter:rows.length===1,scaleWidth:w,scaleHeight:h});
  for(const row of placed)c.fillText(row.text,Math.round(row.x),Math.round(row.y));
  c.strokeStyle='#fff';c.lineWidth=1;c.strokeRect(ix-1.5,iy-1.5,iw+3,ih+3);
  c.restore();
}
