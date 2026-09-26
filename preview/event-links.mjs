// Only choices belonging to the same authored event share a branch. Ordinary
// unrelated activities are never connected merely because they share a screen.
let forkArt=null,loading;
// Related choices share a level baseline; unrelated deals keep their offsets.
export function alignEventCards(cards){
  return cards.map((card,index)=>{
    const pair=cards.slice(index-index%2,index-index%2+2);
    return {...card,y:Math.round(pair.reduce((sum,c)=>sum+c.y,0)/pair.length)};
  });
}
export function decisionProseBounds(rows,measure,fontSize){
  if(!rows.length)return null;
  const x=Math.floor(Math.min(...rows.map(row=>row.x)))-1,y=Math.floor(Math.min(...rows.map(row=>row.y)))-1;
  return {x,y,w:Math.ceil(Math.max(...rows.map(row=>row.x+measure(row.text))))-x+1,
    h:Math.ceil(Math.max(...rows.map(row=>row.y)))+fontSize+6-y};
}
export function loadEventLinkArt() {
  return loading??=new Promise(resolve=>{
    const image=new Image();
    image.onload=()=>{forkArt=image;resolve();};
    image.onerror=()=>resolve();
    image.src=new URL('./art/decision-forks.png',import.meta.url).href;
  });
}

export function drawSuppliedEventLinks(c,cards,{x,y}) {
  if(!cards.length)return;
  // A compact dividing fork, independent of the cards' slight stagger.
  // Draw mirrored pixels so both arms remain identical after the raster pass.
  const centre=Math.round(x),top=Math.round(y);
  const bottom=Math.min(top+144,Math.floor(Math.min(...cards.map(card=>card.y)))-12);
  const height=bottom-top;
  if(height<2)return;
  if(forkArt&&cards.length>1){
    // Draw Roy's original pixels directly. Use his shorter fork in tight gaps,
    // retaining each drawing's proportions and its uneven ink edges.
    const crop=height<90?{x:147,y:50,w:100,h:62,anchor:52}:{x:24,y:43,w:102,h:141,anchor:48};
    const scale=Math.min(1,height/crop.h);
    c.save();c.imageSmoothingEnabled=false;
    const bounds={x:Math.round(centre-crop.anchor*scale),y:top,w:Math.round(crop.w*scale),h:Math.round(crop.h*scale)};
    c.drawImage(forkArt,crop.x,crop.y,crop.w,crop.h,bounds.x,bounds.y,bounds.w,bounds.h);
    c.restore();return bounds;
  }
  const rise=Math.min(52,Math.max(1,Math.round(height*.4))),join=bottom-rise;
  const halfSpan=Math.min(44,Math.round(rise*.85));
  c.save();c.fillStyle='#000';
  c.fillRect(centre,top,1,join-top+1);
  if(cards.length===1)c.fillRect(centre,join,1,rise+1);
  else for(let arm=0;arm<Math.ceil(cards.length/2);arm++){
    const spread=halfSpan*(cards.length-1-2*arm)/(cards.length-1);
    for(let step=0;step<=rise;step++){
      const offset=Math.round(spread*step/rise);
      c.fillRect(centre-offset,join+step,1,1);
      if(offset)c.fillRect(centre+offset,join+step,1,1);
    }
  }
  c.restore();
  return {x:centre-halfSpan-1,y:top,w:halfSpan*2+3,h:height+1};
}

// Earlier thin Double rule, retained for the comparison study.
export function drawDoubleRuleEventLinks(c,cards,{x,y}){
  if(!cards.length)return null;
  x=Math.round(x);y=Math.round(y);
  const bottom=Math.min(y+144,Math.floor(Math.min(...cards.map(card=>card.y)))-12),height=bottom-y;
  if(height<2)return null;
  const join=y+Math.round(height*.4),ends=[...new Set(cards.map(card=>Math.round(card.x+card.w/2)))];
  const line=(x1,y1,x2,y2)=>{
    const length=Math.max(Math.abs(x2-x1),Math.abs(y2-y1));
    for(let i=0;i<=length;i++){const p=length?i/length:0;c.fillRect(Math.round(x1+(x2-x1)*p),Math.round(y1+(y2-y1)*p),1,1);}
  };
  c.save();c.fillStyle='#000';
  for(const offset of [-2,2]){
    line(x+offset,y,x+offset,join);
    for(const end of ends)line(x+offset,join,end+offset,bottom);
  }
  c.restore();const left=Math.min(x,...ends)-4;
  return {x:left,y:y-2,w:Math.max(x,...ends)-left+5,h:height+5};
}

const branchGrain=(x,y,seed)=>{
  let n=Math.imul(x+seed*19,374761393)+Math.imul(y+7,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;
};
function segmentDistance(x,y,a,b){
  const dx=b.x-a.x,dy=b.y-a.y,p=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(x-a.x-p*dx,y-a.y-p*dy);
}
// Roy selected Worn double: the exact fixed one-bit grain from the study.
// Keep the pixels stable as the shared compositor grows the branches.
export function wornBranchPixels(cards,anchor){
  if(!cards.length)return null;
  const x=Math.round(anchor.x),y=Math.round(anchor.y);
  const bottom=Math.min(y+144,Math.floor(Math.min(...cards.map(card=>card.y)))-12),height=bottom-y;
  if(height<2)return null;
  const join=y+Math.round(height*.4),ends=[...new Set(cards.map(card=>Math.round(card.x+card.w/2)))];
  const segments=[];
  for(const offset of [-4,4]){
    const root={x:x+offset,y},junction={x:x+offset,y:join};
    segments.push([root,junction]);for(const end of ends)segments.push([junction,{x:end+offset,y:bottom}]);
  }
  const bounds={x:Math.min(x,...ends)-10,y:y-7,w:Math.max(x,...ends)-Math.min(x,...ends)+21,h:height+15};
  const pixels=new Uint8Array(bounds.w*bounds.h);
  for(let py=0;py<bounds.h;py++)for(let px=0;px<bounds.w;px++){
    const X=bounds.x+px,Y=bounds.y+py,localX=Math.abs(X-x),localY=Y-y;
    const d=Math.min(...segments.map(([a,b])=>segmentDistance(X,Y,a,b)));
    const fleck=branchGrain(localX,localY,3),coarse=branchGrain(Math.floor(localX/3),Math.floor(localY/3),11);
    if(d<.8||d<=1.9&&(fleck>.17||coarse>.7))pixels[py*bounds.w+px]=1;
  }
  return {bounds,pixels};
}
export function drawEventLinks(context,cards,anchor){
  const raster=wornBranchPixels(cards,anchor);if(!raster)return null;
  const {bounds,pixels}=raster;context.save();context.fillStyle='#000';
  for(let i=0;i<pixels.length;i++)if(pixels[i])context.fillRect(bounds.x+i%bounds.w,bounds.y+Math.floor(i/bounds.w),1,1);
  context.restore();return bounds;
}
