// Mechanics reference: ../design/CHOICE_LOGIC.md (shared rules and every choice entry).
// Availability is derived from committed receipts; reading never resets a wait.
import {firstNightState} from './first-night.mjs';
export function actionHistory(state) {
  let end=state.origin.elapsedMinutes;
  const history=state.origin.completed.map((id,index)=>({id,end,index}));
  for(const event of state.events){end+=event.minutes;history.push({id:event.id,end,index:history.length});}
  return history;
}
export function contextAvailable(state,action,ui,rules,policy) {
  const gate=action.availability||{},history=actionHistory(state),last=history.findLast(e=>e.id===action.id);
  const start=Number(ui.logStartHour??13)*60,clock=start+state.elapsedMinutes;
  const firstCook=action.id==='cook'&&state.completed.includes('dishes')&&!state.completed.includes('cook');
  const night=firstNightState(state,rules,clock);
  if(night?.phase==='settle'&&night.config.settlingActions.includes(action.id))return true;
  const opening=state.story?.opening,requiredOpening=!!(rules?.openingFlow?.enabled&&opening&&!state.story.visited&&(
    action.id==='breakfast'&&opening.woke&&!opening.breakfast||
    action.id==='cook'&&opening.worked&&!opening.meal||
    action.id==='hardware-store'&&opening.breakfast&&!opening.worked));
  const required=firstCook||requiredOpening;
  const needsMealSupplies=action.id==='groceries'&&rules&&state.story?.portions<rules.mealPortions;
  if(gate.maxPortions!==undefined&&state.story?.portions>gate.maxPortions&&!needsMealSupplies)return false;
  if(gate.afterAny?.length&&!history.some(e=>gate.afterAny.includes(e.id)))return false;
  if(gate.renewedBy?.length&&last&&!history.some(e=>e.index>last.index&&gate.renewedBy.includes(e.id)))return false;
  if(!required){
    if(gate.cooldownMinutes&&last&&state.elapsedMinutes-last.end<gate.cooldownMinutes)return false;
    if(gate.oncePerDay&&last&&Math.floor((start+last.end)/1440)===Math.floor(clock/1440))return false;
    const hour=(clock%1440)/60;
    if(gate.hours&&(hour<gate.hours[0]||hour>=gate.hours[1]))return false;
  }
  // Cooking includes eating. Neither its leftovers nor the first recipe after
  // another supper bypass the meal gap, even when the deal has spare places.
  if(!requiredOpening&&policy?.mealGapMinutes&&rules?.meals.includes(action.id)){
    const meal=history.findLast(e=>rules.meals.includes(e.id));
    if(meal&&state.elapsedMinutes-meal.end<policy.mealGapMinutes)return false;
  }
  return true;
}
