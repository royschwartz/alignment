// Only choices belonging to the same authored event share a branch. Ordinary
// unrelated activities are never connected merely because they share a screen.
export function drawEventLinks(c,cards,{x,y}) {
  if(!cards.length)return;
  c.save();c.strokeStyle='#000';c.fillStyle='#fff';c.lineWidth=1;
  for(const card of cards){
    const endX=card.x+card.w/2,endY=card.y,branchY=endY-10;
    c.beginPath();c.moveTo(x,y);c.lineTo(x,branchY);c.lineTo(endX,branchY);c.lineTo(endX,endY);c.stroke();
    c.fillRect(Math.round(endX)-2,Math.round(endY)-2,5,4);
    c.strokeRect(Math.round(endX)-2.5,Math.round(endY)-2.5,5,5);
  }
  c.beginPath();c.arc(x,y,3,0,Math.PI*2);c.fill();c.stroke();c.restore();
}
