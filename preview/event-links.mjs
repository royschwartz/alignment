// Only choices belonging to the same authored event share a branch. Ordinary
// unrelated activities are never connected merely because they share a screen.
export function drawEventLinks(c,cards,{x,y}) {
  if(!cards.length)return;
  // A compact dividing fork, independent of the cards' slight stagger.
  // Draw mirrored pixels so both arms remain identical after the raster pass.
  const centre=Math.round(x),top=Math.round(y);
  const bottom=Math.min(top+144,Math.floor(Math.min(...cards.map(card=>card.y)))-12);
  const height=bottom-top;
  if(height<2)return;
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
}
