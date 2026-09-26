// Mechanics reference: ../design/CHOICE_LOGIC.md (shared rules and every choice entry).
// The first days at home. Receipts capture progression; reading never advances it.
import {firstNightState,firstNightVisible,resolveFirstNight} from './first-night.mjs';
export const openingActive=(state,rules)=>!!(rules?.openingFlow?.enabled&&state.story?.opening&&!state.story.visited);
export function openingState(origin,rules) {
  return origin.openingFlow===1&&rules?.openingFlow?{restless:false,settled:false,woke:false,breakfast:false,worked:false,meal:false,ribcage:false,wakeDay:0,afterMealMinutes:0}:null;
}
export function advanceOpening(state,event) {
  if(!state)return;
  if(state.meal&&!state.ribcage)state.afterMealMinutes+=event.minutes;
  Object.assign(state,event.story?.opening||{});
}
export function openingVisible(state,action,clock,rules) {
  if(!openingActive(state,rules))return null;
  const s=state.story.opening,f=rules.openingFlow;
  const night=firstNightVisible(state,action,clock,rules);if(night!==null)return night;
  if(s.woke&&!s.breakfast)return action.id==='breakfast'||action.id==='groceries'&&state.story.portions+(state.story.leftovers||0)<rules.mealPortions;
  if(s.breakfast&&!s.worked)return action.id==='hardware-store';
  if(action.id==='hardware-store'||action.id==='breakfast')return false;
  if(action.id==='try-sleep')return !s.restless&&clock>=rules.sleepHour*60;
  if(action.id==='sleep')return !s.woke&&s.settled;
  if(action.id==='cook')return s.worked||state.completed.includes('dishes');
  if(action.id==='go-hole')return s.ribcage;
  return f.homeActions.includes(action.id);
}
export function orderOpeningChoices(state,actions,clock,rules) {
  if(!openingActive(state,rules))return actions;
  const s=state.story.opening;
  const first=s.ribcage?'go-hole':s.worked&&!s.meal?'cook':!s.woke&&s.settled?'sleep':!s.woke&&s.restless?'pace':!s.woke&&clock>=rules.sleepHour*60?'try-sleep':null;
  const priority=[first,...(state.story.portions<rules.mealPortions?['groceries']:[])];
  const rank=a=>priority.includes(a.id)?priority.indexOf(a.id):priority.length;
  return actions.sort((a,b)=>rank(a)-rank(b));
}
export function resolveOpening(state,action,clock,rules,scheduledEvents) {
  if(!openingActive(state,rules))return action;
  const s=state.story.opening,f=rules.openingFlow,a=action;
  if(a.id==='groceries'&&s.woke&&!s.breakfast)a.minutes=f.morningGroceriesMinutes;
  if(a.id==='hardware-store'&&s.breakfast&&!s.worked){
    a.effects.rapture=f.shiftRapture;a.drainRapture=false;
    a.reveal=[...new Set([...a.reveal,'rapture'])];
  }
  // Food behaves normally on the first evening. The unresolved appetite starts
  // on waking; breakfast and the later meal then provide no hunger relief.
  if(rules.meals.includes(a.id)&&s.woke)a.effects.hunger=0;
  if(a.id==='cook'&&s.worked){
    delete a.requires;delete a.firstGainMessage;delete a.raptureGain;
    a.message=null;a.effects.rapture=f.mealRapture;a.drainRapture=false;
  }
  return resolveFirstNight(state,a,clock,rules,scheduledEvents);
}
export function openingReceipt(state,action,clock,rules) {
  if(!openingActive(state,rules))return null;
  const s=state.story.opening,f=rules.openingFlow,r={};
  if(action.id==='try-sleep')r.restless=true;
  if(action.id==='pace'&&s.restless&&!s.woke)r.settled=true;
  if(firstNightState(state,rules,clock)?.phase==='settle'&&action.id!=='sleep')r.settled=true;
  if(action.id==='sleep'&&!s.woke){r.woke=true;r.wakeDay=Math.floor((clock+action.minutes)/1440);}
  if(action.id==='breakfast'&&s.woke&&!s.breakfast)r.breakfast=true;
  if(action.id==='hardware-store'&&s.breakfast&&!s.worked)r.worked=true;
  if(action.id==='cook'&&s.worked&&!s.meal)r.meal=true;
  if(s.meal&&!s.ribcage&&s.afterMealMinutes+action.minutes>=f.postMealMinutes)r.ribcage=true;
  return Object.keys(r).length?r:null;
}
export function validOpeningReceipt(r) {
  const flags=['restless','settled','woke','breakfast','worked','meal','ribcage'];
  return r&&typeof r==='object'&&!Array.isArray(r)&&Object.keys(r).every(key=>flags.includes(key)?r[key]===true:key==='wakeDay'&&Number.isInteger(r[key])&&r[key]>=0&&r[key]<=1000000);
}
