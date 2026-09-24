// One CSS pixel per canvas pixel in the phone, web build and display lab.
// Never fit the game to a short desktop window by shrinking its contents.
export const PHONE_FONT = 'Geneva, Helvetica, sans-serif';
export function phoneScreen(viewportWidth, viewportHeight) {
  const available = Math.max(240, Math.floor(viewportWidth || 480));
  const phone = available <= 600;
  const width = phone ? available : 480;
  return {width, height: phone ? Math.max(640, Math.floor(viewportHeight || width * 2)) : width * 2};
}

const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
const seed=value=>[...String(value)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0;

// The preview's portrait cards, shared by choices, palettes and PNG exports.
export function cardLayout(count,width,height,key='',bottom=height-130){
  const columns=count===3?3:Math.min(2,Math.max(1,count)),rows=Math.max(1,Math.ceil(count/columns));
  const k=width/415,gap=Math.round((4+hash(seed(key))*4)*k),margin=Math.round(22*k);
  const w=Math.floor((width-2*margin-gap*(columns-1))/columns);
  let cardWidth=columns===1?Math.floor((width-2*margin-gap)/2):w;
  const h=Math.round(Math.min(cardWidth*252/182,(bottom-Math.max(242,270*k)-(rows-1)*10*k)/rows));
  cardWidth=Math.min(cardWidth,Math.floor(h*182/252));
  const top=bottom-rows*h-(rows-1)*10*k;
  const cards=Array.from({length:count},(_,i)=>({
    x:Math.round((width-(columns*cardWidth+(columns-1)*gap))/2+(i%columns)*(cardWidth+gap)),
    y:Math.round(top+Math.floor(i/columns)*(h+10*k)+(i%2?1:-1)*(3+hash(seed(key)+Math.floor(i/2))*4)*k),
    w:cardWidth,h,flashSeed:seed(`${key}:${i}`),
  }));
  return {w:cardWidth,h,top:Math.min(top,...cards.map(c=>c.y)),cards,cell:i=>cards[i]};
}
