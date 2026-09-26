const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export const proseMargin=width=>Math.round(width/16);

// Explicit line breaks retain their identity when a narrower screen wraps the text.
export function wrapText(value,maxWidth,measure) {
  const rows=[];
  for(const [line,paragraph] of value.split('\n').entries()) {
    let row='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(row&&measure(`${row} ${word}`)>maxWidth){rows.push({text:row,line});row='';}
      if(measure(word)>maxWidth) {
        if(row){rows.push({text:row,line});row='';}
        for(const character of word){if(row&&measure(row+character)>maxWidth){rows.push({text:row,line});row='';}row+=character;}
      } else row=row?`${row} ${word}`:word;
    }
    rows.push({text:row,line});
  }
  return rows;
}

export function placeText(rows,{measure,bounds,leading,fontSize,top=bounds.y,layout={},autoCenter=false,scaleWidth=bounds.w,scaleHeight=bounds.h}) {
  if(!rows.length)return [];
  const resolve=align=>!align||align==='auto'?(autoCenter?'center':'block'):align;
  const blockWidth=Math.max(...rows.map(row=>measure(row.text)));
  let rowY=top;
  const positioned=rows.map((row,index)=>{
    const lineAlign=layout.lines?.[row.line]?.align;
    const width=measure(row.text),align=resolve(lineAlign&&lineAlign!=='auto'?lineAlign:layout.align);
    const y=rowY;rowY+=row.height??leading;
    return {...row,width,x:bounds.x+(align==='center'?(bounds.w-width)/2:align==='block'?(bounds.w-blockWidth)/2:align==='right'?bounds.w-width:0),y};
  });
  const shift=(items,x,y)=>{
    const ink=items.filter(row=>row.text);
    const visible=ink.length?ink:items;
    const left=Math.min(...visible.map(r=>r.x)),right=Math.max(...visible.map(r=>r.x+r.width));
    const upper=Math.min(...items.map(r=>r.y)),lower=Math.max(...items.map(r=>r.y+fontSize));
    const dx=clamp(x/100*scaleWidth,bounds.x-left,bounds.x+bounds.w-right);
    const dy=clamp(y/100*scaleHeight,bounds.y-upper,bounds.y+bounds.h-lower);
    for(const row of items){row.x+=dx;row.y+=dy;}
  };
  shift(positioned,layout.x||0,layout.y||0);
  for(const line of new Set(rows.map(row=>row.line))) {
    const offset=layout.lines?.[line];if(offset)shift(positioned.filter(row=>row.line===line),offset.x||0,offset.y||0);
  }
  return positioned;
}
