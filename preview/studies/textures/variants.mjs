// Original, deterministic one-bit card studies. No game state or writing changes.
export const CARD_WIDTH=170,CARD_HEIGHT=238;
export const variants=[
 {id:'inner-fade',name:'Inner fade',description:'A solid black edge softens into fine ordered dots.'},
 {id:'ink-grain',name:'Ink grain',description:'Fine paper flecks in a dense black frame.'},
 {id:'halftone',name:'Halftone',description:'Round printed dots held between solid black rails.'},
 {id:'woven',name:'Woven',description:'Small interlocking diagonals, with black corners.'},
 {id:'vertical-cuts',name:'Vertical cuts',description:'Broken vertical scratches through thick black ink.'},
 {id:'scan-lines',name:'Scan lines',description:'Horizontal white hairlines inside a solid outline.'},
 {id:'worn-ink',name:'Worn ink',description:'Uneven photocopied edges and a little paper grain.'},
 {id:'etched-waves',name:'Etched waves',description:'Fine winding lines cut into a heavy black frame.'},
 {id:'pixel-tiles',name:'Pixel tiles',description:'A broken mosaic of small square marks.'},
 {id:'paper-shadow',name:'Paper shadow',description:'A solid black frame with a dithered shadow inside.'},
];
const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
const noise=(x,y,seed=0)=>{let n=Math.imul(x+seed*73,374761393)+Math.imul(y+19,668265263);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
const ordered=(x,y,coverage)=>bayer[(y&3)*4+(x&3)]/16<coverage;

export function texturePixels(id){
 const w=CARD_WIDTH,h=CARD_HEIGHT,top=6,rim=14,pixels=new Uint8Array(w*h);
 const set=(x,y)=>{if(x>=0&&x<w&&y>=0&&y<h)pixels[y*w+x]=1;};
 // The same stacked top edges and the same outer dimensions in every option.
 for(let layer=0;layer<3;layer++){
  const inset=6-layer*2,y=layer*2;
  for(let x=inset;x<w-inset;x++)set(x,y);
  set(inset,y+1);set(inset,y+2);
 }
 for(let y=top;y<h;y++)for(let x=0;x<w;x++){
  const dx=Math.min(x,w-1-x),dy=Math.min(y-top,h-1-y),edge=Math.min(dx,dy),frame=edge<rim;
  const corner=dx<18&&dy<18,r=noise(x,y,29);
  let black=frame;
  if(frame&&edge>=3&&!corner){
   switch(id){
    case 'inner-fade':black=edge<5||ordered(x,y,(rim-edge)/(rim-5));break;
    case 'ink-grain':black=edge<5||r>.18;break;
    case 'halftone':black=edge>=rim-2||((x%5)-2)**2+((y%5)-2)**2<=3.4;break;
    case 'woven':black=edge>=rim-2||(x+y)%6<2||((x-y+600)%6)<2;break;
    case 'vertical-cuts':black=edge>=rim-2||x%4!==1||noise(x,Math.floor(y/7),18)>.68;break;
    case 'scan-lines':black=edge>=rim-2||y%3!==1;break;
    case 'worn-ink':{
     const erosion=noise(Math.floor(x/3),Math.floor(y/3),4)*2.8+noise(x,y,8)*1.8;
     black=edge<rim-erosion&&(r>.065||edge<5);break;
    }
    case 'etched-waves':black=edge>=rim-2||Math.floor(x*.32+y*.16+2.2*Math.sin(y*.09)+1.5*Math.sin(x*.12))%5!==0;break;
    case 'pixel-tiles':black=edge>=rim-2||noise(Math.floor(x/2),Math.floor(y/2),41)>.38;break;
   }
  }else if(!frame){
   const inside=edge-rim;
   if(id==='worn-ink')black=inside<7&&r<.07*(1-inside/7)&&noise(Math.floor(x/4),Math.floor(y/4),9)>.4;
   if(id==='paper-shadow'){
    const right=w-1-rim-x,bottom=h-1-rim-y;
    const shade=Math.max(0,1-right/16,1-bottom/16)*.48;
    black=ordered(x,y,shade);
   }
  }
  if(black)set(x,y);
 }
 return pixels;
}
export function pixelPath(id){
 const data=texturePixels(id),commands=[];
 for(let y=0;y<CARD_HEIGHT;y++)for(let x=0;x<CARD_WIDTH;){
  if(!data[y*CARD_WIDTH+x]){x++;continue;}
  const start=x;while(x<CARD_WIDTH&&data[y*CARD_WIDTH+x])x++;
  commands.push(`M${start} ${y}h${x-start}v1h-${x-start}z`);
 }
 return commands.join('');
}
export function drawCard(canvas,id,label){
 canvas.width=CARD_WIDTH;canvas.height=CARD_HEIGHT;
 const c=canvas.getContext('2d'),source=texturePixels(id),image=c.createImageData(CARD_WIDTH,CARD_HEIGHT);
 source.forEach((black,i)=>{const v=black?0:255;image.data.set([v,v,v,255],i*4);});
 c.putImageData(image,0,0);c.fillStyle='#000';c.textAlign='center';c.textBaseline='middle';
 c.font='13px Geneva, Helvetica, sans-serif';c.fillText(label,CARD_WIDTH/2,122);
 // Keep lettering and texture at the game's one-bit pixel treatment.
 const final=c.getImageData(0,0,CARD_WIDTH,CARD_HEIGHT);
 for(let i=0;i<final.data.length;i+=4){const v=final.data[i]<160?0:255;final.data[i]=final.data[i+1]=final.data[i+2]=v;}
 c.putImageData(final,0,0);
}
