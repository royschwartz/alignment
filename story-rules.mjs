// Mechanics reference: ../design/CHOICE_LOGIC.md (shared rules and every choice entry).
// Data-only story progress. Prose and all tunable values live in the manuscript.
import {seedFrom} from './action-outcomes.mjs';
import {firstNightState,firstNightMealPortions} from './first-night.mjs';
import {openingState,advanceOpening,openingActive,openingVisible,resolveOpening,openingReceipt,validOpeningReceipt} from './opening-flow.mjs';
export const storyClock=(state,ui)=>Number(ui.logStartHour??13)*60+state.elapsedMinutes;
export const storyDay=(state,ui)=>Math.floor(storyClock(state,ui)/1440)+1;
export const strangeDay=state=>2+seedFrom(`${state.randomSeed}:strange-day`)%2;
export const foodPortions=state=>(state.story?.portions||0)+(state.story?.frozenPortions||0)+(state.story?.leftovers||0);
export function storyTotals(origin,events,rules) {
  if(!rules)return undefined;
  const s={portions:origin.portions??rules.startingPortions,joints:origin.joints??rules.startingJoints,hungry:false,strange:false,visited:false,encounter:null,looked:false,spoke:false,offering:0,sleptNights:[],metPerson:false,socialDone:false};
  if(rules.leftoverPortions!==undefined||origin.leftovers!==undefined||events.some(e=>e.story?.leftovers!==undefined))s.leftovers=origin.leftovers??0;
  // Only new games capture split stocks. Earlier saves retain their recorded
  // shared food supply and every original charge.
  if(origin.frozenPortions!==undefined)s.frozenPortions=origin.frozenPortions;
  const opening=openingState(origin,rules);if(opening)s.opening=opening;
  for(const e of events){advanceOpening(opening,e);const r=e.story;if(!r)continue;
    s.portions+=r.portions||0;s.joints+=r.joints||0;
    if(r.leftovers!==undefined)s.leftovers+=r.leftovers;
    if(r.frozenPortions!==undefined)s.frozenPortions=(s.frozenPortions||0)+r.frozenPortions;
    for(const flag of ['hungry','strange','looked','spoke','metPerson','socialDone'])if(r[flag])s[flag]=true;
    if(r.sleepNight!==undefined)s.sleptNights.push(r.sleepNight);
    if(r.enter){s.encounter='hole';s.offering=r.offering;}
    if(r.leave){s.encounter=null;s.visited=true;}
    if(r.social)s.encounter='library';
    if(r.socialExit)s.encounter=null;
  }
  return s;
}
export function sleepOffer(state,ui,rules) {
  const clock=storyClock(state,ui),hour=clock%1440/60,night=Math.max(0,Math.floor((clock-360)/1440));
  return {night,available:(hour>=rules.sleepHour||hour<6)&&!state.story.sleptNights.includes(night)&&(night===0||seedFrom(`${state.randomSeed}:sleep:${night}`)/4294967296<rules.sleepChance)};
}
export function storyVisible(state,action,ui,rules) {
  if(!rules)return true;
  const s=state.story;
  if(s.encounter==='library')return rules.libraryChoices.includes(action.id);
  if(rules.libraryChoices.includes(action.id))return false;
  if(s.encounter==='hole') {
    if(s.looked&&s.spoke)return action.id==='hole-feed';
    return action.id==='hole-look'&&!s.looked||action.id==='hole-flashlight'&&s.looked||action.id==='hole-climb'||action.id==='hole-say'&&!s.spoke;
  }
  const opening=openingVisible(state,action,storyClock(state,ui),rules);
  if(opening!==null)return opening;
  if(['try-sleep','breakfast'].includes(action.id))return false;
  if(action.id.startsWith('hole-'))return false;
  if(action.id==='go-hole')return s.strange&&!s.visited;
  if(action.id==='sleep')return sleepOffer(state,ui,rules).available;
  if(action.requiresPerson&&!s.metPerson)return false;
  if(action.morningOnly){const hour=storyClock(state,ui)%1440/60;if(hour<6||hour>=12)return false;}
  return true;
}
export function storyPlayable(state,action,rules) {
  if(action.choiceLocked)return false;
  if(!rules)return true;
  if(action.id==='eat-leftovers')return (firstNightState(state,rules)||state.story.portions<rules.mealPortions)&&(state.story.leftovers||0)>=rules.mealPortions;
  if(action.id==='dinner')return (state.story.frozenPortions??state.story.portions)>=rules.mealPortions;
  if(action.id==='breakfast')return state.story.portions+(state.story.leftovers||0)>=rules.mealPortions;
  if(rules.meals.includes(action.id))return state.story.portions>=rules.mealPortions;
  if(action.id==='smoke-joint')return state.story.joints>=1;
  if(action.id==='go-hole')return foodPortions(state)>=1;
  if(action.id==='hole-feed')return state.story.offering>=1&&foodPortions(state)>=state.story.offering;
  return true;
}
export function resolveStoryAction(state,action,ui,rules,scheduledEvents) {
  if(!rules)return action;
  const a={...action,effects:{...action.effects},reveal:[...action.reveal]},s=state.story;
  if(a.firstLog&&!state.completed.includes(a.id))a.log=a.firstLog;
  if(a.id==='visit-library'&&state.events.some(e=>e.id===a.id)&&!s.socialDone)a.log=rules.libraryPrompt;
  if(a.id==='sleep') {
    const clock=storyClock(state,ui),hour=clock%1440/60;
    a.minutes=(Math.floor(clock/1440)+(hour>=rules.wakeHour?1:0))*1440+rules.wakeHour*60-clock;
    if(s.sleptNights.length)a.message=null;
  }
  if(a.id==='hardware-store'&&rules.openingFlow){
    const clock=storyClock(state,ui),f=rules.openingFlow,today=Math.floor(clock/1440)*1440+f.shiftStartHour*60;
    const start=today+(clock>today?1440:0);
    a.minutes=start+(f.shiftEndHour-f.shiftStartHour)*60-clock;
  }
  if(rules.meals.includes(a.id)) {
    a.effects.hunger=(a.effects.hunger||0)-(s.hungry&&storyDay(state,ui)>=strangeDay(state)&&!s.visited?0:rules.mealRelief);
    if(rules.hungerReveal==='meal'&&!a.reveal.includes('hunger')){a.reveal.push('hunger');a.revealAtEnd=true;}
  }
  if(a.id==='hole-feed') {a.label=a.label.replace(/\bx\b/gi,String(s.offering));a.effects.hunger=Math.min(0,rules.holeReliefTo-state.values.hunger);}
  if(s.opening?.worked&&a.id==='cook')delete a.requires;
  return resolveOpening(state,a,storyClock(state,ui),rules,scheduledEvents);
}
export function storyReceipt(state,action,after,ui,rules) {
  if(!rules)return null;
  const r={},s=state.story;
  if(action.id==='groceries')r.portions=rules.groceryPortions;
  if(action.id==='smoke-joint')r.joints=-1;
  if(rules.meals.includes(action.id)) {
    const portions=firstNightMealPortions(state,action,rules);
    if(action.id==='dinner'&&s.frozenPortions!==undefined)r.frozenPortions=-portions;
    else {
      const fromLeftovers=action.id==='eat-leftovers'?portions:action.id==='breakfast'?Math.max(0,portions-s.portions):0;
      if(fromLeftovers)r.leftovers=-fromLeftovers;
      if(portions>fromLeftovers)r.portions=-(portions-fromLeftovers);
    }
    // Set aside existing food, never create extra portions by cooking or reload.
    if(action.id==='cook'&&rules.leftoverPortions){
      const saved=Math.min(rules.leftoverPortions,Math.max(0,s.portions-portions));
      if(saved){r.portions-=saved;r.leftovers=saved;}
    }
    if(!openingActive(state,rules)&&s.hungry&&!s.strange&&!s.visited&&storyDay(state,ui)>=strangeDay(state))r.strange=true;
  }
  if(action.id==='sleep')r.sleepNight=sleepOffer(state,ui,rules).night;
  if(!openingActive(state,rules)&&action.id!=='sleep'&&!s.hungry&&!s.encounter&&after.hunger>=rules.hungryAt)r.hungry=true;
  if(action.id==='go-hole'){r.enter=true;r.offering=Math.min(foodPortions(state),rules.offeringMax,Math.max(1,Math.ceil(state.values.hunger/rules.offeringPerHunger)));}
  if(action.id==='hole-look')r.looked=true;if(action.id==='hole-say')r.spoke=true;
  if(action.id==='hole-feed'){
    r.leave=true;let remaining=s.offering;
    for(const stock of ['portions','leftovers','frozenPortions']){
      const used=Math.min(s[stock]||0,remaining);if(used)r[stock]=-used;remaining-=used;
    }
  }
  if(action.id===rules.personAfter&&!s.metPerson&&!openingActive(state,rules))r.metPerson=true;
  if(action.id==='visit-library'&&state.events.some(e=>e.id===action.id)&&!s.socialDone)r.social=true;
  if(rules.libraryChoices.includes(action.id)){r.socialExit=true;if(action.id!=='person-not-yet')r.socialDone=true;}
  const opening=openingReceipt(state,action,storyClock(state,ui),rules);
  if(opening){r.opening=opening;if(opening.woke)r.hungry=true;if(opening.ribcage)r.strange=true;}
  return Object.keys(r).length?r:null;
}
export function storyMessageIds(receipt,rules) {
  if(!receipt)return [];
  return [receipt.metPerson&&rules.personMessage,receipt.hungry&&'body-hungry',receipt.strange&&!receipt.opening?.ribcage&&'body-still-hungry',receipt.opening?.ribcage&&rules.openingFlow.hungerMessage].filter(Boolean);
}
export function validStoryReceipt(s) {
  if(!s||typeof s!=='object'||Array.isArray(s))return false;
  const flags=['hungry','strange','enter','looked','spoke','leave','metPerson','social','socialExit','socialDone'];
  if(Object.keys(s).some(k=>![...flags,'portions','frozenPortions','leftovers','joints','sleepNight','offering','opening'].includes(k)))return false;
  if(s.opening!==undefined&&!validOpeningReceipt(s.opening))return false;
  if(flags.some(k=>s[k]!==undefined&&s[k]!==true))return false;
  for(const key of ['portions','frozenPortions','leftovers','joints'])if(s[key]!==undefined&&(!Number.isInteger(s[key])||Math.abs(s[key])>1000))return false;
  if(s.sleepNight!==undefined&&(!Number.isInteger(s.sleepNight)||s.sleepNight<0))return false;
  if(s.enter!==undefined&&(!Number.isInteger(s.offering)||s.offering<1||s.offering>1000))return false;
  return s.offering===undefined||s.enter===true;
}
