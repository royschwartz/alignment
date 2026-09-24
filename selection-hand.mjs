// A still selection cue: keep the chosen card visible under the hand, then
// begin the existing transition. Presentation time never advances game time.
export const SELECTION_HOLD_MS = 650;

export function holdSelectionHand({paint,from,context,image,card,width,height,isCurrent}) {
  if(!card||!image)return Promise.resolve();
  const w=Math.min(image.width,card.w*.65),h=w*image.height/image.width;
  const x=Math.max(8,Math.min(width-w-8,card.x+card.w*.6-w/2));
  const y=Math.max(178,Math.min(height-h-12,card.y+card.h*.62-h/2));
  return new Promise(resolve=>{
    const start=performance.now();
    const tick=now=>{
      if(!isCurrent()||now-start>=SELECTION_HOLD_MS){resolve();return;}
      paint(from);
      context.imageSmoothingEnabled=false;
      context.drawImage(image,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
      requestAnimationFrame(tick);
    };
    tick(start);
  });
}
