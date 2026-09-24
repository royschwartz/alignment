// The hand overlaps the card animation; it never adds a delay before it.
export const SELECTION_HOLD_MS = 650;

export function selectionHandBox(image,card,width,height,point) {
  const w=Math.min(image.width,card.w*.65)*.8,h=w*image.height/image.width;
  // The earlier sprite sat down/right of the pointer. Move its anchor 20% of
  // the sprite up and left; the click now lands in the broad centre of its palm.
  const anchor=point||{x:card.x+card.w/2,y:card.y+card.h/2};
  return {x:Math.max(2,Math.min(width-w-2,anchor.x-w*.7)),y:Math.max(174,Math.min(height-h-2,anchor.y-h*.7)),w,h};
}
export function drawSelectionHand(context,image,card,width,height,elapsed,point) {
  if(!card||!image||elapsed>=SELECTION_HOLD_MS)return;
  const {x,y,w,h}=selectionHandBox(image,card,width,height,point);
  context.imageSmoothingEnabled=false;
  context.drawImage(image,Math.round(x),Math.round(y),Math.round(w),Math.round(h));
}
