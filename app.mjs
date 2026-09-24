import { INTRO, ACTIONS, LOGS, MESSAGES, MESSAGE_LINKS, STAT_LABELS, UI, TEXT_LAYOUTS, HUNGER_INDICATOR, applyDocument } from './author-content.mjs';
import { createGame, choose, currentNode, availableActions, visibleActions, restoreGame, serializeGame, reconcileGame, previewIntertitle, currentWarning, raptureCost, SAVE_KEY } from './author-core.mjs?v=1.4.5';
import { cardChoices } from './author-schema.mjs?v=1.4.5';
import { composeFrame, monochrome } from './effects.mjs';
import { StackAudio } from './audio.mjs';
import {CardAudio} from './card-audio.mjs?v=1.4.5';
import {wrapText,placeText,proseMargin} from './text-layout.mjs';
import {STAT_ICONS,headerStatX,signedChange} from './game-stats.mjs';
import {logEntries,statusEntry,eventChanges,logPages} from './stat-log.mjs?v=1.4.5';
import {gameClock} from './story-clock.mjs?v=1.4.5';
import {hungerTrend,tintHungerNumber} from './hunger-indicator.mjs';
import {presentedStats,attributeFeedback,headerChangeAmounts} from './attribute-feedback.mjs?v=1.4.5';
import {phoneScreen,PHONE_FONT} from './phone-screen.mjs?v=1.4.5';
import {drawChoiceCard} from './card-treatments.mjs?v=1.4.5';
import {drawEventLinks} from './event-links.mjs?v=1.4.5';
import {CardTransition,playCardTransition,cardLayout,transferCards,FORMAT_MS} from './card-presentation.mjs?v=1.4.5';

