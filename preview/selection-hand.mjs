// The hand overlaps the card animation; it never adds a delay before it.
export const SELECTION_HOLD_MS = 650;

export function drawSelectionHand(context,image,card,width,height,elapsed) {
  if(!card||!image||elapsed>=SELECTION_HOLD_MS)return;
  const w=Math.min(image.width,card.w*.65),h=w*image.height/image.width;
  const x=Math.max(8,Math.min(width-w-8,card.x+card.w*.6-w/2));
  const y=Math.max(178,Math.min(height-h-12,card.y+card.h*.62-h/2));
  context.imageSmoothingEnabled=false;
  context.drawImage(image,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
