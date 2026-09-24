import { SCRIPT_ID, INTRO, ACTIONS, LOGS, MESSAGES, MESSAGE_LINKS, CHOICE_WARNINGS, REQUIRE_ACTION_LOGS, FIRST_PURCHASE_MESSAGE, INITIAL_VALUES, SCHEDULED_EVENTS, UI } from './author-content.mjs';
import {DEFAULT_START_HOUR} from './story-clock.mjs';
import { cardChoices } from './author-schema.mjs';
import { restoreGame as restoreLegacy, BASELINE as LEGACY_BASELINE, TIME_RATES, TASK_MINUTES, advanceTaskTime } from './author-legacy.mjs';
import {STAT_KEYS,LOG_STAT_KEYS} from './game-stats.mjs';
import {resolveOutcome,seedFrom} from './action-outcomes.mjs';
import {isNeed,needCost,painAmount,painLevel} from './card-rules.mjs';
export { TIME_RATES, TASK_MINUTES, advanceTaskTime };
// Retain Choice's established starting value from the original game; it stays hidden until revealed.
export const BASELINE = Object.freeze({...LEGACY_BASELINE,choice:38});
export const SAVE_KEY = 'alignment.human-authored.v1', SAVE_VERSION = 3;
const clone = structuredClone;
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(id);
const statKeys = STAT_KEYS;
const round = n => Math.round(n * 1e6) / 1e6;
const initialValues=()=>({...BASELINE,...INITIAL_VALUES});
const emptyOrigin = () => ({ values:initialValues(), completed:[], logs:[], revealed:[], elapsedMinutes:0, gainedRapture:false, message:null });
export const createGame = ({randomSeed=Math.floor(Math.random()*4294967296)}={}) => ({ version:SAVE_VERSION, script:SCRIPT_ID, randomSeed, phase:'intro', node:INTRO[0].id, trail:[],
  origin:emptyOrigin(), events:[], values:initialValues(), completed:[], stats:{}, logs:[], elapsedMinutes:0, gainedRapture:false, message:null, hesitation:null });
export const currentNode = state => { const index = Math.max(0,INTRO.findIndex(n=>n.id===state.node)); return {...INTRO[index],index}; };
function prerequisitesMet(state,action) {
  const seen=new Set();let cursor=action;
  while(cursor.requires) {
    if(seen.has(cursor.requires)||!state.completed.includes(cursor.requires))return false;
    seen.add(cursor.requires);cursor=ACTIONS.find(a=>a.id===cursor.requires);if(!cursor)return false;
  }
  return true;
}
export const visibleActions = state => ACTIONS.map(a=>resolveOutcome(state,a)).filter(a=>a.enabled!==false && a.label.trim() &&
  prerequisitesMet(state,a) && (!a.unavailableAfter || !state.completed.includes(a.unavailableAfter)) && (a.repeatable || !a.hideWhenDone || !state.completed.includes(a.id)));
export const availableActions = state => state.phase==='playing' && state.events.length<5000 && !state.message && !state.hesitation?.visible
  ? visibleActions(state).filter(a=>{
    if(state.completed.includes(a.id)&&!a.repeatable)return false;
    const hasLog=LOGS[a.log]?.trim()||a.statOnlyLog===true&&taskReceipt(state,a).changes.some(c=>LOG_STAT_KEYS.includes(c.stat)&&!(c.stat==='rapture'&&c.source==='time'));
    return (!REQUIRE_ACTION_LOGS||hasLog)&&(hasLog||intertitleSequence(messageForAction(a,state)).some(c=>MESSAGES[c.id]?.trim()||c.log));
  }) : [];
export const hasGainedRapture = state => state.gainedRapture === true;
// Legacy origins predate receipts and contain groceries as their only purchase.
export const hasPurchased = state => state.origin.completed.includes('groceries')||state.events.some(e=>e.delta.money<0);
const introducesMoney = (action,state) => !!FIRST_PURCHASE_MESSAGE&&!hasPurchased(state)&&(action.effects.money||0)<0&&taskOutcome(state,action).money<state.values.money&&
  intertitleSequence(FIRST_PURCHASE_MESSAGE).some(c=>MESSAGES[c.id]?.trim());