// Preserve the existing black-and-white canvas and HyperCard dissolve treatment.
// All narrative comes from the author's script; this file only handles presentation.
const $ = id => document.getElementById(id);
const canvas = $('card'), ctx = canvas.getContext('2d', { willReadFrequently: true });
// Attribute/story audio stays paused; card handling has its own sound control.
const audio = new StackAudio({bank:'silent'}), cardAudio=new CardAudio(), icons = {};
let storage;
try { const memory=new Map();storage=new URLSearchParams(location.search).has('test')?{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)}:window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error('Storage unavailable'); } }; }
let prefs;
try { prefs = JSON.parse(storage.getItem('alignment.preferences')) || {}; } catch { prefs = {}; }
prefs = { sound: false, cardSound:prefs.cardSound!==false, reduceMotion: prefs.reduceMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches };
audio.enabled = prefs.sound;cardAudio.enabled=prefs.cardSound;
let state, width, height, pixels, layout, busy = false, animationId = 0, saveFailed = false;
let heldStats=null,choiceSources={},lastChoiceSource=null;
const statCues=new Map();let statCueTimer=null;
function stopStatCue(){clearInterval(statCueTimer);statCueTimer=null;statCues.clear();audio.cancelCues();}
function startAttributeFeedback(before,after){
  const now=performance.now(),feedback=attributeFeedback(before,after,HUNGER_INDICATOR);
  for(const change of feedback)statCues.set(change.stat,{...change,start:now,revealStart:now,end:now+1200});
  if(!feedback.length)return;
  statCueTimer=setInterval(()=>{
    if(busy)return;
    for(const [stat,cue] of statCues)if(performance.now()>=cue.end)statCues.delete(stat);
    if(!statCues.size){clearInterval(statCueTimer);statCueTimer=null;}
    const frame=draw();pixels=frame.pixels;paint(pixels);
  },40);
}
let screen = 'main';
let editorPreview = null, testBackup = null, actionPage = 0, textPage = 0, logPage = 0, editor = null, lastViewportWidth = 0;
const STORY_FONT = 16, BODY_FONT = 13, SMALL_FONT = 10;
const CHOICES_PER_PAGE=4;
// Every screen uses the preview's portrait-card format at native text size.
function choiceSize(){const grid=cardLayout(2,width,height);return {w:grid.w,h:grid.h};}
function choiceGrid(count,bottom=height-94){
  return cardLayout(Math.min(count,CHOICES_PER_PAGE),width,height,`${state?.randomSeed}:${state?.events.length}:${state?.node}`,bottom);
}
const save = () => {
  if (testBackup) return;
  try { storage.setItem(SAVE_KEY, serializeGame(state)); saveFailed = false; } catch { saveFailed = true; }
  $('save-status').textContent = saveFailed ? UI.saveFailed : UI.saved;
};
function savePrefs() {
  try { const previous = JSON.parse(storage.getItem('alignment.preferences')) || {}; storage.setItem('alignment.preferences', JSON.stringify({ ...previous, ...prefs })); } catch {}
}
function font(c, size, bold = false, italic = false) {
  c.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${PHONE_FONT}`;
  c.textBaseline = 'top'; c.fillStyle = '#000';
}
function text(c, value, x, y, size = BODY_FONT, { bold = false, italic = false, center = false } = {}) {
  font(c, size, bold, italic); c.textAlign = center ? 'center' : 'left';
  c.fillText(value, Math.round(x), Math.round(y));
}
function box(c, x, y, w, h) {
  c.fillStyle = '#fff'; c.fillRect(x, y, w, h); c.strokeStyle = '#000'; c.lineWidth = 1;
  c.strokeRect(x + .5, y + .5, w - 1, h - 1);
}
function rule(c, y) { c.fillStyle = '#000'; c.fillRect(1, y, width - 2, 1); }
function control(out, label, x, y, w, h, action, available = true) {
  out.buttons.push({ label, x, y, w, h, action, available });
}
function quiet(c, out, label, x, y, w, h, action, accessible = label) {
  text(c, label, x + w / 2, y + (h - SMALL_FONT) / 2, SMALL_FONT, { center: true });
  control(out, accessible, x, y, w, h, action);
}
function button(c, out, label, x, y, w, h, action, { primary = false, available = true, textLayout=null, card=false } = {}) {
  if(card){
    drawChoiceCard(c,{x,y,w,h,label,textLayout,available,id:action,fontFamily:PHONE_FONT,bold:false,reduceMotion:prefs.reduceMotion});
    control(out,label,x,y,w,h,action,available);
    out.cards?.push({action,x,y,w,h});return;
  }
  box(c, x, y, w, h);
  if (primary) c.strokeRect(x + 3.5, y + 3.5, w - 7, h - 7);
  font(c,BODY_FONT,!card);const measure=value=>c.measureText(value).width;
  const rows = wrapText(label,w-28,measure);
  const leading = BODY_FONT + 6;
  const positioned=placeText(rows,{measure,bounds:{x:x+14,y:y+10,w:w-28,h:h-20},leading,fontSize:BODY_FONT,
    top:y+(h-leading*rows.length)/2+3,layout:textLayout||{align:'center'},autoCenter:rows.length===1,scaleWidth:w,scaleHeight:h});
  positioned.forEach(row=>text(c,row.text,row.x,row.y,BODY_FONT,{bold:!card}));
  if (!available) {
    c.fillStyle = '#fff';
    for (let yy = y + 2; yy < y + h - 2; yy++) for (let xx = x + 2 + (yy % 2); xx < x + w - 2; xx += 2) c.fillRect(xx, yy, 1, 1);
  }
  control(out, label, x, y, w, h, action, available);
  if(card)out.cards?.push({action,x,y,w,h});
}
function choiceImage(id,blank=false) {
  const c=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  const {w,h}=choiceSize();c.canvas.width=w;c.canvas.height=h;
  button(c,{buttons:[]},blank?'':ACTIONS.find(a=>a.id===id)?.label||'',0,0,w,h,id,{textLayout:TEXT_LAYOUTS.actions?.[id]||{},card:true});
  const frame=monochrome(c,w,h);
  c.putImageData(new ImageData(new Uint8ClampedArray(frame.buffer,frame.byteOffset,frame.byteLength),w,h),0,0);
  return {url:c.canvas.toDataURL('image/png'),width:w,height:h};
}
function icon(c, name, x, y, size=32) { c.imageSmoothingEnabled = false; if (icons[name]) c.drawImage(icons[name], Math.round(x), Math.round(y), size, size); }
function header(c, out) {
  // Reserve each attribute's place even while it is hidden. Totals and direct
  // change badges stay in this same slot as other attributes are introduced.
  const changes=heldStats||editorPreview?{}:headerChangeAmounts(state,HUNGER_INDICATOR);
  (heldStats||presentedStats(state,HUNGER_INDICATOR)).forEach(([id,value]) => {
    const x=headerStatX(id,width),now=performance.now(),cue=statCues.get(id);
    if(!cue?.reveal||now>=cue.revealStart+900||prefs.reduceMotion||Math.floor((now-cue.revealStart)/150)%2===0)icon(c,STAT_ICONS[id],x-16,96);
    text(c,STAT_LABELS[id].toUpperCase(),x,134,SMALL_FONT,{center:true});
    const number=String(id==='money'?Math.round(value*100)/100:Math.round(value*10)/10);
    text(c,number,x,151,18,{center:true});
    if(id==='hunger')out.hungerNumber={x:x-c.measureText(number).width/2-1,y:151,w:c.measureText(number).width+2,h:22,...hungerTrend(state,HUNGER_INDICATOR)};
    if(changes[id])text(c,signedChange(changes[id]),x,176,BODY_FONT,{center:true});
  });
  quiet(c, out, '· ·', 8, 29, 40, 24, 'settings', UI.settings);
}
const LOG_MARGIN=12,LOG_PADDING=10;
const dateBar=()=>Object.values(gameClock(UI,state.elapsedMinutes)).filter(Boolean).join(' · ');
function logDateRows(c) { return []; }
const logDateHeight=rows=>rows.length?rows.length*(SMALL_FONT+4)+4:0;
function logRows(c,entries,size) {
  font(c,size);const measure=value=>c.measureText(value).width;
  const maxWidth=width-2*(LOG_MARGIN+LOG_PADDING);
  return entries.flatMap(({id},entry)=>{
    const rows=LOGS[id]?wrapText(LOGS[id],maxWidth,measure):[];
    if(!rows.length)return [];
    return [...rows.map(row=>({...row,id,entry,autoCenter:rows.length===1,height:size+10})),{text:'',line:0,entry:null,height:12}];
  });
}
function logSheet(c,rows,{y=205,h=140,size=BODY_FONT,bottomInset=12}={}) {
  const dateRows=logDateRows(c),dateHeight=logDateHeight(dateRows);
  const x=LOG_MARGIN,w=width-2*LOG_MARGIN,leading=size+10,top=y+12+dateHeight;
  c.fillStyle='#fff';c.fillRect(x,y,w,h);
  dateRows.forEach((row,index)=>text(c,row.text,x+LOG_PADDING,y+12+index*(SMALL_FONT+4),SMALL_FONT));
  font(c,size);const measure=value=>c.measureText(value).width;
  const offsets=[];let offset=0;for(const row of rows){offsets.push(offset);offset+=row.height;}
  for(const entry of new Set(rows.filter(row=>row.entry!==null&&!row.tokens).map(row=>row.entry))) {
    const first=rows.findIndex(row=>row.entry===entry&&!row.tokens),group=rows.filter(row=>row.entry===entry&&!row.tokens);
    const positioned=placeText(group,{measure,bounds:{x:x+LOG_PADDING,y:top,w:w-2*LOG_PADDING,h:h-12-bottomInset-dateHeight},leading,fontSize:size,
      top:top+offsets[first],layout:TEXT_LAYOUTS.logs?.[group[0].id]||{},autoCenter:group[0].autoCenter});
    positioned.forEach(row=>text(c,row.text,row.x,row.y,size));
  }
  return y+h+3;
}
function notebook(c,out,entries=logEntries(state)) {
  header(c,out);
  const lines=logRows(c,entries,STORY_FONT);
  const h=height-308,paginated=logPages(lines,h-72-logDateHeight(logDateRows(c))),pages=paginated.length;
  logPage=Math.min(logPage,pages-1);const rows=paginated[logPage];
  logSheet(c,rows,{y:205,h,size:STORY_FONT,bottomInset:pages>1?60:12});
  if(pages>1){quiet(c,out,'←',34,height-151,48,38,'log-prev');quiet(c,out,`${logPage+1} / ${pages} →`,width-148,height-151,114,38,'log-next');}
  out.logPages=pages;out.text=[dateBar(),rows.map(row=>row.text).join('\n')].filter(Boolean).join('\n');
  button(c,out,UI.return,width-166,height-78,144,56,'close-log');
}
function scene(c, out, node, intro = true) {
  const blank = node.kind === 'feeding';
  const isTitle = node.kind === 'title';
  const choices = cardChoices(node).map(choice=>({...choice,label:node.yes&&!node.choices?UI[choice.id]:choice.label}));
  const options = { bold: node.bold === true, italic: node.italic === true };
  // Restore the original type sizes while retaining the portrait card.
  const size = isTitle ? (width < 350 ? 15 : 17) : STORY_FONT;
  font(c,size,options.bold,options.italic);const measure=value=>c.measureText(value).width,margin=proseMargin(width);
  const rows = blank ? [] : wrapText(node.text,width-2*margin,measure);
  const leading = size + 10;
  const bottom = choices.length?choiceGrid(choices.length,height-90).top-24:height-110;
  const capacity = Math.max(1,Math.floor((bottom-206)/leading)), pages=Math.max(1,Math.ceil(rows.length/capacity));
  const page=Math.min(textPage,pages-1), visibleRows=rows.slice(page*capacity,(page+1)*capacity);
  const top = Math.max(206, Math.min(bottom-visibleRows.length*leading,Math.round(height * .43 - visibleRows.length * leading / 2)));
  const textLayout=TEXT_LAYOUTS[intro?'intro':'messages']?.[node.id]||{};
  const positioned=placeText(visibleRows,{measure,bounds:{x:margin,y:206,w:width-2*margin,h:bottom-206},leading,fontSize:size,top,
    layout:textLayout,autoCenter:rows.length===1,scaleWidth:width,scaleHeight:height});
  positioned.forEach(row=>text(c,row.text,row.x,row.y,size,options));
  out.scene = { id: node.id, text: node.text, kind: node.kind || (choices.length ? 'prompt' : 'line'), ...options, center:(textLayout.align||'auto')==='center'||(!textLayout.align||textLayout.align==='auto')&&rows.length===1, fontSize: size, page, pages };
  out.text = blank ? node.sound : pages>1?visibleRows.map(row=>row.text).join('\n'):node.text;
  if(pages>1)text(c,`${page+1} / ${pages}`,width/2,height-47,SMALL_FONT,{center:true});
  if (!intro) {
    // Result cards dismiss by tapping the card, just like reading an intertitle.
    control(out, UI.dismiss, 1, 1, width - 2, height - 2, 'dismiss-message');
    header(c, out);
    if(page>0)quiet(c,out,'←',14,height-78,56,56,'scene-prev',UI.back);
    return;
  }
  if (blank) {
    // The feeding sound plays over a completely blank card. Tap/keyboard advances.
    control(out, UI.next, 1, 1, width - 2, height - 2, 'next');
    return;
  }
  quiet(c, out, '· ·', 14, 29, 44, 32, 'settings', UI.settings);
  quiet(c, out, UI.skip, width - 218, 31, 122, 24, 'skip-intro');
  if(page<pages-1){control(out,UI.next,1,70,width-2,height-164,'next');quiet(c,out,'→',width-72,height-78,56,56,'next',UI.next);if(page>0)quiet(c,out,'←',14,height-78,56,56,'scene-prev',UI.back);return;}
  if (choices.length) {
    actionPage=Math.min(actionPage,Math.ceil(choices.length/CHOICES_PER_PAGE)-1);
    const shown=choices.slice(actionPage*CHOICES_PER_PAGE,(actionPage+1)*CHOICES_PER_PAGE),grid=choiceGrid(shown.length,height-90);
    drawEventLinks(c,grid.cards,{x:width/2,y:Math.min(grid.top-26,top+visibleRows.length*leading+18)});
    shown.forEach((choice,i)=>{const {x,y}=grid.cell(i);button(c,out,choice.label,x,y,grid.w,grid.h,`choice:${choice.id}`,{available:!!choice.label.trim(),card:true});});
    if(choices.length>CHOICES_PER_PAGE) quiet(c,out,'more choices →',width-174,height-72,158,48,'options-next');
  } else if (node.begin) {
    button(c, out, UI.begin, width - 184, height - 78, 162, 56, 'begin', { primary: true });
  } else {
    control(out, UI.next, 1, 70, width - 2, height - 164, 'next');
    quiet(c, out, '→', width - 72, height - 78, 56, 56, 'next', UI.next);
  }
  if (page>0||state.trail.length) quiet(c, out, '←', 14, height - 78, 56, 56, page>0?'scene-prev':'back', UI.back);
}
function main(c, out) {
  header(c, out);
  const entry=statusEntry(state);
  const log=LOGS[entry.id]||'';
  const allRows=logRows(c,[entry],BODY_FONT).filter(row=>row.entry!==null),prose=allRows.filter(row=>!row.tokens),rows=prose.slice(0,3);
  if(prose.length>3)rows[2]={...rows[2],text:rows[2].text+'…'};

  const allActions = visibleActions(state), pages = Math.max(1,Math.ceil(allActions.length/CHOICES_PER_PAGE));
  actionPage = Math.min(actionPage,pages-1);
  const actions = allActions.slice(actionPage*CHOICES_PER_PAGE,(actionPage+1)*CHOICES_PER_PAGE),grid=choiceGrid(actions.length,height-94);
  const enabled = new Set(availableActions(state).map(action => action.id));
  logSheet(c,rows,{h:24+logDateHeight(logDateRows(c))+rows.reduce((h,row)=>h+row.height,0)});
  actions.forEach((action, i) => {
    const {x,y}=grid.cell(i);button(c, out, action.label, x,y,grid.w,grid.h,action.id, { available: enabled.has(action.id),textLayout:TEXT_LAYOUTS.actions?.[action.id]||{},card:true });
    // The authored vine artwork will use this same computed loss as the warnings.
    out.buttons.at(-1).raptureCost=raptureCost(state,action);
  });
  if(pages>1){quiet(c,out,'←',18,height-66,48,48,'options-prev');quiet(c,out,`${actionPage+1} / ${pages} →`,width-132,height-66,114,48,'options-next');}
  out.text = [dateBar(),log].filter(Boolean).join('\n');
}
function draw() {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = width; c.canvas.height = height; box(c, 0, 0, width, height);
  const out = { buttons: [], cards: [], text: '', scene: null };
  // Plain classic window chrome, shared with the approved granola study.
  c.strokeStyle='#000';c.beginPath();c.moveTo(1,43.5);c.lineTo(width-1,43.5);c.stroke();
  for(let y=5;y<=21;y+=3){c.fillStyle='#000';c.fillRect(5,y,width/2-80,1);c.fillRect(width/2+80,y,Math.max(0,width/2-85),1);}
  text(c,'A L I G N M E N T',width/2,7,11,{bold:true,center:true});
  if (editorPreview) {
    const {type,id}=editorPreview;
    if(type==='intro') scene(c,out,{...(INTRO.find(n=>n.id===id)||INTRO[0])});
    else if(type==='actions') {const action=ACTIONS.find(a=>a.id===id),grid=choiceGrid(1),{x,y}=grid.cell(0);header(c,out);button(c,out,action?.label||'',x,y,grid.w,grid.h,id,{textLayout:TEXT_LAYOUTS.actions?.[id]||{},card:true});out.text=action?.label||'';}
    else if(type==='logs')notebook(c,out,[{id,changes:[]}]);
    else scene(c,out,{id,...(type==='messages'?MESSAGE_LINKS[id]:{}),text:({messages:MESSAGES,logs:LOGS,ui:UI,statLabels:STAT_LABELS}[type]||{})[id]||''},false);
    out.buttons=[];
  }
  else if (state.phase === 'intro') scene(c, out, currentNode(state));
  else if (currentWarning(state)) scene(c,out,currentWarning(state),false);
  else if (state.message) scene(c, out, { id: state.message,...MESSAGE_LINKS[state.message], text: MESSAGES[state.message] }, false);
  else if (screen === 'log') notebook(c,out);
  else main(c, out);
  return { pixels: tintHungerNumber(monochrome(c,width,height),width,height,out.hungerNumber), layout: out };
}
function paint(value) { ctx.putImageData(new ImageData(new Uint8ClampedArray(value.buffer, value.byteOffset, value.byteLength), width, height), 0, 0); }
function positionClock(){const rect=canvas.getBoundingClientRect();$('story-clock').style.top=`${Math.max(50,rect.top+50)}px`;$('story-clock').style.right=`${Math.max(10,innerWidth-rect.right+10)}px`;}
function installControls() {
  $('story-clock').hidden=state.phase!=='playing';const clock=gameClock(UI,state.elapsedMinutes);$('story-date').textContent=clock.date;$('story-time').textContent=clock.time;positionClock();
  $('controls').replaceChildren();
  for (const b of layout.buttons) {
    const el = document.createElement('button'); el.textContent = b.label; el.setAttribute('aria-label', b.label);
    el.dataset.action = b.action; el.disabled = !b.available;
    if(b.raptureCost!==undefined){el.dataset.raptureCost=String(b.raptureCost);el.dataset.undesirable=String(b.raptureCost>0);}
    Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    if(b.pain)el.dataset.pain=b.pain;if(b.need)el.dataset.need=b.need;
    el.onclick = event => activate(b.action,event.detail?{x:(event.clientX-canvas.getBoundingClientRect().left)*width/canvas.getBoundingClientRect().width,y:(event.clientY-canvas.getBoundingClientRect().top)*height/canvas.getBoundingClientRect().height}:null); $('controls').append(el);
  }
  $('narration').textContent = [layout.text, ...presentedStats(state,HUNGER_INDICATOR).map(([id,value])=>`${STAT_LABELS[id]} ${Math.round(value*100)/100}${!editorPreview&&headerChangeAmounts(state,HUNGER_INDICATOR)[id]?' ('+signedChange(headerChangeAmounts(state,HUNGER_INDICATOR)[id])+')':''}`)].filter(Boolean).join('\n');
}
function redraw() {
  $('settings-title').textContent=UI.settings;$('restart').textContent=UI.restart;
  $('settings').querySelector('form button').textContent=UI.return;
  $('sound').parentElement.lastChild.textContent=' card sounds';$('motion').parentElement.lastChild.textContent=' '+UI.motion;
  const frame = draw(); pixels = frame.pixels; layout = frame.layout; paint(pixels); installControls();
}
function resize() {
  stopStatCue();cardAudio.cancel();
  animationId++; heldStats=null; busy = false;
  lastViewportWidth=document.documentElement.clientWidth;
  ({width,height}=phoneScreen(lastViewportWidth,window.visualViewport?.height||innerHeight));
  canvas.width=width;canvas.height=height;
  $('stack').style.width = `${width}px`; $('stack').style.height = `${height}px`; redraw();
}
async function dissolve(from, to, id) {
  if (prefs.reduceMotion) { paint(to); return; }
  const w = width, h = height, buffer = new Uint32Array(to.length);
  await new Promise(resolve => {
    let start;
    const tick = now => {
      if (id !== animationId || w !== width || h !== height) { resolve(); return; }
      start ??= now; const progress = Math.min(1, (now - start) / 260);
      paint(prefs.reduceMotion ? to : composeFrame(from, to, w, h, progress, 'dissolve', buffer));
      if (progress === 1) resolve(); else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
async function activate(action,selectionPoint=null) {
  if (busy) return;
  if(editorPreview)return;
  if(action==='scene-prev'){textPage=Math.max(0,textPage-1);redraw();return;}
  if(['next','dismiss-message'].includes(action)&&layout.scene&&layout.scene.page<layout.scene.pages-1){textPage++;redraw();return;}
  if(action==='log-next'||action==='log-prev'){logPage=(logPage+(action==='log-next'?1:-1)+(layout.logPages||1))%(layout.logPages||1);redraw();return;}
  if(action==='options-next'||action==='options-prev') {
    const count=state.phase==='intro'?cardChoices(currentNode(state)).length:visibleActions(state).length;
    actionPage=(actionPage+(action==='options-next'?1:-1)+Math.ceil(count/CHOICES_PER_PAGE))%Math.max(1,Math.ceil(count/CHOICES_PER_PAGE));redraw();return;
  }
  if (action === 'settings') { $('settings').showModal(); return; }
  const startedAt=performance.now();
  const from = pixels, before=state, previousLayout=layout, id = ++animationId;
  stopStatCue();
  if (action === 'close-log') screen = 'main';
  else { const next = choose(state, action); if (next === state) return;
    const warningStep=!!next.hesitation||!!state.hesitation&&next.events.length===state.events.length;
    state = next; screen = 'main'; if(!warningStep)actionPage=0;textPage=0;
  }
  // Persist the committed choice before the animation, including refusal/reading position.
  save(); busy = true; $('controls').replaceChildren(); audio.unlock();cardAudio.unlock();
  if (state.phase === 'intro' && currentNode(state).kind === 'feeding') audio.feed();
  const feedback=attributeFeedback(before,state,HUNGER_INDICATOR);
  const event=state.events.at(-1),outcomeArrived=event&&!state.message&&(state.events.length>before.events.length||!!before.message);
  const amounts=outcomeArrived?eventChanges(event):[];
  const previousStats=Object.fromEntries(presentedStats(before,HUNGER_INDICATOR));
  for(const [stat,value] of presentedStats(state,HUNGER_INDICATOR))if(amounts.some(c=>c.stat===stat)&&!feedback.some(f=>f.stat===stat))feedback.push({stat,from:previousStats[stat]??value,to:value,amount:0,displayAmount:0});
  const selected=action==='warn-yes'?before.hesitation?.action:action;
  if(state.events.length>before.events.length){
    // Keep the chosen geometry through authored intertitles, without adding it to saves.
    if(!currentWarning(before)){
      choiceSources=Object.fromEntries(previousLayout.cards.map(c=>[c.action,{...c}]));lastChoiceSource=choiceSources[selected]||null;
    }
  }else if(before.phase==='playing'&&!before.message&&!currentWarning(before)&&currentWarning(state)){
    choiceSources=Object.fromEntries(previousLayout.cards.map(c=>[c.action,{...c}]));lastChoiceSource=choiceSources[selected];
  }
  const frame=draw(),cardsChanged=previousLayout.cards.length||frame.layout.cards.length;
  // Announce the selected description now; totals arrive at the end of the deal.
  $('narration').textContent=[frame.layout.text,...Object.entries(previousStats).map(([id,value])=>`${STAT_LABELS[id]} ${Math.round(value*100)/100}`)].filter(Boolean).join('\n');
  const targets=Object.fromEntries(feedback.map(f=>[f.stat,{x:headerStatX(f.stat,width),y:162,viewportWidth:width}]));
  const fallback=previousLayout.cards.find(c=>c.action===action)||lastChoiceSource||{...choiceGrid(2).cell(0),action:selected};
  const transfers=transferCards(feedback,amounts,choiceSources,fallback,targets);
  heldStats=Object.entries(previousStats);
  const held=draw().pixels;heldStats=null;
  cardAudio.cancel();
  void cardAudio.transition({outgoing:previousLayout.cards.length,incoming:frame.layout.cards.length,startedAt,reduced:prefs.reduceMotion});
  try {
    if(cardsChanged||feedback.length){
      await playCardTransition({transition:new CardTransition({from,to:frame.pixels,held,width,height,
        outgoing:previousLayout.cards,incoming:frame.layout.cards,selected:action,transfers,reduced:prefs.reduceMotion,handImage:icons.hand,selectionPoint}),context:ctx,startedAt,isCurrent:()=>id===animationId});
    }else await dissolve(from,frame.pixels,id);
  }finally {
    if(id===animationId){busy=false;startAttributeFeedback(before,state);redraw();}
  }
}

function pause() { stopStatCue();save(); audio.stop();cardAudio.stop(); if (busy) { animationId++; busy = false; redraw(); }else redraw(); }
function restart() {
  stopStatCue();cardAudio.stop();
  animationId++; busy = false; choiceSources={};lastChoiceSource=null; audio.stop();
  // A reversible restart retains the previous authored playthrough too.
  try { if(!testBackup)storage.setItem(`${SAVE_KEY}.before-restart`, serializeGame(state)); } catch {}
  state = createGame(); screen = 'main';actionPage=0;textPage=0;logPage=0; save(); $('settings').close(); redraw();
}
try {
  state = restoreGame(storage.getItem(SAVE_KEY)) || createGame();
  audio.prepare();cardAudio.prepare();
  await Promise.all([...new Set(['home',...Object.values(STAT_ICONS)])].map(name => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { icons[name] = image; resolve(); };
    image.onerror = () => reject(Error(`Missing icon: ${name}`)); image.src = `icons/${name}.png`;
  })));
  $('sound').checked=prefs.cardSound;$('sound').disabled=false;$('sound').parentElement.hidden=false;
  $('sound').onchange=event=>{prefs.cardSound=event.target.checked;cardAudio.setEnabled(prefs.cardSound);savePrefs();};
  $('motion').checked = prefs.reduceMotion;
  $('motion').onchange = event => { prefs.reduceMotion = event.target.checked; savePrefs(); };
  $('restart').onclick = restart;
  await new Promise(resolve=>{const image=new Image();image.onload=()=>{icons.hand=image;resolve();};image.onerror=resolve;image.src='art/check-hand.png';});
  resize(); save(); $('boot').remove(); addEventListener('resize', resize);addEventListener('scroll',positionClock,{passive:true});
  window.visualViewport?.addEventListener('resize',resize);
  new ResizeObserver(()=>{if(document.documentElement.clientWidth!==lastViewportWidth)resize();}).observe(document.documentElement);
  addEventListener('pagehide', pause); addEventListener('alignmentpause', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.alignmentBack = () => {
    if ($('settings').open) { $('settings').close(); return true; }
    if(editorPreview)return false;
    if(textPage>0){textPage--;redraw();return true;}
    if (busy) { cardAudio.cancel();animationId++; busy = false; redraw(); return true; }
    if (screen === 'log') { activate('close-log'); return true; }
    if (state.message||currentWarning(state)) { activate('dismiss-message'); return true; }
    if (state.phase === 'intro' && state.trail.length) { activate('back'); return true; }
    return false;
  };
  addEventListener('keydown', event => {
    if ($('settings').open || editorPreview || event.target.closest('input,textarea,select,[contenteditable],#editor-panel') || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (event.key === 'Escape' || event.key === 'ArrowLeft') { if (window.alignmentBack()) event.preventDefault(); return; }
    if ((state.message||currentWarning(state)) && !busy && (event.key === 'ArrowRight' ||
        ([' ', 'Enter'].includes(event.key) && document.activeElement.tagName !== 'BUTTON'))) {
      event.preventDefault(); activate('dismiss-message'); return;
    }
    if (state.phase !== 'intro' || busy) return;
    const node = currentNode(state);
    if (node.yes && ['y', 'n'].includes(event.key.toLowerCase())) { event.preventDefault(); activate(event.key.toLowerCase() === 'y' ? 'yes' : 'no'); }
    else if (event.key === 'ArrowRight' || (event.key === ' ' && document.activeElement.tagName !== 'BUTTON')) {
      if (!node.yes) { event.preventDefault(); activate(node.begin ? 'begin' : 'next'); }
    }
  });
  window.alignmentSnapshot = () => ({ state: structuredClone(state), screen: state.phase === 'intro' || state.message || currentWarning(state) ? 'scene' : screen,
    scene: layout.scene, busy, renderer: 'shared-granola-format', transitionMs:FORMAT_MS, content: 'human-authored', width, height,
    fonts: { story: STORY_FONT, body: BODY_FONT, small: SMALL_FONT }, revealedStats: Object.keys(state.stats),
    controls: layout.buttons, saveFailed, logs: state.logs.map(id => LOGS[id]), message: MESSAGES[state.message] || null });
  if(['127.0.0.1','localhost'].includes(location.hostname)) {
    const {mountEditor}=await import('./editor-client.mjs?v=1.4.5');
    editor=await mountEditor({
      current:()=>editorPreview||(state.phase==='intro'?{type:'intro',id:state.node}:currentWarning(state)?{type:'messages',id:currentWarning(state).id}:state.message?{type:'messages',id:state.message}:{type:'logs',id:state.logs.at(-1)||'opening'}),
      apply:(doc,{temporary=false}={})=>{stopStatCue();cardAudio.cancel();applyDocument(doc);if(!temporary){state=reconcileGame(state);if(testBackup)testBackup.state=reconcileGame(testBackup.state);}animationId++;busy=false;redraw();},
      preview:selection=>{stopStatCue();if(testBackup){state=testBackup.state;screen=testBackup.screen;testBackup=null;}editorPreview=selection;textPage=0;animationId++;busy=false;resize();},
      play:()=>{stopStatCue();if(testBackup){state=testBackup.state;screen=testBackup.screen;testBackup=null;}editorPreview=null;resize();},
      test:selection=>{
        stopStatCue();
        if(!testBackup)testBackup={state:structuredClone(state),screen};
        editorPreview=null;state=createGame();screen='main';textPage=0;actionPage=0;
        if(selection.type==='intro')state.node=selection.id;
        else {
          state=choose(state,'skip-intro');
          const target=selection.type==='actions'?ACTIONS.find(a=>a.id===selection.id):ACTIONS.find(a=>a.message===selection.id||a.firstGainMessage===selection.id);
          const visit=(a,seen=new Set())=>{if(!a||seen.has(a.id))return;seen.add(a.id);if(a.requires)visit(ACTIONS.find(x=>x.id===a.requires),seen);
            for(let i=0;i<3&&!state.completed.includes(a.id);i++){state=choose(state,a.id);while(state.message||currentWarning(state))state=choose(state,'dismiss-message');}
          };
          if(target?.requires)visit(ACTIONS.find(a=>a.id===target.requires));
          if(selection.type==='messages')state=previewIntertitle(selection.id);
          if(selection.type==='actions')actionPage=Math.max(0,Math.floor(visibleActions(state).findIndex(a=>a.id===selection.id)/CHOICES_PER_PAGE));
        }
        resize();
      },resize,choiceImage
    });
  }
} catch (error) { $('boot').textContent = 'Unable to open the stack. ' + error.message; console.error(error); }
