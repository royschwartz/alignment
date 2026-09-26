// Mechanics reference: ../design/CHOICE_LOGIC.md (shared rules and every choice entry).
import { DOCUMENT, SCRIPT_ID, INTRO, ACTIONS, LOGS, MESSAGES, MESSAGE_LINKS, CHOICE_WARNINGS, REQUIRE_ACTION_LOGS, FIRST_PURCHASE_MESSAGE, INITIAL_VALUES, SCHEDULED_EVENTS, UI, STORY_RULES } from './author-content.mjs';
import {storyTotals,storyVisible,storyPlayable,resolveStoryAction,storyReceipt,storyMessageIds,validStoryReceipt} from './story-rules.mjs';
import {orderOpeningChoices} from './opening-flow.mjs';
import {firstNightState} from './first-night.mjs';
import {contextAvailable} from './choice-availability.mjs';
import {selectChoiceDeal} from './choice-deal.mjs';
import {DEFAULT_START_HOUR} from './story-clock.mjs';
import { cardChoices } from './author-schema.mjs';
import { restoreGame as restoreLegacy, BASELINE as LEGACY_BASELINE, TIME_RATES, TASK_MINUTES, advanceTaskTime } from './author-legacy.mjs';
import {STAT_KEYS,LOG_STAT_KEYS} from './game-stats.mjs';
import {resolveOutcome,seedFrom} from './action-outcomes.mjs';
export { TIME_RATES, TASK_MINUTES, advanceTaskTime };
// Retain Choice's established starting value from the original game; it stays hidden until revealed.
export const BASELINE = Object.freeze({...LEGACY_BASELINE,choice:38});
export const SAVE_KEY = 'alignment.human-authored.v1', SAVE_VERSION = 3;
const clone = structuredClone;
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(id);
const statKeys = STAT_KEYS;
const round = n => Math.round(n * 1e6) / 1e6;
const initialValues=()=>({...BASELINE,...INITIAL_VALUES});
const emptyOrigin = () => ({ values:initialValues(), completed:[], logs:[], revealed:[], elapsedMinutes:0, gainedRapture:false, message:null,
  ...(DOCUMENT.startingItems?{items:[...DOCUMENT.startingItems]}:{}),
  ...(STORY_RULES?{portions:STORY_RULES.startingPortions,joints:STORY_RULES.startingJoints}:{}),
  ...(STORY_RULES?.startingFrozenPortions!==undefined?{frozenPortions:STORY_RULES.startingFrozenPortions}:{}),
  ...(STORY_RULES?.openingFlow?.enabled?{openingFlow:1}:{}) });
export const createGame = ({randomSeed=Math.floor(Math.random()*4294967296)}={}) => ({ version:SAVE_VERSION, script:SCRIPT_ID, randomSeed, phase:'intro', node:INTRO[0].id, trail:[],
  origin:emptyOrigin(), events:[], values:initialValues(), completed:[], stats:{}, logs:[], elapsedMinutes:0, gainedRapture:false, message:null, hesitation:null,
  ...(STORY_RULES?{story:storyTotals(emptyOrigin(),[],STORY_RULES)}:{}) });
