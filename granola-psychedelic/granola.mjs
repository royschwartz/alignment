import {choices,motion} from './granola-motion.mjs';
import {GranolaRenderer} from './granola-render.mjs?v=20260926-2';

const $=s=>document.querySelector(s),buttons=[...document.querySelectorAll('[data-choice]')];
const status=$('#status'),replay=$('#replay'),pause=$('#pause'),reduce=$('#reduce');
const media=matchMedia('(prefers-reduced-motion: reduce)');reduce.checked=media.matches;
// Frozen, approved passage and demo balances; independent of the game and editor.
const {prose,initial}=await fetch('./demo-content.json').then(r=>{if(!r.ok)throw Error('Could not load the demo.');return r.json();}).catch(error=>{status.textContent=error.message;throw error;});
const loadImage=src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;});
const [rapture,disquiet]=await Promise.all([loadImage('./icons/heart.png'),loadImage('./icons/friend.png')]);
const renderer=new GranolaRenderer($('canvas'),prose,{rapture,disquiet});
let selected=-1,committed=false,balance={...initial},time=0,start=0,paused=false,busy=true,last=performance.now(),frame=0;
$('#prose').textContent=prose;
const announceTotals=()=>{$('#totals').textContent=`Rapture ${balance.rapture}. Disquiet ${balance.disquiet}.`;};
function syncButtons(){buttons.forEach(b=>b.disabled=busy||selected>=0||paused);}
function commit(card){if(committed)return;committed=true;balance[card.stat]+=card.delta;announceTotals();status.textContent=`${card.stat} ${balance[card.stat]}.`;}
function paint(){
 const elapsed=time-start,card=choices[selected],m=card?motion(card,elapsed,reduce.checked):null;
 if(card&&m.arrived)commit(card);
 busy=card?!m.done:!reduce.checked&&elapsed<1350;
 syncButtons();renderer.draw({time,elapsed,selected,reduced:reduce.checked,balance,committed});
 // A read-only snapshot makes visual verification possible without touching saves.
 window.granolaState={selected,busy,paused,committed,balance:{...balance},elapsed,phase:m?.phase??(busy?'dealing':'ready'),reduced:reduce.checked,prose};
 $('#stage').dataset.phase=window.granolaState.phase;
 $('#stage').dataset.paused=String(paused);
}
function tick(now){
 const delta=Math.min(80,Math.max(0,now-last));last=now;
 if(!paused&&!document.hidden)time+=delta;
 if(!paused&&!document.hidden)paint();
 frame=requestAnimationFrame(tick);
}
function reset(){selected=-1;committed=false;balance={...initial};start=time;busy=!reduce.checked;paused=false;pause.textContent='Pause';pause.setAttribute('aria-pressed','false');status.textContent='';announceTotals();paint();}
buttons.forEach((b,i)=>b.addEventListener('click',()=>{if(busy||selected>=0||paused)return;selected=i;start=time;busy=true;status.textContent='';paint();}));
replay.addEventListener('click',reset);
pause.addEventListener('click',()=>{paused=!paused;pause.textContent=paused?'Resume':'Pause';pause.setAttribute('aria-pressed',String(paused));paint();});
reduce.addEventListener('change',()=>{reset();});
media.addEventListener('change',e=>{reduce.checked=e.matches;reset();});
document.addEventListener('visibilitychange',()=>{last=performance.now();});
window.addEventListener('pagehide',()=>cancelAnimationFrame(frame));
window.addEventListener('pageshow',e=>{if(e.persisted){last=performance.now();frame=requestAnimationFrame(tick);}});
window.granolaSnapshot=()=>structuredClone(window.granolaState);
replay.disabled=false;pause.disabled=false;reset();frame=requestAnimationFrame(tick);
