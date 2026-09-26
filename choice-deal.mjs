// Mechanics reference: ../design/CHOICE_LOGIC.md (shared rules and every choice entry).
import {seedFrom} from './action-outcomes.mjs';
import {openingActive} from './opening-flow.mjs';
import {firstNightState} from './first-night.mjs';

// Deal only from the already eligible pool. No accounting or presentation state
// changes here: the saved seed and committed receipts determine the same hand.
export function selectChoiceDeal(state,actions,ui,rules,policy) {
  const tuning=policy?.deal;if(!tuning)return actions;
  const size=Math.min(4,tuning.size);
  if(actions.some(a=>a.scheduledEvent))return actions.filter(a=>a.scheduledEvent).slice(0,1);
  if(actions.length<=size)return actions;
  const pool=[...actions].sort((a,b)=>a.id.localeCompare(b.id)),picked=[];
  const recent=state.events.slice(-tuning.recentWindow),last=state.events.at(-1);
  const group=a=>a.thread?.trim().toLowerCase()||a.id;
  const groups=new Map(actions.map(a=>[a.id,group(a)]));
  // Supplied thread IDs on prior receipts are not needed: membership remains
  // editable and is resolved from the current authored action definitions.
  const threads=policy.threadByAction||{};
  const priorGroup=id=>threads[id]?.trim().toLowerCase()||groups.get(id)||id;
  const weight=a=>{
    const repeats=recent.filter(e=>e.id===a.id).length;
    const affinity=recent.filter(e=>priorGroup(e.id)===group(a)).length;
    const follows=last&&(a.requires===last.id||a.requiresOutcome&&a.requiresOutcome===last.outcome);
    return (a.dealWeight??1)*tuning.repeatWeight**repeats*(1+tuning.threadBoost*affinity)*(follows?2:1);
  };
  let seed=seedFrom(`${state.randomSeed}:deal:${state.events.length}`);
  const random=()=>{seed=(seed+0x6d2b79f5)>>>0;let n=seed;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
  const take=a=>{if(a&&picked.length<size){picked.push(a);pool.splice(pool.indexOf(a),1);}};
  const reserve=id=>take(pool.find(a=>a.id===id));
  const sample=candidates=>{
    if(!candidates.length)return;
    let point=random()*candidates.reduce((sum,a)=>sum+weight(a),0);
    take(candidates.find(a=>(point-=weight(a))<0)||candidates.at(-1));
  };
  const night=firstNightState(state,rules,Number(ui.logStartHour??13)*60+state.elapsedMinutes);
  if(openingActive(state,rules)){
    const s=state.story.opening,clock=Number(ui.logStartHour??13)*60+state.elapsedMinutes;
    const required=s.ribcage?'go-hole':s.worked&&!s.meal?'cook':s.breakfast&&!s.worked?'hardware-store':s.woke&&!s.breakfast?'breakfast':
      s.settled?'sleep':s.restless?'pace':clock>=rules.sleepHour*60?'try-sleep':null;
    reserve(required);
  }
  // Supply recovery and short availability windows never depend on a lucky draw.
  if(state.completed?.includes('dishes')&&!state.completed.includes('cook'))reserve('cook');
  if(night?.cooking?.next)reserve(night.cooking.next);
  reserve('groceries');reserve('sleep');reserve('hardware-store');
  // A meal may occupy one place when available; it never removes the other
  // activities or makes the first evening depend on the hidden hunger value.
  if(rules&&(night||state.values.hunger>=rules.hungryAt)&&!picked.some(a=>rules.meals.includes(a.id)))sample(pool.filter(a=>rules.meals.includes(a.id)));
  while(pool.length&&picked.length<size){
    const used=new Set(picked.map(group)),different=pool.filter(a=>!used.has(group(a)));
    sample(different.length?different:pool);
  }
  return picked;
}
