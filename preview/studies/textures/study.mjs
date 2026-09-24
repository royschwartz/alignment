import {variants} from './variants.mjs';
// This label is Roy's current action label, copied only for the visual study.
const dialog=document.querySelector('#detail');let selected=0;
const options=document.querySelector('#options');
for(const [index,variant] of variants.entries()){
 const button=document.createElement('button');button.className='option';button.setAttribute('aria-label',`Inspect ${String(index+1).padStart(2,'0')} — ${variant.name}`);
 const picture=document.createElement('img');picture.width=170;picture.height=238;picture.alt='watch tv';picture.src=`${String(index+1).padStart(2,'0')}-${variant.id}.png`;button.append(picture);
 const caption=document.createElement('span');caption.className='label';
 const number=document.createElement('span');number.className='number';number.textContent=String(index+1).padStart(2,'0');
 const name=document.createElement('span');name.className='name';name.textContent=variant.name;caption.append(number,name);button.append(caption);
 button.addEventListener('click',()=>{show(index);dialog.showModal();});options.append(button);
}
function show(index){
 selected=(index+variants.length)%variants.length;const v=variants[selected],number=String(selected+1).padStart(2,'0');
 document.querySelector('#detail-title').textContent=`${number} · ${v.name}`;
 document.querySelector('#description').textContent=v.description;
 for(const id of ['large','native'])document.getElementById(id).src=`${number}-${v.id}.png`;
 const download=document.querySelector('#download');download.href=`${number}-${v.id}.png`;download.download=`alignment-card-${number}-${v.id}.png`;
}
document.querySelector('#close').onclick=()=>dialog.close();
document.querySelector('#previous').onclick=()=>show(selected-1);
document.querySelector('#next').onclick=()=>show(selected+1);
dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(selected+(event.key==='ArrowRight'?1:-1));}});
