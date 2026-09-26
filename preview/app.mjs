import {animationClock,normalizeAnimationFPS,animateFrames,requestAnimationTick} from './animation-clock.mjs';
import {phoneScreen,PHONE_BOLD_FONT,GAME_TEXT,CHOICE_CARD_DROP} from './phone-screen.mjs?v=1.4.10';
import { INTRO, ACTIONS, LOGS, MESSAGES, MESSAGE_LINKS, STAT_LABELS, UI, TEXT_LAYOUTS, HUNGER_INDICATOR, applyDocument } from './author-content.mjs';
import { createGame, choose, currentNode, availableActions, visibleActions, restoreGame, serializeGame, reconcileGame, previewIntertitle, currentWarning, raptureCost, SAVE_KEY, hand, dealWeights, presentHand, withdrawingNeeds } from './author-core.mjs?v=1.4.10';
import { cardChoices } from './author-schema.mjs?v=1.4.10';
import { composeFrame, monochrome, greyUnavailableCards } from './effects.mjs';
import { StackAudio } from './audio.mjs';
import {CardAudio} from './card-audio.mjs?v=1.4.10';
import {wrapText,placeText,proseMargin} from './text-layout.mjs';
import {STAT_ICONS,headerStatX,headerStatLayout,signedChange} from './game-stats.mjs?v=1.4.10';
import {logEntries,statusEntry,eventChanges,logPages} from './stat-log.mjs?v=1.4.10';
import {gameClock} from './story-clock.mjs?v=1.4.10';
import {hungerTrend,tintHungerNumber} from './hunger-indicator.mjs';
import {presentedStats,attributeFeedback,headerChangeAmounts} from './attribute-feedback.mjs?v=1.4.10';
import {CardTransition,playCardTransition,cardLayout,transferCards,MAC_FONT,presentationDuration} from './card-format.mjs?v=1.4.10';
import {drawEventLinks,alignEventCards,decisionProseBounds} from './event-links.mjs?v=1.4.10';
// Display lab: a side copy of the game for trying pain/need card treatments.
import {drawChoiceCard,drawThread,drawChain,isAnimated,isTethered} from './card-treatments.mjs?v=1.4.10';
import {mountLab,lab,showDeal} from './lab.mjs?v=1.4.10';
import {loadCardPhotos,drawPhotoCard,drawPhotoBack} from './photo-cards.mjs';
import {STORY_ENABLED,storyDate} from './first-nights.mjs';

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
prefs = { sound: false, cardSound:prefs.cardSound!==false, animationFPS:normalizeAnimationFPS(prefs.animationFPS), reduceMotion: prefs.reduceMotion === true || matchMedia('(prefers-reduced-motion: reduce)').matches };
audio.enabled = prefs.sound;cardAudio.enabled=prefs.cardSound;animationClock.setFPS(prefs.animationFPS);
let state, width, height, pixels, layout, busy = false, animationId = 0, saveFailed = false;
let heldStats=null,choiceSources={},lastChoiceSource=null;
const statCues=new Map();let statCueTimer=null,statCueGeneration=0;
function stopStatCue(){statCueGeneration++;statCueTimer=null;statCues.clear();audio.cancelCues();}
function startAttributeFeedback(before,after){
  const now=performance.now(),feedback=attributeFeedback(before,after,HUNGER_INDICATOR);
  for(const change of feedback)statCues.set(change.stat,{...change,start:now,revealStart:now,end:now+1200});
  if(!feedback.length)return;
  const generation=++statCueGeneration;statCueTimer=generation;
  void animateFrames({duration:1200,startedAt:now,isCurrent:()=>generation===statCueGeneration,
    draw:elapsed=>{
      if(busy)return;
      for(const [stat,cue] of statCues)if(now+elapsed>=cue.end)statCues.delete(stat);
      const frame=draw();pixels=frame.pixels;paint(pixels);
    }
  }).finally(()=>{if(generation===statCueGeneration){statCueTimer=null;queueAmbient();}});
}
let screen = 'main';
let editorPreview = null, testBackup = null, actionPage = 0, textPage = 0, logPage = 0, editor = null, lastViewportWidth = 0;
// When the current screen appeared: need cards burst on arrival, then settle.
let sceneSince = performance.now();
const {story:STORY_FONT,body:BODY_FONT,small:SMALL_FONT,headerLabel:HEADER_LABEL_FONT,headerChange:HEADER_CHANGE_FONT}=GAME_TEXT;
const CHOICES_PER_PAGE=4;
// The same portrait size and tight, slightly uneven spacing on every choice screen.
function choiceSize(){const grid=cardLayout(2,width,height);return {w:grid.w,h:grid.h};}
function choiceGrid(count,bottom=height-94){
  return cardLayout(Math.min(count,CHOICES_PER_PAGE),width,height,`${state?.randomSeed}:${state?.events.length}:${state?.node}`,bottom+CHOICE_CARD_DROP);
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
  c.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${size}px ${bold ? PHONE_BOLD_FONT : MAC_FONT}`;
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
  const size=y<headerStatLayout(width).dividerY?HEADER_LABEL_FONT:SMALL_FONT;
  text(c, label, x + w / 2, y + (h - size) / 2, size, { center: true });
  control(out, accessible, x, y, w, h, action);
}
function button(c, out, label, x, y, w, h, action, { primary = false, available = true, textLayout=null, card=false } = {}) {
  if(card){
    drawChoiceCard(c,{x,y,w,h,label,textLayout,available,id:action,fontFamily:MAC_FONT,bold:false,reduceMotion:prefs.reduceMotion});
    control(out,label,x,y,w,h,action,available);
    out.cards?.push({action,x,y,w,h,available});return;
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
  if(card)out.cards?.push({action,x,y,w,h,available});
}
function choiceImage(id,blank=false) {
  const c=document.createElement('canvas').getContext('2d',{willReadFrequently:true});
  const {w,h}=choiceSize();c.canvas.width=w;c.canvas.height=h;c.fillStyle='#fff';c.fillRect(0,0,w,h);
  button(c,{buttons:[]},blank?'':ACTIONS.find(a=>a.id===id)?.label||'',0,0,w,h,id,{textLayout:TEXT_LAYOUTS.actions?.[id]||{},card:true});
  const frame=monochrome(c,w,h);
  c.putImageData(new ImageData(new Uint8ClampedArray(frame.buffer,frame.byteOffset,frame.byteLength),w,h),0,0);
  return {url:c.canvas.toDataURL('image/png'),width:w,height:h};
}
function icon(c, name, x, y, size=32) { c.imageSmoothingEnabled = false; if (icons[name]) c.drawImage(icons[name], Math.round(x), Math.round(y), size, size); }
function header(c, out) {
  // Reserve each attribute's place even while it is hidden. Totals and direct
  // change badges stay in this same slot as other attributes are introduced.
  const changes=editorPreview?{}:headerChangeAmounts(state,HUNGER_INDICATOR),row=headerStatLayout(width);
  (heldStats||presentedStats(state,HUNGER_INDICATOR)).forEach(([id,value]) => {
    const x=headerStatX(id,width),now=performance.now(),cue=statCues.get(id);
    if(!cue?.reveal||now>=cue.revealStart+900||prefs.reduceMotion||Math.floor((now-cue.revealStart)/150)%2===0)icon(c,STAT_ICONS[id],x-16,row.iconY);
    text(c,STAT_LABELS[id].toUpperCase(),x,row.labelY,HEADER_LABEL_FONT,{center:true});
    const number=String(id==='money'?Math.round(value*100)/100:Math.round(value*10)/10);
    text(c,number,x,row.totalY,18,{center:true});
    if(id==='hunger')out.hungerNumber={x:x-c.measureText(number).width/2-1,y:row.totalY,w:c.measureText(number).width+2,h:22,...hungerTrend(state,HUNGER_INDICATOR)};
    if(changes[id])text(c,signedChange(changes[id]),x,row.changeY,HEADER_CHANGE_FONT,{center:true});
  });
  c.fillStyle='#000';c.fillRect(row.dividerInset,row.dividerY,width-2*row.dividerInset,1);
  quiet(c, out, '· ·', 8, 29, 40, 24, 'settings', UI.settings);
  if(STORY_ENABLED)text(c,`portions: ${state.story.portions}`,16,196,SMALL_FONT);
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
  // Larger reading text below the header; wrapping keeps authored line identities.
  const size = isTitle ? (width < 350 ? GAME_TEXT.titleNarrow : GAME_TEXT.title) : STORY_FONT;
  font(c,size,options.bold,options.italic);const measure=value=>c.measureText(value).width,margin=proseMargin(width);
  const rows = blank ? [] : wrapText(node.text,width-2*margin,measure);
  const leading = size + 10;
  const bottom = node.prompt?choiceGrid(4,height-90).top-24:choices.length?choiceGrid(choices.length,height-90).top-24:height-110;
  const capacity = Math.max(1,Math.floor((bottom-206)/leading)), pages=Math.max(1,Math.ceil(rows.length/capacity));
  const page=Math.min(textPage,pages-1), visibleRows=rows.slice(page*capacity,(page+1)*capacity);
  const top = Math.max(206, Math.min(bottom-visibleRows.length*leading,Math.round(height * .43 - visibleRows.length * leading / 2)));
  const textLayout=TEXT_LAYOUTS[intro?'intro':'messages']?.[node.id]||{};
  const positioned=placeText(visibleRows,{measure,bounds:{x:margin,y:206,w:width-2*margin,h:bottom-(178)},leading,fontSize:size,top,
    layout:textLayout,autoCenter:rows.length===1,scaleWidth:width,scaleHeight:height});
  positioned.forEach(row=>text(c,row.text,row.x,row.y,size,options));
  out.proseBounds=decisionProseBounds(positioned,measure,size);
  out.scene = { id: node.id, text: node.text, kind: node.kind || (choices.length ? 'prompt' : 'line'), ...options, center:(textLayout.align||'auto')==='center'||(!textLayout.align||textLayout.align==='auto')&&rows.length===1, fontSize: size, page, pages };
  out.text = blank ? node.sound : pages>1?visibleRows.map(row=>row.text).join('\n'):node.text;
  if(pages>1)text(c,`${page+1} / ${pages}`,width/2,height-47,SMALL_FONT,{center:true});
  if (!intro&&node.prompt) {
    header(c,out);warningChoices(c,out);
    return;
  }
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
    const slots=alignEventCards(grid.cards);
    out.decision={prose:out.proseBounds,branch:['investigate','throw'].includes(node.id)?null:drawEventLinks(c,slots,{x:width/2,y:Math.min(grid.top-26,top+visibleRows.length*leading+18)})};
    shown.forEach((choice,i)=>{const {x,y}=slots[i];button(c,out,choice.label,x,y,grid.w,grid.h,`choice:${choice.id}`,{available:!!choice.label.trim(),card:true});});
    if(choices.length>CHOICES_PER_PAGE) quiet(c,out,'more choices →',width-174,height-52,158,48,'options-next');
  } else if (node.begin) {
    button(c, out, UI.begin, width - 184, height - 78, 162, 56, 'begin', { primary: true });
  } else {
    control(out, UI.next, 1, 70, width - 2, height - 164, 'next');
    quiet(c, out, '→', width - 72, height - 78, 56, 56, 'next', UI.next);
  }
  if (page>0||state.trail.length) quiet(c, out, '←', 14, height-(choices.length?54:78), 56, choices.length?48:56, page>0?'scene-prev':'back', UI.back);
}
function warningChoices(c,out){
  const grid=choiceGrid(4,height-90),parent={x:(width-grid.w)/2,y:(grid.cell(0).y+grid.cell(1).y)/2,w:grid.w,h:grid.h};
  const action=ACTIONS.find(a=>a.id===state.hesitation?.action);
  const children=alignEventCards(grid.cards.slice(2));
  out.decision={prose:out.proseBounds,branch:drawEventLinks(c,children,{x:width/2,y:parent.y+parent.h})};
  drawChoiceCard(c,{...parent,label:action?.label||'',id:action?.id||'',pain:'none',fontFamily:MAC_FONT,bold:false,reduceMotion:prefs.reduceMotion});
  out.cards.push({...parent,action:'event-parent'});
  [['warn-yes',UI.yes],['warn-no',UI.no]].forEach(([id,label],i)=>{const at=children[i];button(c,out,label,at.x,at.y,at.w,at.h,id,{card:true});});
}
// The existing deal uses the approved close portrait-card format.
let anim=null;
function handGeometry() {
  const dealt=hand(state),grid=cardLayout(dealt.cards.length,width,height,`${state.randomSeed}:${dealt.turn}`,height-94+CHOICE_CARD_DROP);
  if(STORY_ENABLED&&state.story.encounter)grid.cards=alignEventCards(grid.cards);
  return {...grid,slots:Object.fromEntries(dealt.cards.map((card,i)=>[card.slot,grid.cards[i]]))};
}
// Roy removed the selection hand; card movement supplies the visual feedback.

const heartAnchor=()=>({x:headerStatX('rapture',width),y:headerStatLayout(width).changeY+11});
function placement(card) {return {x:card.x,y:card.y,k:1};}
function drawDealt(c,card,size,now) {
  const {w,h}=size,at=placement(card,size);
  const opts={x:0,y:0,w,h,label:card.action.label,textLayout:TEXT_LAYOUTS.actions?.[card.action.id]||{align:'center'},pain:card.painLook,need:card.needLook,
    level:card.level,id:card.action.id,t:now,since:sceneSince,reduceMotion:prefs.reduceMotion,photoMode:lab.photoMode,border:lab.border,labelInset:STORY_ENABLED?8:14};
  c.save();c.translate(at.x,at.y);c.scale(at.k,at.k);

  const drawFace=options=>lab.cardDesign==='photo'?drawPhotoCard(c,{...options,pain:options.pain!=='none',need:options.need!=='none'}):drawChoiceCard(c,{...options,fontFamily:MAC_FONT,bold:lab.cardDesign!=='simple'});
  if(anim?.kind==='flip'&&anim.ids.includes(card.action.id)) {
    // Turn the card over around its middle: back narrows, then the face widens.
    c.translate(w/2,0);c.scale(Math.max(.03,Math.abs(Math.cos(anim.p*Math.PI))),1);c.translate(-w/2,0);
    if(anim.p<.5)drawPhotoBack(c,opts);else drawFace({...opts,pain:'none',need:'none'});
  } else drawFace({...opts,faceDown:card.faceDown});
  if(card.action.requiredChoice&&Object.hasOwn(state.stats,'choice'))text(c,String(card.action.requiredChoice),w/2,h-25,SMALL_FONT,{center:true});
  c.restore();
}
function main(c, out) {
  header(c, out);
  const now=performance.now(),heart=heartAnchor(),dealt=hand(state),size=handGeometry();
  // Pain marks wait until the heart has been revealed (Roy, September 23).
  const raptureShown=Object.hasOwn(state.stats,'rapture');
  const cards=dealt.cards.map(card=>({...card,...size.slots[card.slot],painLook:card.pain&&raptureShown?(lab.cardDesign==='photo'?'print-wire':lab.pain):'none',needLook:card.need?(lab.cardDesign==='photo'?'chain':lab.need):'none'}));
  // Chains hang from the heart and pass behind the notepad.
  for(const card of cards)if(isTethered(card.needLook)&&anim?.kind!=='deal') {
    const at=placement(card,size);(card.needLook==='chain'?drawChain:drawThread)(c,heart,{x:at.x,y:at.y,w:size.w*at.k,routeX:card.x<width/2?card.x-10:card.x+size.w+10},now,sceneSince,prefs.reduceMotion);
  }
  const entry=statusEntry(state);
  const log=LOGS[entry.id]||'';
  const prose=logRows(c,[entry],BODY_FONT).filter(row=>row.entry!==null&&!row.tokens);
  const capacity=Math.max(1,Math.min(3,Math.floor((size.top-217)/(BODY_FONT+10)))),rows=prose.slice(0,capacity);
  if(prose.length>capacity)rows[capacity-1]={...rows[capacity-1],text:rows[capacity-1].text+'…'};
  const encounter=STORY_ENABLED&&state.story.encounter;
  if(encounter){
    const value=MESSAGES['hole-standing'],margin=proseMargin(width);
    font(c,STORY_FONT);const measure=s=>c.measureText(s).width;
    const lines=wrapText(value,width-2*margin,measure),leading=STORY_FONT+10;
    const bounds={x:margin,y:196,w:width-2*margin,h:Math.max(60,size.top-220)};
    const positioned=placeText(lines,{measure,bounds,leading,fontSize:STORY_FONT,top:196+Math.max(0,(bounds.h-lines.length*leading)/2),layout:{},autoCenter:lines.length===1,scaleWidth:width,scaleHeight:height});
    positioned.forEach(row=>text(c,row.text,row.x,row.y,STORY_FONT));
    out.decision={prose:decisionProseBounds(positioned,measure,STORY_FONT),branch:drawEventLinks(c,cards,{x:width/2,y:Math.min(size.top-26,196+Math.max(0,(bounds.h-lines.length*leading)/2)+lines.length*leading+18)})};
    out.scene={id:'hole-standing',text:value,kind:'choice',page:0,pages:1};
  }else logSheet(c,rows,{h:24+logDateHeight(logDateRows(c))+rows.reduce((h,row)=>h+row.height,0)});
  for(const card of cards)if(!placement(card,size).k||placement(card,size).k===1)drawDealt(c,card,size,now);
  for(const card of cards)if(placement(card,size).k<1)drawDealt(c,card,size,now);
  for(const card of cards) {
    const role=card.need?' (need)':card.painLook!=='none'?' (pain)':'';
    const label=card.faceDown?`face-down card${role}`:`${card.action.label}${role}${card.action.choiceLocked?' (insufficient choice)':''}`;
    control(out,label,card.x,card.y,size.w,size.h,card.action.id,card.available!==false);
    out.cards.push({action:card.action.id,x:card.x,y:card.y,w:size.w,h:size.h,flashSeed:card.flashSeed,available:card.available,inkPadding:card.painLook!=='none'?8:0});
    Object.assign(out.buttons.at(-1),{raptureCost:card.cost,pain:card.painLook,need:card.needLook,faceDown:card.faceDown,choiceLocked:card.action.choiceLocked===true});
  }
  // Passing remains available without a permanent hand on the table.
  if(!encounter)quiet(c,out,'check',width-88,height-52,72,48,'check');
  out.animated=cards.some(card=>isAnimated(card.needLook));
  showDeal({turn:dealt.turn,cards:dealt.cards,pool:dealWeights(state)});
  out.text = encounter?MESSAGES['hole-standing']:[dateBar(),log].filter(Boolean).join('\n');
}
function draw() {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = width; c.canvas.height = height; box(c, 0, 0, width, height);
  const out = { buttons: [], cards:[], text: '', scene: null };
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
  const graySource=c.photoAreas?.length?new Uint32Array(c.getImageData(0,0,width,height).data.buffer):null;
  const raster=monochrome(c,width,height);
  // Preserve photo tones only; all text, icons and borders still use the 1-bit pass.
  if(graySource){const source=graySource;
    for(const a of c.photoAreas)for(let y=Math.max(0,Math.ceil(a.y));y<Math.min(height,Math.floor(a.y+a.h));y++)
      for(let x=Math.max(0,Math.ceil(a.x));x<Math.min(width,Math.floor(a.x+a.w));x++)raster[y*width+x]=source[y*width+x];}
  return { pixels: tintHungerNumber(greyUnavailableCards(raster,width,height,out.cards),width,height,out.hungerNumber), layout: out };
}
function paint(value) { ctx.putImageData(new ImageData(new Uint8ClampedArray(value.buffer, value.byteOffset, value.byteLength), width, height), 0, 0); }
function positionClock(){const rect=canvas.getBoundingClientRect();$('story-clock').style.top=`${Math.max(50,rect.top+50)}px`;$('story-clock').style.right=`${Math.max(10,innerWidth-rect.right+10)}px`;}
function installControls() {
  $('story-clock').hidden=state.phase!=='playing';const clock=gameClock(UI,state.elapsedMinutes);$('story-date').textContent=clock.date;$('story-time').textContent=clock.time;positionClock();
  // A need is eligible only once its marked, interactive card has been painted.
  if(screen==='main'&&!editorPreview&&!document.hidden&&!busy){
    const next=presentHand(state,layout.buttons.filter(b=>b.need&&b.need!=='none').map(b=>b.action));
    if(next!==state){state=next;save();}
  }
  $('controls').replaceChildren();
  for (const b of layout.buttons) {
    const el = document.createElement('button'); el.textContent = b.label; el.setAttribute('aria-label', b.label);
    el.dataset.action = b.action; el.disabled = !b.available;
    if(b.raptureCost!==undefined){el.dataset.raptureCost=String(b.raptureCost);el.dataset.undesirable=String(b.raptureCost>0);}
    if(b.choiceLocked)el.dataset.choiceLocked='true';
    Object.assign(el.style, { left: `${b.x}px`, top: `${b.y}px`, width: `${b.w}px`, height: `${b.h}px` });
    el.onclick = event => activate(b.action,event.detail?{x:(event.clientX-canvas.getBoundingClientRect().left)*width/canvas.getBoundingClientRect().width,y:(event.clientY-canvas.getBoundingClientRect().top)*height/canvas.getBoundingClientRect().height}:null); $('controls').append(el);
  }
  $('narration').textContent = [layout.text, ...presentedStats(state,HUNGER_INDICATOR).map(([id,value])=>`${STAT_LABELS[id]} ${Math.round(value*100)/100}${!editorPreview&&headerChangeAmounts(state,HUNGER_INDICATOR)[id]?' ('+signedChange(headerChangeAmounts(state,HUNGER_INDICATOR)[id])+')':''}`)].filter(Boolean).join('\n');
}
function redraw() {
  $('settings-title').textContent=UI.settings;$('restart').textContent=UI.restart;
  $('settings').querySelector('form button').textContent=UI.return;
  $('sound').parentElement.lastChild.textContent=' PC sounds';$('motion').parentElement.lastChild.textContent=' '+UI.motion;
  const frame = draw(); pixels = frame.pixels; layout = frame.layout; paint(pixels); installControls();
  queueAmbient();
}
function resize() {
  stopStatCue();cardAudio.cancel();
  animationId++; anim=null; heldStats=null; busy = false;
  lastViewportWidth=document.documentElement.clientWidth;
  ({width,height}=phoneScreen(lastViewportWidth,window.visualViewport?.height||innerHeight));
  canvas.width=width;canvas.height=height;
  $('stack').style.width = `${width}px`; $('stack').style.height = `${height}px`; redraw();
}
async function dissolve(from,to,id){
  if(prefs.reduceMotion){paint(to);return;}
  const w=width,h=height,buffer=new Uint32Array(to.length);
  await animateFrames({duration:260,isCurrent:()=>id===animationId&&w===width&&h===height,
    draw:elapsed=>paint(composeFrame(from,to,w,h,elapsed/260,'dissolve',buffer))});
}
// Time-based frames, so an animation still finishes if the window is in the background.
async function play(kind,ids,duration){
  const token=animationId;busy=true;$('controls').replaceChildren();
  await animateFrames({duration,isCurrent:()=>token===animationId,draw:elapsed=>{
    anim={kind,ids,p:elapsed/duration};const frame=draw();pixels=frame.pixels;paint(pixels);
  }});
  if(token===animationId){anim=null;busy=false;}
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
  stopStatCue();sceneSince=performance.now();
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
  // Signed changes appear with the description; only running totals wait.
  const pendingStats=presentedStats(state,HUNGER_INDICATOR).map(([stat,value])=>[stat,previousStats[stat]??feedback.find(c=>c.stat===stat)?.from??value]);
  const pendingChanges=headerChangeAmounts(state,HUNGER_INDICATOR);
  $('narration').textContent=[frame.layout.text,...pendingStats.map(([id,value])=>`${STAT_LABELS[id]} ${Math.round(value*100)/100}${pendingChanges[id]?' ('+signedChange(pendingChanges[id])+')':''}`)].filter(Boolean).join('\n');
  const targets=Object.fromEntries(feedback.map(f=>[f.stat,{x:headerStatX(f.stat,width),y:headerStatLayout(width).transferY,viewportWidth:width}]));
  const fallback=previousLayout.cards.find(c=>c.action===action)||lastChoiceSource||{...choiceGrid(2).cell(0),action:selected};
  const transfers=transferCards(feedback,amounts,choiceSources,fallback,targets);
  heldStats=pendingStats;
  const held=draw().pixels;heldStats=null;
  cardAudio.cancel();
  void cardAudio.transition({outgoing:previousLayout.cards,incoming:frame.layout.cards,selected:action,transfers,startedAt,reduced:prefs.reduceMotion,clicked:true});
  try {
    if(cardsChanged||feedback.length){
      await playCardTransition({transition:new CardTransition({from,to:frame.pixels,held,width,height,
        outgoing:previousLayout.cards,incoming:frame.layout.cards,selected:action,transfers,reduced:prefs.reduceMotion,selectionPoint,decision:frame.layout.decision}),context:ctx,startedAt,isCurrent:()=>id===animationId});
    }else await dissolve(from,frame.pixels,id);
  }finally {
    if(id===animationId){busy=false;startAttributeFeedback(before,state);redraw();}
  }
}

function pause() { stopStatCue();save(); audio.stop();cardAudio.stop(); if (busy) { animationId++; busy = false; redraw(); }else redraw(); }
function restart() {
  stopStatCue();cardAudio.stop();
  animationId++; busy = false; anim=null;choiceSources={};lastChoiceSource=null; audio.stop();
  // A reversible restart retains the previous authored playthrough too.
  try { if(!testBackup)storage.setItem(`${SAVE_KEY}.before-restart`, serializeGame(state)); } catch {}
  state = createGame(); screen = 'main';actionPage=0;textPage=0;logPage=0;sceneSince=performance.now(); save(); $('settings').close(); redraw();
}
// Lab shortcuts: replay the real rules to reach a screen, as the editor's test play does.
function labJump(where) {
  stopStatCue();cardAudio.cancel();animationId++;busy=false;
  let next=createGame();
  const run=(id,read=true)=>{const count=next.events.filter(e=>e.id===id).length;for(let i=0;i<300&&next.events.filter(e=>e.id===id).length===count;i++){
    if(!hand(next).cards.some(c=>c.action.id===id)){next=choose(next,'check');while(next.message)next=choose(next,'dismiss-message');continue;}
    next=choose(next,id);if(currentWarning(next))next=choose(next,'warn-yes');if(read)while(next.message)next=choose(next,'dismiss-message');
  }};
  if(where!=='intro')next=choose(next,'skip-intro');
  if(where==='groceries'||where==='dishes')run('groceries');
  if(where==='dishes')run('dishes');
  if(STORY_ENABLED&&['night','hunger','hole'].includes(where)){
    run('groceries');run('dishes');run('cook');run('sleep',where!=='night');
    if(where!=='night'){
      for(let i=0;i<60&&!next.story.strange;i++){
        next=choose(next,'check');while(next.message)next=choose(next,'dismiss-message');
        if(next.story.hungry&&hand(next).cards.some(c=>c.action.id==='cook'))run('cook',false);
        while(next.message&&!(where==='hunger'&&next.message==='body-still-hungry'))next=choose(next,'dismiss-message');
      }
      if(where==='hole')run('go-hole');
    }
  }
  state=next;screen='main';actionPage=0;textPage=0;logPage=0;sceneSince=performance.now();save();redraw();
}
// Breathing borders and tethers use the same cadence as every transition.
let ambientFrame=null;
function queueAmbient(){
  if(ambientFrame!==null||busy||statCueTimer||!layout?.animated||prefs.reduceMotion||document.hidden)return;
  ambientFrame=requestAnimationTick(()=>{
    ambientFrame=null;
    if(busy||statCueTimer||!layout?.animated||prefs.reduceMotion||document.hidden)return;
    const frame=draw();pixels=frame.pixels;paint(pixels);queueAmbient();
  });
}

try {
  state = restoreGame(storage.getItem(SAVE_KEY)) || createGame();
  audio.prepare();cardAudio.prepare();
  if(['localhost','127.0.0.1'].includes(location.hostname))await loadCardPhotos();
  await Promise.all([...new Set(['home',...Object.values(STAT_ICONS)])].map(name => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => { icons[name] = image; resolve(); };
    image.onerror = () => reject(Error(`Missing icon: ${name}`)); image.src = `icons/${name}.png`;
  })));
  $('sound').checked=prefs.cardSound;$('sound').disabled=false;$('sound').parentElement.hidden=false;
  $('sound').onchange=event=>{prefs.cardSound=event.target.checked;cardAudio.setEnabled(prefs.cardSound);savePrefs();};
  $('motion').checked = prefs.reduceMotion;
  $('motion').onchange = event => { prefs.reduceMotion = event.target.checked; savePrefs(); };
  const setFrameRate=value=>{
    prefs.animationFPS=animationClock.setFPS(value);
    $('animation-fps').value=String(prefs.animationFPS);$('animation-fps-number').value=String(prefs.animationFPS);
    savePrefs();
  };
  $('animation-fps').value=String(prefs.animationFPS);$('animation-fps-number').value=String(prefs.animationFPS);
  $('animation-fps').oninput=event=>setFrameRate(event.target.value);
  $('animation-fps-number').oninput=event=>{if(event.target.value!==''&&event.target.validity.valid)setFrameRate(event.target.value);};
  $('animation-fps-number').onchange=event=>setFrameRate(event.target.value);

  $('restart').onclick = restart;
  resize(); save(); $('boot').remove(); addEventListener('resize', resize);addEventListener('scroll',positionClock,{passive:true});
  window.visualViewport?.addEventListener('resize',resize);
  new ResizeObserver(()=>{if(document.documentElement.clientWidth!==lastViewportWidth)resize();}).observe(document.documentElement);
  addEventListener('pagehide', pause); addEventListener('alignmentpause', pause);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause();else redraw(); });
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
    if (currentWarning(state)?.prompt && !busy && ['y','n'].includes(event.key.toLowerCase())) { event.preventDefault(); activate(event.key.toLowerCase()==='y'?'warn-yes':'warn-no'); return; }
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
  window.alignmentSnapshot = () => ({ state: structuredClone(state), screen: state.phase === 'intro' || state.message || currentWarning(state) ? 'scene' : STORY_ENABLED&&state.story.encounter?'choice':screen,
    scene: layout.scene, busy, renderer: 'shared-granola-format', transitionMs:presentationDuration(layout?.cards?.length||0,prefs.reduceMotion), cardEntryStaggerMs:250, content: 'human-authored', width, height,
    animationFPS:prefs.animationFPS, fonts: { story: STORY_FONT, body: BODY_FONT, small: SMALL_FONT }, revealedStats: Object.keys(state.stats),
    controls: layout.buttons, saveFailed, logs: state.logs.map(id => LOGS[id]), message: MESSAGES[state.message] || null });
  // The lab never mounts the writing editor, so it cannot change the manuscript.
  if(['localhost','127.0.0.1'].includes(location.hostname))mountLab({actions:()=>ACTIONS.map(a=>({id:a.id,label:a.label})),jump:labJump,
    changed:()=>{sceneSince=performance.now();redraw();},resize,
    motion:()=>prefs.reduceMotion,setMotion:value=>{prefs.reduceMotion=value;$('motion').checked=value;savePrefs();sceneSince=performance.now();redraw();}});
  const previewParams=new URLSearchParams(location.search),previewTarget=previewParams.get('preview');
  if(STORY_ENABLED&&previewParams.has('test')&&['night','hunger','hole'].includes(previewTarget))labJump(previewTarget);
  $('motion').addEventListener('change',()=>{sceneSince=performance.now();redraw();});
} catch (error) { $('boot').textContent = 'Unable to open the stack. ' + error.message; console.error(error); }
