// Original recursive white-ink ornament. No DOM, borrowed art, state, or animation.
// The caller may expand x/y/w/h and rim together; that holds the white interior still.
function pixelLine(c,x0,y0,x1,y1){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1;let er=dx+dy;
  for(;;){c.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e2=2*er;if(e2>=dy){er+=dy;x0+=sx;}if(e2<=dx){er+=dx;y0+=sy;}}
}
function branch(c,x,y,len,angle,depth){
  const ex=x+Math.cos(angle)*len,ey=y+Math.sin(angle)*len;pixelLine(c,x,y,ex,ey);
  if(depth>0){branch(c,ex,ey,len*.58,angle-.68,depth-1);branch(c,ex,ey,len*.58,angle+.68,depth-1);}
}
function stepped(c,x,y,w,h){
  c.beginPath();c.moveTo(x+4,y);c.lineTo(x+w-4,y);c.lineTo(x+w-4,y+1);c.lineTo(x+w-2,y+1);c.lineTo(x+w-2,y+3);c.lineTo(x+w,y+3);c.lineTo(x+w,y+h-3);c.lineTo(x+w-2,y+h-3);c.lineTo(x+w-2,y+h-1);c.lineTo(x+w-4,y+h-1);c.lineTo(x+w-4,y+h);c.lineTo(x+4,y+h);c.lineTo(x+4,y+h-1);c.lineTo(x+2,y+h-1);c.lineTo(x+2,y+h-3);c.lineTo(x,y+h-3);c.lineTo(x,y+3);c.lineTo(x+2,y+3);c.lineTo(x+2,y+1);c.lineTo(x+4,y+1);c.closePath();
}
export function drawFernBorder(c,{x=0,y=0,w,h,rim=10}){
  c.save();c.fillStyle='#000';stepped(c,x,y,w,h);c.fill();c.clip();
  const mid=Math.floor((rim-1)/2),lastX=x+w-1-mid,lastY=y+h-1-mid;
  c.fillStyle='#fff';
  const motif=(xx,yy,a)=>{const dx=Math.cos(a),dy=Math.sin(a);branch(c,xx-dx*5,yy-dy*5,5,a,2);branch(c,xx+dx*5,yy+dy*5,5,a+Math.PI,2);};
  // Repeat on all four sides with a full native-pixel rhythm. No scaling of the pattern.
  for(let xx=9;xx<w-9;xx+=19){motif(x+xx,y+mid,0);motif(x+w-1-xx,lastY,Math.PI);}
  for(let yy=15;yy<h-12;yy+=19){motif(lastX,y+yy,Math.PI/2);motif(x+mid,y+h-1-yy,-Math.PI/2);}
  c.fillStyle='#fff';c.fillRect(x+rim,y+rim,w-rim*2,h-rim*2);c.restore();
}
