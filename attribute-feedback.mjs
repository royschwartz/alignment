import {displayedStats} from './hunger-indicator.mjs';
import {eventChanges} from './stat-log.mjs';

// Receipts are charged once at commitment. Present the prior balance while an
// outcome is being read, then show its actual change with the resulting log.
function holdsStat(state,stat) {
  const event=state.events.at(-1);
  return !!(state.message&&event?.message&&!(event.revealOnCard&&event.seen>event.revealOnCard&&event.reveal.includes(stat)));
}
export function presentedStats(state,config) {
  const event=state.events.at(-1);
  return displayedStats(state,config).map(([stat,value])=>[stat,holdsStat(state,stat)?value-(event.delta[stat]||0):value]);
}
export function cueStrength(before,after) {
  const percent=Math.abs(after-before)/Math.max(1,Math.abs(before));
  const strength=Math.sqrt(Math.min(1,percent));
  return {percent,duration:.28+.8*strength,volume:.14+.26*strength};
}
export function attributeFeedback(before,after,config) {
  const previous=Object.fromEntries(presentedStats(before,config));
  const event=after.events.at(-1);
  return presentedStats(after,config).flatMap(([stat,value])=>{
    const outcomeArrived=event&&!holdsStat(after,stat)&&(after.events.length>before.events.length||holdsStat(before,stat)&&before.events.length===after.events.length);
    const direct=outcomeArrived?eventChanges(event):null;
    const reveal=!Object.hasOwn(previous,stat),committed=after.events.length>before.events.length&&!after.message;
    const from=reveal?(outcomeArrived?value-(event.delta[stat]||0):committed?before.values[stat]:value):previous[stat];
    const amount=Math.round((value-from)*1e6)/1e6;
    const displayAmount=direct?Math.round(direct.filter(c=>c.stat===stat).reduce((sum,c)=>sum+c.amount,0)*1e6)/1e6:amount;
    if(!reveal&&!amount&&!displayAmount)return [];
    return [{stat,reveal,from,to:value,amount,displayAmount,...cueStrength(from,value)}];
  });
}
export function animatedValue(cue,now,reducedMotion=false) {
  if(!cue)return null;
  if(now<cue.start)return cue.from;
  const progress=reducedMotion?1:Math.min(1,(now-cue.start)/(cue.duration*1000));
  return progress>=1?cue.to:cue.from+(cue.to-cue.from)*(1-(1-progress)**2);
}
