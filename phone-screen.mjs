// One CSS pixel per canvas pixel in the phone, web build and display lab.
// Never fit the game to a short desktop window by shrinking its contents.
export const PHONE_FONT = 'Geneva, Helvetica, sans-serif';
// Geneva's synthesized bold disappears in the one-bit raster pass on macOS.
// Use Helvetica's real bold face for passages marked bold by the author.
export const PHONE_BOLD_FONT = 'Helvetica, Arial, sans-serif';
// Reading area below the attribute divider; header labels keep their own sizes.
export const GAME_TEXT=Object.freeze({story:20,body:17,small:14,headerLabel:10,headerChange:13,title:22,titleNarrow:20});
// Lower the dealt cards without changing their dimensions or spacing.
export const CHOICE_CARD_DROP=30;
export function phoneScreen(viewportWidth, viewportHeight) {
  const available = Math.max(240, Math.floor(viewportWidth || 480));
  const phone = available <= 600;
  const width = phone ? available : 480;
  return {width, height: phone ? Math.max(640, Math.floor(viewportHeight || width * 2)) : width * 2};
}

const hash=n=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
const seed=value=>[...String(value)].reduce((n,c)=>Math.imul(n^c.charCodeAt(0),16777619),2166136261)>>>0;

// Picture cards retain their portrait format. Text-only cards keep that width
// with a square face, shared by choices, palettes and PNG exports.
export function cardLayout(count,width,height,key='',bottom=height-130,{textOnly=false,minHeight=0}={}){
  count=Math.min(4,Math.max(0,Math.floor(count)));
  const columns=Math.min(2,Math.max(1,count)),rows=Math.max(1,Math.ceil(count/2));
  const k=width/415,gap=Math.round(22*k),margin=Math.round(22*k),offset=Math.ceil(7*k);
  // Reserve a complete two-by-two deal when choosing the size. Neither the
  // number of choices, the random seed nor the screen's footer can resize it.
  const maxWidth=Math.floor((width-2*margin-gap)/2);
  const maxHeight=Math.floor((height-130-Math.max(242,270*k)-gap-2*offset)/2);
  const cardWidth=Math.min(maxWidth,Math.floor(maxHeight*182/252)),h=textOnly?Math.max(cardWidth,minHeight):Math.round(cardWidth*252/182);
  const top=bottom-rows*h-(rows-1)*gap-offset;
  const cards=Array.from({length:count},(_,i)=>({
    x:Math.round((width-(columns*cardWidth+(columns-1)*gap))/2+(i%columns)*(cardWidth+gap)),
    // Keep the rows almost level, with only a trace of the original stagger.
    y:Math.round(top+Math.floor(i/columns)*(h+gap)+(i%2?1:-1)*(.5+hash(seed(key)+Math.floor(i/2))*.5)*k),
    w:cardWidth,h,flashSeed:seed(`${key}:${i}`),
  }));
  return {w:cardWidth,h,top:Math.min(top,...cards.map(c=>c.y)),cards,cell:i=>cards[i]};
}