export const messageForAction = (action,state) => introducesMoney(action,state)?FIRST_PURCHASE_MESSAGE:action.firstGainMessage && (action.effects.rapture||0)>0 && MESSAGES[action.firstGainMessage]?.trim() && !hasGainedRapture(state)
  ? action.firstGainMessage : action.message || null;
function taskReceipt(state,action) {
  action=resolveOutcome(state,action);
  const after=advanceTaskTime(state.values,action.minutes);
  // Time still advances hunger for activities exempt from duration-based rapture loss.
  if(action.drainRapture===false)after.rapture=state.values.rapture;
  const changes=[];
  const record=(stat,amount,source)=>{amount=round(amount);if(amount)changes.push({stat,amount,source});};
  for(const stat of statKeys)record(stat,after[stat]-state.values[stat],'time');
  for(const [key,amount] of Object.entries(action.effects)) {
    const before=after[key];after[key]=round(key==='money'?before+amount:Math.max(0,before+amount));record(key,after[key]-before,'action');
  }
  return {after,changes};
}
export const taskOutcome = (state,action) => taskReceipt(state,action).after;
export const raptureCost = (state,action) => round(Math.max(0,state.values.rapture-taskOutcome(state,action).rapture));
export function cardMarks(state,action) {
  const revealed=Object.hasOwn(state.stats,'rapture'),amount=painAmount(state,action,taskOutcome(state,action));
  return {need:revealed&&isNeed(action),pain:revealed&&amount>0,level:painLevel(amount)};
}
export function presentCards(state,ids) {
  if(state.phase!=='playing'||state.message||state.hesitation?.visible)return state;
  const allowed=availableActions(state).filter(a=>cardMarks(state,a).need).map(a=>a.id);
  const presentedNeeds={turn:state.events.length,ids:ids.filter(id=>allowed.includes(id))};
  return JSON.stringify(state.presentedNeeds)===JSON.stringify(presentedNeeds)?state:{...state,presentedNeeds};
}
const warningCount = () => CHOICE_WARNINGS?.cost ? 2 : 1;
export function currentWarning(state) {
  if(!state.hesitation?.visible||!CHOICE_WARNINGS)return null;
  const {stage,cost}=state.hesitation,id=CHOICE_WARNINGS[stage===1?'question':'cost'];
  return {id,text:(MESSAGES[id]||'').replace(/\bX\b/g,String(cost)),bold:stage===1,...MESSAGE_LINKS[id],prompt:warningCount()===1,revealsRapture:stage===warningCount()};
}
function intertitleSequence(message) {
  const cards=[];let cursor=message;
  while(cursor&&!cards.some(card=>card.id===cursor)) {
    const link=MESSAGE_LINKS[cursor]||{};
    cards.push({id:cursor,log:LOGS[link.log]?.trim()?link.log:null});cursor=link.next;
  }
  // Clearing an outcome's text removes that screen. Keep authored pauses inside a linked sequence.
  while(cards.length&&!MESSAGES[cards.at(-1).id]?.trim()&&!cards.at(-1).log)cards.pop();
  return cards;
}
export function previewIntertitle(id) {
  const state=choose(createGame(),'skip-intro'),cards=intertitleSequence(id);
  if(!cards.length)return state;
  state.events.push({id:'editor-preview',minutes:0,delta:Object.fromEntries(statKeys.map(k=>[k,0])),reveal:[],log:null,message:id,earnedRapture:false,cards,seen:1});
  Object.assign(state,totals(state.origin,state.events,state.phase));state.message=id;return state;
}
function totals(origin,events,phase) {
  const values={...origin.values}, completed=[...origin.completed], logs=phase==='intro'?[]:['opening',...origin.logs.filter(id=>id!=='opening')];
  const revealed=new Set(origin.revealed); let elapsedMinutes=origin.elapsedMinutes, gainedRapture=origin.gainedRapture;
  for (const e of events) {
    for (const key of Object.keys(values)) values[key]=round(values[key]+(e.delta[key]??0));
    if(!completed.includes(e.id))completed.push(e.id); elapsedMinutes+=e.minutes; gainedRapture ||= e.earnedRapture;
    if(!e.revealAtEnd||e.resultsDismissed||e.revealOnCard&&e.seen>=e.revealOnCard)e.reveal.forEach(key=>revealed.add(key)); if(e.log) logs.push(e.log);
    if(e.moneyRevealed)revealed.add('money');
    for(const card of (e.cards||[]).slice(0,e.seen||0))if(card.log)logs.push(card.log);
  }
  return {values,completed,logs,elapsedMinutes,gainedRapture,stats:Object.fromEntries([...revealed].map(key=>[key,values[key]]))};
}
export function choose(state,action) {
  const next=clone(state);
  if(state.phase==='intro') {
    const node=currentNode(state), choices=cardChoices(node);
    let target;
    if(action==='skip-intro')target='@begin';
    else if(action==='begin'&&node.begin)target=node.next||'@begin';
    else if(action==='back'&&next.trail.length) {next.node=next.trail.pop();return next;}
    else if(choices.length) target=choices.find(c=>c.id===action||`choice:${c.id}`===action)?.target;
    else if(action==='next'&&!node.begin) target=node.next||INTRO[node.index+1]?.id;
    if(!target)return state;
    if(target==='@begin') {next.phase='playing';next.logs=['opening'];next.trail=[];return next;}
    if(!INTRO.some(n=>n.id===target))return state;
    next.trail.push(state.node);next.trail=next.trail.slice(-128);next.node=target;return next;
  }
  if(action==='dismiss-message') {
    if(state.hesitation?.visible){next.hesitation.visible=false;return next;}
    if(!state.message)return state;
    const event=next.events.at(-1);
    if(event?.moneyIntroduction)event.moneyRevealed=true;
    if(event?.cards && event.seen<event.cards.length)next.message=event.cards[event.seen++].id;
    else {next.message=null;if(event?.revealAtEnd)event.resultsDismissed=true;}
    Object.assign(next,totals(next.origin,next.events,next.phase));return next;
  }
  let confirmed=false;
  if(action==='warn-no'){if(!state.hesitation?.visible)return state;next.hesitation=null;return next;}
  if(action==='warn-yes'){if(!state.hesitation?.visible)return state;action=state.hesitation.action;confirmed=true;}
  const selected=availableActions(confirmed?{...state,hesitation:null}:state).find(a=>a.id===action); if(!selected)return state;
  const {after,changes}=taskReceipt(state,selected),cost=round(warningCount()===1?painAmount(state,selected,after):Math.max(0,state.values.rapture-after.rapture));
  if(!confirmed&&CHOICE_WARNINGS&&selected.warnRaptureLoss!==false&&cost>0&&!(warningCount()===1&&state.painWarned)) {
    const pending=state.hesitation,stage=pending?.action===selected.id&&pending.cost===cost?pending.stage:0;
    if(stage<warningCount()){next.hesitation={action:selected.id,stage:stage+1,cost,visible:true};
      if(warningCount()===1)next.painWarned=true;
      if(stage+1===warningCount()){if(!next.origin.revealed.includes('rapture'))next.origin.revealed.push('rapture');Object.assign(next,totals(next.origin,next.events,next.phase));}
      return next;
    }
  }
  next.hesitation=null;
  // Only a marked need the player actually saw can be withdrawn. Warnings and
  // reading never expose a card, charge rapture, or replay a saved charge.
  if(state.presentedNeeds?.turn===state.events.length)for(const other of availableActions({...state,hesitation:null})) {
    if(other.id===selected.id||!isNeed(other)||!state.presentedNeeds.ids.includes(other.id))continue;
    const before=after.rapture;after.rapture=round(Math.max(0,before-needCost(other)));
    if(after.rapture!==before)changes.push({stat:'rapture',amount:round(after.rapture-before),source:'action',need:other.id});
  }
  const cards=intertitleSequence(messageForAction(selected,state));
  const moneyIntroduction=introducesMoney(selected,state)&&cards.length>0;
  // Queue story-clock passages on the committed receipt, after this task's own
  // intertitles. Reading, warnings and reloads neither spend time nor fire twice.
  const fired=new Set(state.events.flatMap(e=>e.scheduledEvents||[])),start=Number(UI.logStartHour??DEFAULT_START_HOUR);
  const clockMinutes=(Number.isInteger(start)&&start>=0&&start<24?start:DEFAULT_START_HOUR)*60+state.elapsedMinutes+selected.minutes;
  const due=SCHEDULED_EVENTS.filter(e=>e.enabled!==false&&!fired.has(e.id)&&clockMinutes>=e.hour*60&&intertitleSequence(e.message).length).sort((a,b)=>a.hour-b.hour);
  for(const event of due)for(const card of intertitleSequence(event.message))if(!cards.some(c=>c.id===card.id))cards.push(card);
  const message=cards[0]?.id||null;
  const revealOnCard=selected.revealOnMessage?cards.findIndex(card=>card.id===selected.revealOnMessage)+1:0;
  next.events.push({id:selected.id,minutes:selected.minutes,delta:Object.fromEntries(statKeys.map(key=>[key,round(after[key]-state.values[key])])),
    changes,
    ...(due.length?{scheduledEvents:due.map(e=>e.id)}:{}),
    ...(selected.repeatable?{repeatable:true}:{}),...(selected.outcome?{outcome:selected.outcome}:{}),
    reveal:selected.reveal.filter(key=>!moneyIntroduction||key!=='money'),log:LOGS[selected.log]?.trim()?selected.log:null,message,earnedRapture:(selected.effects.rapture||0)>0,
    ...(moneyIntroduction?{moneyIntroduction:true,moneyRevealed:false}:{}),
    ...((selected.revealAtEnd||selected.revealOnMessage)&&message?{revealAtEnd:true,resultsDismissed:false,...(revealOnCard?{revealOnCard}:{})}:{}),
    ...(message && (cards.length>1||cards[0].log||moneyIntroduction||revealOnCard)?{cards,seen:1}:{})});
  Object.assign(next,totals(next.origin,next.events,next.phase));next.message=message;
  return next;
}
function migrate(old) {
  const legacy=restoreLegacy(JSON.stringify(old));if(!legacy)return null;
  let values={...BASELINE};
  for(const [index,id] of legacy.completed.entries()) {
    if(index>=legacy.timedFrom) values=advanceTaskTime(values,TASK_MINUTES[id]);
    if(id==='dishes'&&index<legacy.timedFrom)values.rapture=Math.max(0,values.rapture-2);
    if(id==='groceries')values.money-=50;
    if(id==='cook')values.rapture+=5;
  }
  const origin={values,completed:[...legacy.completed],logs:[...legacy.logs],revealed:Object.keys(legacy.stats),elapsedMinutes:legacy.elapsedMinutes,
    gainedRapture:legacy.completed.includes('cook'),message:legacy.message};
  const state={...createGame({randomSeed:seedFrom(JSON.stringify(legacy))}),phase:legacy.phase,node:legacy.node,trail:legacy.trail,origin,events:[],message:legacy.message};
  Object.assign(state,totals(origin,[],state.phase));return state;
}
export function reconcileGame(state) {
  const next=clone(state), ids=new Set(INTRO.map(n=>n.id));
  if(!ids.has(next.node))next.node=INTRO[0].id;
  next.trail=next.trail.filter(id=>ids.has(id));
  if(next.message&&!Object.hasOwn(MESSAGES,next.message))next.message=null;
  if(next.message&&!MESSAGES[next.message]?.trim()&&!MESSAGE_LINKS[next.message]?.next&&!MESSAGE_LINKS[next.message]?.log)next.message=null;
  const pending=next.hesitation,action=pending&&ACTIONS.find(a=>a.id===pending.action);
  if(pending&&(!CHOICE_WARNINGS||!action||action.warnRaptureLoss===false||!availableActions({...next,hesitation:null}).some(a=>a.id===action.id)||round(warningCount()===1?painAmount(next,resolveOutcome(next,action),taskOutcome(next,action)):raptureCost(next,action))!==pending.cost))next.hesitation=null;
  if(next.hesitation)next.hesitation.stage=Math.min(next.hesitation.stage,warningCount());
  if(next.hesitation?.stage===warningCount()&&!next.origin.revealed.includes('rapture')){next.origin.revealed.push('rapture');Object.assign(next,totals(next.origin,next.events,next.phase));}
  const event=next.events.at(-1);
  if(event?.revealAtEnd&&!event.resultsDismissed&&!next.message){event.resultsDismissed=true;Object.assign(next,totals(next.origin,next.events,next.phase));}
  if(event?.moneyIntroduction&&!event.moneyRevealed&&next.message!==event.cards[0].id){event.moneyRevealed=true;Object.assign(next,totals(next.origin,next.events,next.phase));}
  return next;
}
export function restoreGame(raw) {
  try {
    const v=JSON.parse(raw);if(!v||v.script!==SCRIPT_ID)return null;
    if([1,2].includes(v.version)){const migrated=migrate(v);return migrated?reconcileGame(migrated):null;}
    const list=xs=>Array.isArray(xs)&&xs.length<=5000&&xs.every(validId);
    const numbers=(o,nonnegative=false)=>o&&typeof o==='object'&&!Array.isArray(o)&&[4,5].includes(Object.keys(o).length)&&Object.keys(o).every(k=>statKeys.includes(k))&&statKeys.every(k=>k==='choice'&&!Object.hasOwn(o,k)||Number.isFinite(o[k])&&Math.abs(o[k])<=1e9&&(!nonnegative||k==='money'||o[k]>=0));
    const o=v.origin;
    const pending=v.hesitation??null;
    if(v.randomSeed!==undefined&&(!Number.isInteger(v.randomSeed)||v.randomSeed<0||v.randomSeed>4294967295))return null;
    if(pending&&(!validId(pending.action)||![1,2].includes(pending.stage)||!Number.isFinite(pending.cost)||pending.cost<=0||pending.cost>1e9||typeof pending.visible!=='boolean'))return null;
    if(v.version!==SAVE_VERSION||!['intro','playing'].includes(v.phase)||!validId(v.node)||!list(v.trail)||v.trail.length>128||
      !o||!numbers(o.values,true)||!list(o.completed)||!list(o.logs)||!Array.isArray(o.revealed)||o.revealed.some(k=>!statKeys.includes(k))||
      !Number.isFinite(o.elapsedMinutes)||o.elapsedMinutes<0||typeof o.gainedRapture!=='boolean'||!(o.message===null||validId(o.message))||
      !Array.isArray(v.events)||v.events.length>5000)return null;
    for(const e of v.events)if(!e||!validId(e.id)||!Number.isFinite(e.minutes)||e.minutes<0||e.minutes>10080||!numbers(e.delta)||
      !Array.isArray(e.reveal)||e.reveal.some(k=>!statKeys.includes(k))||!(e.log===null||validId(e.log))||
      !(e.message===null||validId(e.message))||typeof e.earnedRapture!=='boolean')return null;
    const completedIds=new Set(o.completed);if(completedIds.size!==o.completed.length)return null;
    const scheduledIds=new Set();
    for(const e of v.events) {
      if(e.revealOnCard!==undefined&&(!e.revealAtEnd||!Number.isInteger(e.revealOnCard)||e.revealOnCard<1||!e.cards||e.revealOnCard>e.cards.length))return null;
      if(e.revealAtEnd!==undefined||e.resultsDismissed!==undefined) {
        if(e.revealAtEnd!==true||typeof e.resultsDismissed!=='boolean'||!e.message||
          !e.resultsDismissed&&(e!==v.events.at(-1)||v.message===null)||e.resultsDismissed&&e===v.events.at(-1)&&v.message!==null)return null;
      }
      if(e.scheduledEvents!==undefined) {
        if(!list(e.scheduledEvents)||!e.scheduledEvents.length||!e.message)return null;
        for(const id of e.scheduledEvents){if(scheduledIds.has(id))return null;scheduledIds.add(id);}
      }
      if(e.repeatable!==undefined&&e.repeatable!==true||e.outcome!==undefined&&!validId(e.outcome)||completedIds.has(e.id)&&!e.repeatable)return null;
      completedIds.add(e.id);
    }
    for(const e of v.events)if(e.cards!==undefined && (!Array.isArray(e.cards)||!e.cards.length||e.cards.length>5000||
      !Number.isInteger(e.seen)||e.seen<1||e.seen>e.cards.length||e.cards[0]?.id!==e.message||
      e.cards.some(c=>!c||!validId(c.id)||!(c.log===null||validId(c.log)))||new Set(e.cards.map(c=>c.id)).size!==e.cards.length))return null;
    for(const [index,e] of v.events.entries())if(e.moneyIntroduction!==undefined||e.moneyRevealed!==undefined) {
      if(e.moneyIntroduction!==true||typeof e.moneyRevealed!=='boolean'||e.delta.money>=0||!e.cards||e.reveal.includes('money')||
        o.completed.includes('groceries')||v.events.slice(0,index).some(prior=>prior.delta.money<0)||
        !e.moneyRevealed&&(e.seen!==1||index!==v.events.length-1||v.message!==e.message))return null;
    }
    for(const e of v.events)if(e.changes!==undefined) {
      if(!Array.isArray(e.changes)||e.changes.length>10||e.changes.some(c=>!c||!statKeys.includes(c.stat)||!Number.isFinite(c.amount)||c.amount===0||Math.abs(c.amount)>1e9))return null;
      if(e.changes.some(c=>c.source!==undefined)&&e.changes.some(c=>!['time','action'].includes(c.source)||c.source==='time'&&!(c.stat==='rapture'&&c.amount<0||c.stat==='hunger'&&c.amount>0)))return null;
      for(const key of statKeys)if(round(e.changes.filter(c=>c.stat===key).reduce((sum,c)=>sum+c.amount,0))!==(e.delta[key]??0))return null;
    }
    if(!Object.hasOwn(o.values,'choice')&&(o.revealed.includes('choice')||v.events.some(e=>(e.delta.choice||0)!==0||e.reveal.includes('choice'))))return null;
    const result=totals(o,v.events,v.phase);
    if(new Set(result.completed).size!==result.completed.length||!numbers(result.values,true))return null;
    for(const key of ['values','completed','logs','stats','elapsedMinutes','gainedRapture'])if(JSON.stringify(v[key])!==JSON.stringify(result[key]))return null;
    const last=v.events.at(-1),activeMessage=last?.cards?last.cards[last.seen-1].id:last?.message||o.message;
    if(v.message!==null&&v.message!==activeMessage)return null;
    if(v.phase==='intro'&&(result.completed.length||v.message||result.elapsedMinutes||result.logs.length))return null;
    if(pending&&(v.phase!=='playing'||v.message||result.completed.includes(pending.action)&&!ACTIONS.find(a=>a.id===pending.action)?.repeatable&&!v.events.some(e=>e.id===pending.action&&e.repeatable)))return null;
    // Add the dormant stat only after validating the original four-stat receipt totals.
    const origin=clone(o),events=clone(v.events);origin.values.choice??=BASELINE.choice;for(const e of events)e.delta.choice??=0;
    const presentedNeeds=v.presentedNeeds&&Number.isInteger(v.presentedNeeds.turn)&&v.presentedNeeds.turn>=0&&list(v.presentedNeeds.ids)
      ?{turn:v.presentedNeeds.turn,ids:[...new Set(v.presentedNeeds.ids)]}:undefined;
    return reconcileGame({...(presentedNeeds?{presentedNeeds}:{}),...(v.painWarned===true?{painWarned:true}:{}),version:SAVE_VERSION,script:SCRIPT_ID,randomSeed:v.randomSeed??seedFrom(JSON.stringify(o.values)),phase:v.phase,node:v.node,trail:[...v.trail],origin,events,...totals(origin,events,v.phase),message:v.message,hesitation:pending?{action:pending.action,stage:pending.stage,cost:pending.cost,visible:pending.visible}:null});
  }catch{return null;}
}
export function serializeGame(state) {const raw=JSON.stringify(state);if(!restoreGame(raw))throw new Error('Invalid game state');return raw;}
