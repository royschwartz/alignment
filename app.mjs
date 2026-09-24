import {holdSelectionHand,SELECTION_HOLD_MS} from './selection-hand.mjs';
import { INTRO, ACTIONS, LOGS, MESSAGES, MESSAGE_LINKS, STAT_LABELS, UI, TEXT_LAYOUTS, HUNGER_INDICATOR, applyDocument } from './author-content.mjs';
import { createGame, choose, currentNode, availableActions, visibleActions, restoreGame, serializeGame, reconcileGame, previewIntertitle, currentWarning, raptureCost, SAVE_KEY } from './author-core.mjs';
import { cardChoices } from './author-schema.mjs';
import { composeFrame, monochrome } from './effects.mjs';
import { StackAudio } from './audio.mjs';
import {wrapText,placeText,proseMargin} from './text-layout.mjs';
import {STAT_ICONS,headerStatX,signedChange} from './game-stats.mjs';
import {logEntries,changesText,changeRows,logPages,LOG_ICON_SIZE,LOG_ICON_GAP} from './stat-log.mjs';
import {logDateTime} from './story-clock.mjs';
import {hungerTrend,tintHungerNumber} from './hunger-indicator.mjs';
import {presentedStats,attributeFeedback,animatedValue} from './attribute-feedback.mjs';
import {phoneScreen,cardLayout,PHONE_FONT} from './phone-screen.mjs';