export const currentNode = state => { const index = Math.max(0,INTRO.findIndex(n=>n.id===state.node)); return {...INTRO[index],index}; };
function prerequisitesMet(state,action) {
  const seen=new Set();let cursor=action;
  while(cursor.requires) {
    if(seen.has(cursor.requires)||!state.completed.includes(cursor.requires))return false;
    seen.add(cursor.requires);cursor=ACTIONS.find(a=>a.id===cursor.requires);if(!cursor)return false;
  }
  return true;
}
export function pendingScheduledEvents(state) {
  const consumed=new Set(state.events.flatMap(e=>e.scheduledEvents||[]));
  return state.events.flatMap(e=>e.queuedEvents||[]).filter(e=>!consumed.has(e.id));
}
export function hasReadPassage(state,id) {
  if(!MESSAGES[id]?.trim())return false;
  return state.events.some((event,index)=>{
    const active=index===state.events.length-1&&!!state.message;
    if(event.cards){const at=event.cards.findIndex(c=>c.id===id);return at>=0&&(at+1<event.seen||!active&&at+1<=event.seen);}
    return event.message===id&&!active;
  });
}
export const ownedItems=state=>new Set([...(state.origin.items||[]),...state.events.flatMap(event=>event.items||[])]);
export const eligibleActions = state => {
  const items=ownedItems(state);
  const event=pendingScheduledEvents(state).find(e=>SCHEDULED_EVENTS.some(current=>current.id===e.id&&current.enabled!==false)&&ACTIONS.some(a=>a.id===e.action&&a.enabled!==false&&a.label.trim()));
  if(event){const action=ACTIONS.find(a=>a.id===event.action);return [{...action,outcomes:undefined,durations:undefined,choiceLocked:false,hintMessage:undefined,minutes:0,effects:{},reveal:[],log:null,drainRapture:false,repeatable:state.completed.includes(action.id),scheduledEvent:event}];}
  const actions=orderOpeningChoices(state,ACTIONS.map(a=>resolveStoryAction(state,resolveOutcome(state,a),UI,STORY_RULES,SCHEDULED_EVENTS)).filter(a=>
    !a.eventOnly&&!SCHEDULED_EVENTS.some(e=>e.action===a.id)&&!pendingScheduledEvents(state).some(e=>e.action===a.id)&&a.enabled!==false&&a.label.trim()&&storyVisible(state,a,UI,STORY_RULES)&&
    contextAvailable(state,a,UI,STORY_RULES,DOCUMENT.choicePolicy)&&prerequisitesMet(state,a)&&(!a.requiresItems||a.requiresItems.every(id=>items.has(id)))&&
    (!a.requiresOutcome||state.events.some(e=>e.outcome===a.requiresOutcome))&&(!a.requiresMessage||hasReadPassage(state,a.requiresMessage))&&(!a.unavailableAfter||!state.completed.includes(a.unavailableAfter))&&
    (a.repeatable||!a.hideWhenDone&&!DOCUMENT.choicePolicy?.hideUnavailable||!state.completed.includes(a.id))&&
    (!DOCUMENT.choicePolicy?.hideUnavailable||storyPlayable(state,a,STORY_RULES))),Number(UI.logStartHour??DEFAULT_START_HOUR)*60+state.elapsedMinutes,STORY_RULES);
  // Live author edits can remove all restless activities. Keep the existing
  // sleep card as a recovery rather than leaving that saved night with no hand.
  if(!actions.length&&firstNightState(state,STORY_RULES,Number(UI.logStartHour??DEFAULT_START_HOUR)*60+state.elapsedMinutes)?.phase==='settle'){
    const sleep=ACTIONS.find(a=>a.id==='sleep'&&a.enabled!==false&&a.label.trim());
    if(sleep)return [resolveStoryAction(state,resolveOutcome(state,sleep),UI,STORY_RULES,SCHEDULED_EVENTS)];
  }
  return actions;
};
export const visibleActions = state => selectChoiceDeal(state,eligibleActions(state),UI,STORY_RULES,
  {...DOCUMENT.choicePolicy,threadByAction:Object.fromEntries(ACTIONS.map(a=>[a.id,a.thread]))});
