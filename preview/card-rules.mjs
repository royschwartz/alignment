// The approved lab defaults. These affect future offers only; stored receipts
// remain authoritative. The first-night rules and random deal stay in the lab.
export const CARD_RULES={needIds:['dinner'],withdrawCost:1};
export const isNeed=action=>action.need===true||(action.need!==false&&CARD_RULES.needIds.includes(action.id));
export const needCost=action=>Math.max(0,Number(action.needCost??CARD_RULES.withdrawCost)||0);
export const painLevel=amount=>amount>=4?3:amount>=2?2:1;
export function painAmount(state,action,after) {
  const uncertain=['rapture','disquiet'].some(stat=>{
    const signs=new Set((action.outcomes||[]).filter(o=>o.enabled!==false).map(o=>Math.sign(o.effects?.[stat]||0)));
    return signs.has(1)&&signs.has(-1);
  });
  const experienced=state.completed.includes(action.id);
  if(uncertain||isNeed(action)||action.narratorSeesPain===false&&!experienced)return 0;
  return Math.max(0,state.values.rapture-after.rapture,after.disquiet-state.values.disquiet);
}