// Preserve the existing black-and-white canvas and HyperCard dissolve treatment.
// All narrative comes from the author's script; this file only handles presentation.
const $ = id => document.getElementById(id);
const canvas = $('card'), ctx = canvas.getContext('2d', { willReadFrequently: true });
// Roy has paused all in-game audio while auditioning alternatives separately.
const audio = new StackAudio({bank:'silent'}), icons = {};
let storage;
try { storage = window.localStorage; } catch { storage = { getItem: () => null, setItem: () => { throw Error('Storage unavailable'); } }; }
let prefs;
try { prefs = JSON.parse(storage.getItem('alignment.preferences')) || {}; } catch { prefs = {}; }
prefs = { sound: false, reduceMotion: prefs.reduceMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches };
audio.enabled = prefs.sound;
let state, width, height, pixels, layout, busy = false, animationId = 0, saveFailed = false;
const statCues=new Map();let statCueTimer=null;
function stopStatCue(){clearInterval(statCueTimer);statCueTimer=null;statCues.clear();audio.cancelCues();}
function startAttributeFeedback(before,after,delay=0){
  const now=performance.now()+delay,feedback=attributeFeedback(before,after,HUNGER_INDICATOR);
  audio.unlock();
  feedback.forEach((change,index)=>{
    const revealDelay=currentWarning(after)?.revealsRapture?900:260;
    const delay=(change.reveal?revealDelay:280)+index*100;
    const start=now+delay+(change.reveal&&change.amount?550:0);
    statCues.set(change.stat,{...change,start,revealStart:now+delay,end:start+Math.max(1400,change.duration*1000)});
    if(change.reveal)audio.attribute('reveal',{stat:change.stat,delay:delay/1000});
    if(change.amount)audio.attribute(change.amount>0?'gain':'loss',{stat:change.stat,duration:change.duration,volume:change.volume/Math.sqrt(feedback.filter(c=>c.amount).length),delay:(start-now)/1000});
  });
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
  if(card){c.fillStyle='#000';c.fillRect(x+1,y+1,w,h);}
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
  presentedStats(state,HUNGER_INDICATOR).forEach(([id,value]) => {
    const x=headerStatX(id,width);
    const now=performance.now(),cue=statCues.get(id);
    if(cue?.reveal&&now<cue.revealStart)return;
    if(!cue?.reveal||now>=cue.revealStart+1200||prefs.reduceMotion||Math.floor((now-cue.revealStart)/300)%2===0)icon(c,STAT_ICONS[id],x-16,21);
    text(c,STAT_LABELS[id],x,8,SMALL_FONT,{center:true});
    const shown=animatedValue(cue,now,prefs.reduceMotion)??value;
    const number=String(id==='money'?Math.round(shown*100)/100:Math.round(shown*10)/10);
    text(c,number,x,55,BODY_FONT,{bold:true,center:true});
    if(id==='hunger')out.hungerNumber={x:x-c.measureText(number).width/2-1,y:55,w:c.measureText(number).width+2,h:14,...hungerTrend(state,HUNGER_INDICATOR)};
    if(cue?.displayAmount&&now>=cue.start)text(c,signedChange(cue.displayAmount),x,70,SMALL_FONT,{center:true});
  });
  quiet(c, out, '· ·', width - 45, 16, 44, 48, 'settings', UI.settings);
  rule(c, 82);
}
const LOG_MARGIN=12,LOG_PADDING=10;
const dateBar=()=>logDateTime(UI,state.elapsedMinutes);
function logDateRows(c) {
  font(c,SMALL_FONT);
  return wrapText(dateBar(),width-2*(LOG_MARGIN+LOG_PADDING),value=>c.measureText(value).width);
}
const logDateHeight=rows=>rows.length?rows.length*(SMALL_FONT+4)+4:0;
function logRows(c,entries,size) {
  font(c,size);const measure=value=>c.measureText(value).width;
  const maxWidth=width-2*(LOG_MARGIN+LOG_PADDING);
  return entries.flatMap(({id,changes=[]},entry)=>{
    const rows=LOGS[id]?wrapText(LOGS[id],maxWidth,measure):[];
    const badges=changeRows(changes,maxWidth,measure).map(row=>({...row,text:changesText(row.tokens,STAT_LABELS),id,entry,height:Math.max(size,LOG_ICON_SIZE)+8}));
    if(!rows.length&&!badges.length)return [];
    return [...rows.map(row=>({...row,id,entry,autoCenter:rows.length===1,height:size+10})),...badges,{text:'',line:0,entry:null,height:12}];
  });
}
function logSheet(c,rows,{y=102,h=140,size=BODY_FONT,bottomInset=12}={}) {
  const dateRows=logDateRows(c),dateHeight=logDateHeight(dateRows);
  const x=LOG_MARGIN,w=width-2*LOG_MARGIN,leading=size+10,top=y+12+dateHeight;
  c.fillStyle='#000';c.fillRect(x+3,y+3,w,h);box(c,x,y,w,h);
  dateRows.forEach((row,index)=>text(c,row.text,x+LOG_PADDING,y+12+index*(SMALL_FONT+4),SMALL_FONT));
  font(c,size);const measure=value=>c.measureText(value).width;
  const offsets=[];let offset=0;for(const row of rows){offsets.push(offset);offset+=row.height;}
  for(const entry of new Set(rows.filter(row=>row.entry!==null&&!row.tokens).map(row=>row.entry))) {
    const first=rows.findIndex(row=>row.entry===entry&&!row.tokens),group=rows.filter(row=>row.entry===entry&&!row.tokens);
    const positioned=placeText(group,{measure,bounds:{x:x+LOG_PADDING,y:top,w:w-2*LOG_PADDING,h:h-12-bottomInset-dateHeight},leading,fontSize:size,
      top:top+offsets[first],layout:TEXT_LAYOUTS.logs?.[group[0].id]||{},autoCenter:group[0].autoCenter});
    positioned.forEach(row=>text(c,row.text,row.x,row.y,size));
  }
  rows.forEach((row,index)=>{if(!row.tokens)return;const left=x+(w-row.width)/2,y=top+offsets[index];
    row.tokens.forEach(token=>{text(c,token.label,left+token.x,y+(LOG_ICON_SIZE-size)/2,size);if(token.icon)icon(c,token.icon,left+token.x+measure(token.label)+LOG_ICON_GAP,y,LOG_ICON_SIZE);});
  });
  return y+h+3;
}
function notebook(c,out,entries=logEntries(state)) {
  header(c,out);
  const lines=logRows(c,entries,STORY_FONT);
  const h=height-202,paginated=logPages(lines,h-72-logDateHeight(logDateRows(c))),pages=paginated.length;
  logPage=Math.min(logPage,pages-1);const rows=paginated[logPage];
  logSheet(c,rows,{y:102,h,size:STORY_FONT,bottomInset:pages>1?60:12});
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
  const capacity = Math.max(1,Math.floor((bottom-120)/leading)), pages=Math.max(1,Math.ceil(rows.length/capacity));
  const page=Math.min(textPage,pages-1), visibleRows=rows.slice(page*capacity,(page+1)*capacity);
  const top = Math.max(intro ? 96 : 120, Math.min(bottom-visibleRows.length*leading,Math.round(height * .43 - visibleRows.length * leading / 2)));
  const textLayout=TEXT_LAYOUTS[intro?'intro':'messages']?.[node.id]||{};
  const positioned=placeText(visibleRows,{measure,bounds:{x:margin,y:intro?96:120,w:width-2*margin,h:bottom-(intro?96:120)},leading,fontSize:size,top,
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
  quiet(c, out, '· ·', 14, 12, 44, 48, 'settings', UI.settings);
  quiet(c, out, UI.skip, width - 146, 12, 132, 48, 'skip-intro');
  if(page<pages-1){control(out,UI.next,1,70,width-2,height-164,'next');quiet(c,out,'→',width-72,height-78,56,56,'next',UI.next);if(page>0)quiet(c,out,'←',14,height-78,56,56,'scene-prev',UI.back);return;}
  if (choices.length) {
    actionPage=Math.min(actionPage,Math.ceil(choices.length/CHOICES_PER_PAGE)-1);
    const shown=choices.slice(actionPage*CHOICES_PER_PAGE,(actionPage+1)*CHOICES_PER_PAGE),grid=choiceGrid(shown.length,height-90);
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
  const entry=logEntries(state).at(-1)||{id:null,changes:[]};
  const log=[LOGS[entry.id]||'',changesText(entry.changes,STAT_LABELS)].filter(Boolean).join('\n');
  const allRows=logRows(c,[entry],BODY_FONT).filter(row=>row.entry!==null),prose=allRows.filter(row=>!row.tokens),rows=prose.slice(0,3);
  if(prose.length>3)rows[2]={...rows[2],text:rows[2].text+'…'};
  rows.push(...allRows.filter(row=>row.tokens));
  const logBottom=logSheet(c,rows,{h:24+logDateHeight(logDateRows(c))+rows.reduce((h,row)=>h+row.height,0)});
  const allActions = visibleActions(state), pages = Math.max(1,Math.ceil(allActions.length/CHOICES_PER_PAGE));
  actionPage = Math.min(actionPage,pages-1);
  const actions = allActions.slice(actionPage*CHOICES_PER_PAGE,(actionPage+1)*CHOICES_PER_PAGE),grid=choiceGrid(actions.length,height-94);
  const enabled = new Set(availableActions(state).map(action => action.id));
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
function installControls() {
  $('controls').replaceChildren();
  for (const b of layout.buttons) {
    const el = document.createElement('button'); el.textContent = b.label; el.setAttribute('aria-label', b.label);
    el.dataset.action = b.action; el.disabled = !b.available;
    if(b.raptureCost!==undefined){el.dataset.raptureCost=String(b.raptureCost);el.dataset.undesirable=String(b.raptureCost>0);}
    Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    el.onclick = () => activate(b.action); $('controls').append(el);
  }
  $('narration').textContent = [layout.text, ...presentedStats(state,HUNGER_INDICATOR).map(([id,value])=>`${STAT_LABELS[id]} ${Math.round(value*100)/100}`)].filter(Boolean).join('\n');
}
function redraw() {
  $('settings-title').textContent=UI.settings;$('restart').textContent=UI.restart;
  $('settings').querySelector('form button').textContent=UI.return;
  $('sound').parentElement.lastChild.textContent=' '+UI.sound;$('motion').parentElement.lastChild.textContent=' '+UI.motion;
  const frame = draw(); pixels = frame.pixels; layout = frame.layout; paint(pixels); installControls();
}
function resize() {
  stopStatCue();
  animationId++; busy = false;
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
async function activate(action) {
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
  const selectedCard=layout.cards?.find(card=>card.action===action);
  const from = pixels, id = ++animationId;
  stopStatCue();
  if (action === 'close-log') screen = 'main';
  else { const next = choose(state, action); if (next === state) return;
    startAttributeFeedback(state,next,selectedCard?SELECTION_HOLD_MS:0);
    const warningStep=!!next.hesitation||!!state.hesitation&&next.events.length===state.events.length;
    state = next; screen = 'main'; if(!warningStep)actionPage=0;textPage=0;
  }
  // Persist the committed choice before the animation, including refusal/reading position.
  save(); busy = true; $('controls').replaceChildren(); audio.unlock();
  if (state.phase === 'intro' && currentNode(state).kind === 'feeding') audio.feed();
  const frame = draw();
  try {
    await holdSelectionHand({paint,from,context:ctx,image:icons.hand,card:selectedCard,width,height,isCurrent:()=>id===animationId});
    if(id===animationId)await dissolve(from,frame.pixels,id);
  }
  finally { if (id === animationId) { busy = false; pixels = frame.pixels; layout = frame.layout; paint(pixels); installControls(); } }
}
function pause() { stopStatCue();save(); audio.stop(); if (busy) { animationId++; busy = false; redraw(); }else redraw(); }
function restart() {
  stopStatCue();
  animationId++; busy = false; audio.stop();
  // A reversible restart retains the previous authored playthrough too.
  try { if(!testBackup)storage.setItem(`${SAVE_KEY}.before-restart`, serializeGame(state)); } catch {}
  state = createGame(); screen = 'main';actionPage=0;textPage=0;logPage=0; save(); $('settings').close(); redraw();
}
try {
  state = restoreGame(storage.getItem(SAVE_KEY)) || createGame();
  audio.prepare();
  await Promise.all([...new Set(['home',...Object.values(STAT_ICONS)])].map(name => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { icons[name] = image; resolve(); };
    image.onerror = () => reject(Error(`Missing icon: ${name}`)); image.src = `icons/${name}.png`;
  })));
  $('sound').checked = false; $('sound').disabled=true; $('sound').parentElement.hidden=true;
  $('motion').checked = prefs.reduceMotion;
  $('motion').onchange = event => { prefs.reduceMotion = event.target.checked; savePrefs(); };
  $('restart').onclick = restart;
  await new Promise(resolve=>{const image=new Image();image.onload=()=>{icons.hand=image;resolve();};image.onerror=resolve;image.src='art/check-hand.png';});
  resize(); save(); $('boot').remove(); addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize',resize);
  new ResizeObserver(()=>{if(document.documentElement.clientWidth!==lastViewportWidth)resize();}).observe(document.documentElement);
  addEventListener('pagehide', pause); addEventListener('alignmentpause', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.alignmentBack = () => {
    if ($('settings').open) { $('settings').close(); return true; }
    if(editorPreview)return false;
    if(textPage>0){textPage--;redraw();return true;}
    if (busy) { animationId++; busy = false; redraw(); return true; }
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
    scene: layout.scene, busy, renderer: 'original-hypercard-canvas', content: 'human-authored', width, height,
    fonts: { story: STORY_FONT, body: BODY_FONT, small: SMALL_FONT }, revealedStats: Object.keys(state.stats),
    controls: layout.buttons, saveFailed, logs: state.logs.map(id => LOGS[id]), message: MESSAGES[state.message] || null });
  if(['127.0.0.1','localhost'].includes(location.hostname)) {
    const {mountEditor}=await import('./editor-client.mjs');
    editor=await mountEditor({
      current:()=>editorPreview||(state.phase==='intro'?{type:'intro',id:state.node}:currentWarning(state)?{type:'messages',id:currentWarning(state).id}:state.message?{type:'messages',id:state.message}:{type:'logs',id:state.logs.at(-1)||'opening'}),
      apply:(doc,{temporary=false}={})=>{stopStatCue();applyDocument(doc);if(!temporary){state=reconcileGame(state);if(testBackup)testBackup.state=reconcileGame(testBackup.state);}animationId++;busy=false;redraw();},
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