export const availableActions = state => state.phase==='playing' && state.events.length<5000 && !state.message && !state.choiceHint && !state.hesitation?.visible
  ? visibleActions(state).filter(a=>{
    if(a.scheduledEvent)return true;
    if(state.completed.includes(a.id)&&!a.repeatable||!storyPlayable(state,a,STORY_RULES))return false;
    const hasLog=LOGS[a.log]?.trim()||a.statOnlyLog===true&&taskReceipt(state,a).changes.some(c=>LOG_STAT_KEYS.includes(c.stat)&&!(c.stat==='rapture'&&c.source==='time'));
    return DOCUMENT.allowEmptyDescriptions===true||(!REQUIRE_ACTION_LOGS||hasLog)&&(hasLog||actionIntertitles(a,state).some(c=>MESSAGES[c.id]?.trim()||c.log));
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
const warningCount = () => CHOICE_WARNINGS?.cost ? 2 : 1;
export function currentWarning(state) {
  if(state.choiceHint)return {id:state.choiceHint,text:MESSAGES[state.choiceHint]||'',bold:false};
  if(!state.hesitation?.visible||!CHOICE_WARNINGS)return null;
  const {stage,cost}=state.hesitation,id=CHOICE_WARNINGS[stage===1?'question':'cost'];
  return {id,text:(MESSAGES[id]||'').replace(/\bX\b/g,String(cost)),bold:stage===1,...MESSAGE_LINKS[id],revealsRapture:stage===warningCount()};
}
function actionIntertitles(action,state) {
  const message=messageForAction(action,state);
  // Shared introductions retain their full sequence. An ordinary random result
  // can use one authored card without changing that card's reference links.
  const firstGain=message===action.firstGainMessage&&(action.effects.rapture||0)>0&&!hasGainedRapture(state);
  return intertitleSequence(message,action.followMessageLinks!==false||message!==action.message||introducesMoney(action,state)||firstGain);
}
function intertitleSequence(message,followLinks=true) {
  const cards=[];let cursor=message;
  while(cursor&&!cards.some(card=>card.id===cursor)) {
    const link=MESSAGE_LINKS[cursor]||{};
    cards.push({id:cursor,log:Object.hasOwn(LOGS,link.log)?link.log:null});cursor=followLinks?link.next:null;
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
  return {values,completed,logs,elapsedMinutes,gainedRapture,stats:Object.fromEntries([...revealed].map(key=>[key,values[key]])),
    ...(STORY_RULES?{story:storyTotals(origin,events,STORY_RULES)}:{})};
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
    if(state.choiceHint){delete next.choiceHint;return next;}
    if(state.hesitation?.visible){next.hesitation.visible=false;return next;}
    if(!state.message)return state;
    const event=next.events.at(-1);
    if(event?.moneyIntroduction)event.moneyRevealed=true;
    if(event?.cards && event.seen<event.cards.length)next.message=event.cards[event.seen++].id;
    else {next.message=null;if(event?.revealAtEnd)event.resultsDismissed=true;}
    Object.assign(next,totals(next.origin,next.events,next.phase));return next;
  }
  if(!state.message&&!state.choiceHint&&!state.hesitation?.visible){
    const locked=visibleActions(state).find(a=>a.id===action&&!a.scheduledEvent&&a.choiceLocked&&a.hintMessage);
    if(locked){next.choiceHint=locked.hintMessage;if(!next.origin.revealed.includes('choice'))next.origin.revealed.push('choice');Object.assign(next,totals(next.origin,next.events,next.phase));return next;}
  }
  const selected=availableActions(state).find(a=>a.id===action); if(!selected)return state;
  const {after,changes}=taskReceipt(state,selected),cost=round(Math.max(0,state.values.rapture-after.rapture));
  if(CHOICE_WARNINGS&&selected.warnRaptureLoss!==false&&cost>0) {
    const pending=state.hesitation,stage=pending?.action===selected.id&&pending.cost===cost?pending.stage:0;
    if(stage<warningCount()){next.hesitation={action:selected.id,stage:stage+1,cost,visible:true};
      if(stage+1===warningCount()){if(!next.origin.revealed.includes('rapture'))next.origin.revealed.push('rapture');Object.assign(next,totals(next.origin,next.events,next.phase));}
      return next;
    }
  }
  next.hesitation=null;
  const cards=selected.scheduledEvent?clone(selected.scheduledEvent.cards):actionIntertitles(selected,state);
  const moneyIntroduction=introducesMoney(selected,state)&&cards.length>0;
  const story=selected.scheduledEvent?null:storyReceipt(state,selected,after,UI,STORY_RULES);
  if(story?.opening?.ribcage&&STORY_RULES.hungerReveal==='ribcage'){selected.reveal=[...new Set([...selected.reveal,'hunger'])];selected.revealOnMessage=STORY_RULES.openingFlow.hungerMessage;selected.revealAtEnd=true;}
  for(const id of storyMessageIds(story,STORY_RULES))for(const card of intertitleSequence(id))if(!cards.some(c=>c.id===card.id))cards.push(card);
  // Event choices interrupt the next deal. Legacy automatic passages keep their
  // behavior; both use receipt references, never copied narrative or new charges.
  const fired=new Set(state.events.flatMap(e=>[...(e.scheduledEvents||[]),...(e.queuedEvents||[]).map(q=>q.id)])),start=Number(UI.logStartHour??DEFAULT_START_HOUR);
  const clockMinutes=(Number.isInteger(start)&&start>=0&&start<24?start:DEFAULT_START_HOUR)*60+state.elapsedMinutes+selected.minutes;
  const due=SCHEDULED_EVENTS.filter(e=>e.enabled!==false&&!fired.has(e.id)&&clockMinutes>=e.hour*60&&intertitleSequence(e.message).length).sort((a,b)=>a.hour-b.hour);
  const queued=due.filter(e=>e.action).map(e=>({id:e.id,action:e.action,message:e.message,cards:intertitleSequence(e.message)}));
  const automatic=due.filter(e=>!e.action);
  for(const event of automatic)for(const card of intertitleSequence(event.message))if(!cards.some(c=>c.id===card.id))cards.push(card);
  const consumed=[...(selected.scheduledEvent?[selected.scheduledEvent.id]:[]),...automatic.map(e=>e.id)];
  const message=cards[0]?.id||null;
  const revealOnCard=selected.revealOnMessage?cards.findIndex(card=>card.id===selected.revealOnMessage)+1:0;
  next.events.push({id:selected.id,minutes:selected.minutes,delta:Object.fromEntries(statKeys.map(key=>[key,round(after[key]-state.values[key])])),
    changes,...(story?{story}:{}),...(!selected.scheduledEvent&&selected.grantsItems?.length?{items:[...selected.grantsItems]}:{}),
    ...(story?.joints?{inventory:{joints:state.story.joints+story.joints}}:{}),
    ...(selected.id==='dinner'&&story?.portions?{inventory:{portions:state.story.portions+story.portions}}:{}),
    ...(selected.id==='dinner'&&story?.frozenPortions?{inventory:{frozenPortions:state.story.frozenPortions+story.frozenPortions}}:{}),
    ...(!selected.scheduledEvent&&selected.logInventory&&story?{logInventory:selected.logInventory,inventory:{[selected.logInventory]:(state.story[selected.logInventory]||0)+(story[selected.logInventory]||0)}}:{}),
    ...(queued.length?{queuedEvents:queued}:{}),...(consumed.length?{scheduledEvents:consumed}:{}),
    ...(selected.repeatable?{repeatable:true}:{}),...(selected.outcome?{outcome:selected.outcome}:{}),
    reveal:selected.reveal.filter(key=>(!moneyIntroduction||key!=='money')&&(selected.followMessageLinks!==false||!selected.revealOnMessage||revealOnCard>0)),log:Object.hasOwn(LOGS,selected.log)?selected.log:null,message,earnedRapture:(selected.effects.rapture||0)>0,
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
  if(STORY_RULES){next.origin.portions??=STORY_RULES.startingPortions;next.origin.joints??=STORY_RULES.startingJoints;next.story=storyTotals(next.origin,next.events,STORY_RULES);}
  if(next.choiceHint&&(DOCUMENT.choicePolicy?.hideUnavailable||!Object.hasOwn(MESSAGES,next.choiceHint)))delete next.choiceHint;
  if(!ids.has(next.node))next.node=INTRO[0].id;
  next.trail=next.trail.filter(id=>ids.has(id));
  if(next.message&&!Object.hasOwn(MESSAGES,next.message))next.message=null;
  if(next.message&&!MESSAGES[next.message]?.trim()&&!MESSAGE_LINKS[next.message]?.next&&!MESSAGE_LINKS[next.message]?.log)next.message=null;
  const pending=next.hesitation,action=pending&&visibleActions(next).find(a=>a.id===pending.action);
  if(pending&&(!CHOICE_WARNINGS||!action||action.warnRaptureLoss===false||!availableActions({...next,hesitation:null}).some(a=>a.id===action.id)||raptureCost(next,action)!==pending.cost))next.hesitation=null;
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
    if(o?.openingFlow!==undefined&&o.openingFlow!==1)return null;
    const pending=v.hesitation??null;
    if(v.choiceHint!==undefined&&(!validId(v.choiceHint)||v.phase!=='playing'||v.message||pending?.visible))return null;
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
    const itemList=items=>list(items)&&items.length<=100&&new Set(items).size===items.length;
    if(o.items!==undefined&&!itemList(o.items)||v.events.some(e=>e.items!==undefined&&!itemList(e.items)))return null;
    if(v.events.some(e=>e.story!==undefined&&!validStoryReceipt(e.story)))return null;
    if(v.events.some(e=>e.appendices!==undefined&&(!list(e.appendices)||e.appendices.length>4||new Set(e.appendices).size!==e.appendices.length)))return null;
    if(v.events.some(e=>e.inventory!==undefined&&(!e.inventory||typeof e.inventory!=='object'||Array.isArray(e.inventory)||Object.entries(e.inventory).some(([key,value])=>!['portions','frozenPortions','leftovers','joints'].includes(key)||!Number.isInteger(value)||value<0||value>1000000))))return null;
    if(v.events.some(e=>e.logInventory!==undefined&&(!['portions','frozenPortions','leftovers','joints'].includes(e.logInventory)||!Object.hasOwn(e.inventory||{},e.logInventory))))return null;
    for(const key of ['portions','frozenPortions','leftovers','joints'])if(o[key]!==undefined&&(!Number.isInteger(o[key])||o[key]<0||o[key]>1000))return null;
    const scheduledIds=new Set(),queuedIds=new Set();
    for(const e of v.events) {
      if(e.revealOnCard!==undefined&&(!e.revealAtEnd||!Number.isInteger(e.revealOnCard)||e.revealOnCard<1||!e.cards||e.revealOnCard>e.cards.length))return null;
      if(e.revealAtEnd!==undefined||e.resultsDismissed!==undefined) {
        if(e.revealAtEnd!==true||typeof e.resultsDismissed!=='boolean'||!e.message||
          !e.resultsDismissed&&(e!==v.events.at(-1)||v.message===null)||e.resultsDismissed&&e===v.events.at(-1)&&v.message!==null)return null;
      }
      if(e.queuedEvents!==undefined){
        if(!Array.isArray(e.queuedEvents)||!e.queuedEvents.length||e.queuedEvents.length>100)return null;
        for(const q of e.queuedEvents){
          if(!q||!validId(q.id)||!validId(q.action)||!validId(q.message)||queuedIds.has(q.id)||scheduledIds.has(q.id)||
            !Array.isArray(q.cards)||!q.cards.length||q.cards.length>5000||q.cards[0]?.id!==q.message||
            q.cards.some(c=>!c||!validId(c.id)||!(c.log===null||validId(c.log)))||new Set(q.cards.map(c=>c.id)).size!==q.cards.length)return null;
          queuedIds.add(q.id);
        }
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
    if(STORY_RULES){
      const {leftovers=0,...story}=result.story,{leftovers:storedLeftovers=0,...storedStory}=v.story||{};
      if(story.portions<0||story.frozenPortions<0||story.joints<0||leftovers<0||v.story&&(storedLeftovers!==leftovers||JSON.stringify(storedStory)!==JSON.stringify(story)))return null;
    }
    if(new Set(result.completed).size!==result.completed.length||!numbers(result.values,true))return null;
    for(const key of ['values','completed','logs','stats','elapsedMinutes','gainedRapture'])if(JSON.stringify(v[key])!==JSON.stringify(result[key]))return null;
    const last=v.events.at(-1),activeMessage=last?.cards?last.cards[last.seen-1].id:last?.message||o.message;
    if(v.message!==null&&v.message!==activeMessage)return null;
    if(v.phase==='intro'&&(result.completed.length||v.message||result.elapsedMinutes||result.logs.length))return null;
    if(pending&&(v.phase!=='playing'||v.message||result.completed.includes(pending.action)&&!ACTIONS.find(a=>a.id===pending.action)?.repeatable&&!v.events.some(e=>e.id===pending.action&&e.repeatable)))return null;
    // Add the dormant stat only after validating the original four-stat receipt totals.
    const origin=clone(o),events=clone(v.events);origin.values.choice??=BASELINE.choice;for(const e of events)e.delta.choice??=0;
    if(STORY_RULES){origin.portions??=STORY_RULES.startingPortions;origin.joints??=STORY_RULES.startingJoints;}
    return reconcileGame({version:SAVE_VERSION,script:SCRIPT_ID,randomSeed:v.randomSeed??seedFrom(JSON.stringify(o.values)),phase:v.phase,node:v.node,trail:[...v.trail],origin,events,...totals(origin,events,v.phase),message:v.message,hesitation:pending?{action:pending.action,stage:pending.stage,cost:pending.cost,visible:pending.visible}:null,
      ...(v.choiceHint&&Object.hasOwn(MESSAGES,v.choiceHint)?{choiceHint:v.choiceHint}:{})});
  }catch{return null;}
}
export function serializeGame(state) {const raw=JSON.stringify(state);if(!restoreGame(raw))throw new Error('Invalid game state');return raw;}
