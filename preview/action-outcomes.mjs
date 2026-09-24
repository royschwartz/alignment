export function seedFrom(value) {
  let seed=2166136261;
  for(const char of String(value)){seed^=char.charCodeAt(0);seed=Math.imul(seed,16777619);}
  return seed>>>0;
}
function shuffled(items,seed) {
  const order=[...items];
  const random=()=>{seed=(seed+0x6d2b79f5)>>>0;let n=seed;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
  for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
  return order;
}
// Resolve before drawing the card so its warning/cost and committed outcome
// always agree. Reloading, reading, and other choices never reroll this draw.
export function resolveOutcome(state,action) {
  if(!action.outcomes?.length)return action;
  const pool=action.outcomes.filter(o=>o.enabled!==false);
  if(!pool.length)return {...action,enabled:false};
  const draws=state.events.filter(e=>e.id===action.id).length+(state.origin.completed.includes(action.id)?1:0);
  const cycle=Math.floor(draws/pool.length),order=shuffled(pool,seedFrom(`${state.randomSeed}:${action.id}:${cycle}`));
  const picked=order[draws%pool.length],{outcomes,...base}=action;
  return {...base,...picked,id:action.id,enabled:action.enabled!==false,outcome:picked.id};
}
