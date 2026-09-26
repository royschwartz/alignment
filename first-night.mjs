// Mechanics reference: ../design/CHOICE_LOGIC.md (shared rules and every choice entry).
import {seedFrom} from './action-outcomes.mjs';

function cookingProgress(state,rules,config) {
  if(!config.cookingAfterGroceries)return null;
  const cooked=state.events.findLastIndex(e=>e.id==='cook');
  if(cooked>=0)return {cooked:true,next:null};
  const stocked=state.story.portions>=rules.mealPortions;
  return {cooked:false,next:stocked&&state.completed.includes('groceries')?(state.completed.includes('dishes')?'cook':'dishes'):null};
}

// A bounded first evening, derived entirely from committed receipts. The clock,
// meal stocks and history remain authoritative when an older save resumes late.
export function firstNightState(state,rules,clock=0) {
  const config=rules?.openingFlow?.firstNight;
  if(!config?.enabled||!rules.openingFlow.enabled||!state.story?.opening||state.story.opening.woke||state.story.visited)return null;
  const bed=config.bedHours[0]*60+15*(seedFrom(`${state.randomSeed}:first-bed`)%
    (Math.floor((config.bedHours[1]-config.bedHours[0])*4)+1));
  const s=state.story.opening,cooking=cookingProgress(state,rules,config);
  const lastActivity=bed-config.settlingMinutes;
  const phase=clock>=bed||s.settled?'bed':s.restless?'settle':clock>=lastActivity?'try':
    clock>=config.windDownHour*60?'wind-down':'day';
  return {config,bed,lastActivity,phase,cooking};
}

export function firstNightVisible(state,action,clock,rules) {
  const night=firstNightState(state,rules,clock);if(!night)return null;
  const {phase,config,cooking}=night;
  if(phase==='bed')return action.id==='sleep';
  if(phase==='try')return action.id==='try-sleep';
  if(phase==='settle')return config.settlingActions.includes(action.id);
  if(action.id==='try-sleep')return phase==='wind-down';
  if(action.id==='sleep')return false;
  if(action.id==='groceries'&&phase==='wind-down')return false;
  if(action.id==='cook'&&cooking?.cooked)return false;
  return null;
}

export function resolveFirstNight(state,action,clock,rules,scheduledEvents=[]) {
  const night=firstNightState(state,rules,clock);if(!night)return action;
  const a=action,{config,phase,bed}=night;
  if(a.id==='dinner')delete a.unavailableAfter;
  if(a.id==='sleep'){
    a.minutes=Math.max(1,Math.min(a.minutes,8*60));
    // The authored waking log says work is in an hour. A genuinely late old
    // save may wake in the afternoon; leave that particular outcome quiet.
    if((clock+a.minutes)%1440!==rules.wakeHour*60)a.log=null;
  }
  else if(a.id==='try-sleep'){
    const settling=Math.min(config.settlingMinutes,Math.max(15,Math.floor((bed-clock)/2)));
    a.minutes=Math.max(15,bed-settling-clock);
  }
  else if(phase==='settle')a.minutes=Math.max(1,bed-clock);
  else if(phase==='day'||phase==='wind-down'){
    // Use each activity's authored duration. Short chores must not expand to
    // fill a turn budget; long idle activities can still occupy the evening.
    if(config.cookingAfterGroceries&&a.id==='cook')a.minutes=Math.min(a.minutes,60);
    a.minutes=Math.max(1,Math.min(a.minutes,night.lastActivity-clock));
    // Stop at the scheduled sunset so its event is still a sunset. The event's
    // own zero-minute card remains the only card on the next deal.
    const fired=new Set(state.events.flatMap(e=>[...(e.scheduledEvents||[]),...(e.queuedEvents||[]).map(q=>q.id)]));
    const boundary=scheduledEvents.filter(e=>e.enabled!==false&&!fired.has(e.id)&&e.hour*60>clock).map(e=>e.hour*60).sort((a,b)=>a-b)[0];
    if(boundary!==undefined)a.minutes=Math.min(a.minutes,boundary-clock);
  }
  return a;
}

export function firstNightMealPortions(state,action,rules) {
  const night=firstNightState(state,rules);if(!night)return rules.mealPortions;
  const s=state.story,stock=action.id==='dinner'?(s.frozenPortions??s.portions):action.id==='eat-leftovers'?s.leftovers:s.portions;
  return Math.min(stock||0,night.config.mealPortions);
}

// Older saves may already contain the premature cue. Omit it at presentation
// time only: its receipt and every committed cost remain unchanged.
export function firstNightLogAppendices(state,event,rules) {
  const config=rules?.openingFlow?.firstNight;
  const refs=event.appendices||[];
  if(!config?.enabled||state.origin?.openingFlow!==1)return refs;
  const index=state.events.indexOf(event),before=state.events.slice(0,index);
  if(event.story?.opening?.woke||before.some(e=>e.story?.opening?.woke))return refs;
  const early=new Set(Object.values(config.appendices));
  return refs.filter(id=>!early.has(id));
}
