// The chapter's clock and opportunities. Reading and intentions never spend a window.
export const DAY_WINDOWS = Object.freeze([
  { id: 'morning', label: 'Morning', start: 0, duration: 4 },
  { id: 'daytime', label: 'Daytime', start: 4, duration: 8 },
  { id: 'evening', label: 'Evening', start: 12, duration: 5 },
  { id: 'night', label: 'Night', start: 17, duration: 7 },
]);
export const ARC_TIMELINE = Object.freeze({ stage2Months: 6, stage3Years: 2, stage4FromBeginningYears: 8 });
export const dayNumber = s => Math.floor(s.hours / 24) + 1;
export const windowAt = s => DAY_WINDOWS.findLast(w => s.hours % 24 >= w.start - 0.0001) || DAY_WINDOWS[0];
export const windowDuration = s => Math.max(0.001, windowAt(s).start + windowAt(s).duration - s.hours % 24);
export const hasHelper = s => ['Jim', 'Ethan', 'Wendy'].some(n => s.flags[`recruited${n}`]);
export const isScheduledWork = s => windowAt(s).id === 'daytime' && (!s.flags.financialSecurity || s.money < 100) && ![0,6].includes(new Date(Date.UTC(1997,7,6 + dayNumber(s)-1)).getUTCDay());
export function metaphysicalRate(s) {
  if (!s.flags.pactMade) return 0.9;
  const day=dayNumber(s);
  return day < 8 ? 0.8 : day < 12 ? 1.5 : day < 16 ? 2.8 : day < 21 ? 4.6 : 5.6;
}
export function reliefPerBag(s) { return dayNumber(s)<8 ? 60 : dayNumber(s)<12 ? 42 : dayNumber(s)<16 ? 30 : 22; }
export const denseLife = s => Boolean(s.flags.financialSecurity && s.flags.modelLaunched && s.flags.careContract && hasHelper(s) && s.money >= 120 && s.stats.hunger < 60 && !s.crisis);
export const nightlyDisquietRelief = s => 3 + Math.min(3, s.lifestyle / 20);
export const compressedDays = s => !denseLife(s) ? 1 : s.flags.timeStretched && dayNumber(s)>=30 ? 2 : 1;
export const INTENTIONS = Object.freeze({
  local: [
    { value:'balance',label:'Keep a little room for everything',description:'Let home, care, and pleasure share the day.' },
    { value:'care',label:'Make room for the hole',description:'More food, deliveries, transport, and practical help.' },
    { value:'home',label:'Put your life in order',description:'More chances to care for your room and habits.' },
    { value:'pleasure',label:'Look for something good',description:'More meals and small pleasures. They will not feed the Hunger.' },
  ],
  fintech: [
    { value:'learning',label:'Follow your curiosity',description:'More coding, mathematics, and opportunities to learn.' },
    { value:'money',label:'Look for a way to earn more',description:'More financial opportunities and work beyond your scheduled shifts.' },
    { value:'trader',label:'Develop the trader',description:'Bring testing, building, and financial commitments into your day.' },
  ],
  social: [
    { value:'town',label:'Spend more time in town',description:'More chances to meet people and notice what they need.' },
    { value:'person',label:'Make time for PERSON',description:'More opportunities to be together. She still has her own life.' },
    { value:'friends',label:'Keep in touch with your friends',description:'More conversations, requests, and chances to earn trust.' },
    { value:'house',label:'Return to the house',description:'More invitations from MADAME and the women. Paid company has a price.' },
  ],
});
const scene=(title,text)=>({title,text});
const f=(s,n)=>!!s.flags[n];
const p=(s,n)=>s.progress[n]||0;
function provisionedDelivery(s) {
  const price = f(s, 'surplusDeal') ? 4 : 6;
  const bags = Math.min(s.flags.wagon ? 8 : 2, Math.floor(s.money / price), Math.max(1, Math.ceil((s.stats.hunger + metaphysicalRate(s) * windowDuration(s) - 12) / reliefPerBag(s))));
  return { bags, cost: bags * price };
}
export const RHYTHM_RULE_ACTIONS=[
  {id:'paid_small_program',label:'Fix the shop’s stock spreadsheet',description:'A small paid job. $46. You understand what is wrong before opening the file.',category:'work',subcategory:'freelance',requirement:18,challenge:2,desire:.65,weight:12,timeSlots:['morning','daytime'],
    when:s=>s.skills.coding>=2&&s.skills.finance>=1&&(!Object.hasOwn(s.progress,'lastPaidFix')||s.hours-s.progress.lastPaidFix>=48),effects:s=>({money:46,rapture:-2,skills:{coding:.35,finance:.25},progress:{lastPaidFix:s.hours-p(s,'lastPaidFix')}}),outcome:()=>scene('The small job','the totals agree now.\n\nshe pays you.\n\nyou remember finding this difficult.')},
  {id:'return_to_hole',label:'Take food back to the hole',description:'A bag. The same woods. Admit what your own appetite is asking.',category:'care',subcategory:'pact',requirement:()=>0,desire:.25,
    when:s=>!f(s,'pactMade'),effects:s=>({food:s.food>0?-1:0,money:s.food>0?0:-Math.min(6,s.money),progress:{foodDebt:s.food>0?0:Math.max(0,6-s.money)},rapture:24,disquiet:17,relationships:{friend:2},flags:{pactMade:true},}),
    outcome:()=>({title:'The return',text:'you brought food.\n\nyou knew where to put it.\n\n**the sound below**\n\nyour appetite loosens.\n\n*ours.*',presentation:'scene'})},
  {id:'provision_and_feed',label:'Buy food and take it to the hole',description:s=>{const {bags,cost}=provisionedDelivery(s);return `${bags} ${bags===1?'bag':'bags'}, $${cost}. ${s.flags.wagon?'One wagon trip.':'Only what you can carry.'} Food for the hole, not for you.`;},category:'care',subcategory:'feeding',requirement:()=>0,desire:.45,weight:18,
    when:s=>f(s,'pactMade')&&s.stats.hunger>=18&&s.money>=(f(s,'surplusDeal')?4:6),
    effects:s=>{const {bags,cost}=provisionedDelivery(s);return {money:-cost,rapture:4,disquiet:1,relationships:{friend:.5},progress:{feeds:1,bagsDelivered:bags}};},
    outcome:s=>scene('The trip',s.flags.wagon?'the wheels stop.\n\n**below, the bags opening**\n\nyou can bear the afternoon.':'handles against your fingers.\n\n**the sound again**\n\nsuch a little while since last time.')},
  {id:'emergency_delivery',label:'Ask for food on credit; bring it to the hole',description:'The market writes it down. Take two bags into the woods. The debt remains.',category:'care',subcategory:'emergency',requirement:()=>0,challenge:1,desire:.2,weight:2,
    when:s=>f(s,'pactMade')&&s.stats.hunger>=60&&s.food<1&&s.money<6,
    effects:()=>({rapture:-2,disquiet:2,progress:{feeds:1,bagsDelivered:2,foodDebt:14}}),outcome:()=>scene('Your name in the book','two bags.\n\n“next payday.”\n\nyou carry them straight to the woods.')},
  {id:'night_rest',label:'Let the night pass',description:'Sleep, or try. The day is counted. Hunger does not sleep.',category:'night',subcategory:'sleep',requirement:()=>0,desire:0,
    effects:s=>({rapture:10+Math.min(4,s.lifestyle/20),disquiet:-nightlyDisquietRelief(s)}),outcome:()=>scene('Night','you lie down.\n\nthe room goes dark.')},
  {id:'stock_gamble',label:'Put $80 on the stock you cannot stop thinking about',description:'A fictional stock. Your savings. You have studied it, but certainty should not feel like this.',category:'career',subcategory:'breakthrough',requirement:12,challenge:4,desire:.9,weight:35,
    when:s=>f(s,'foodStrain')&&!f(s,'stockPosition')&&!f(s,'stockWon')&&s.skills.finance>=2&&s.skills.coding>=1&&s.money>=80,
    effects:s=>({money:-80,rapture:-5,disquiet:3,progress:{stockBoughtAt:s.hours-p(s,'stockBoughtAt')},flags:{stockPosition:true}}),outcome:()=>({title:'The order',text:'eighty dollars.\n\nyou check the symbol.\n\nagain.\n\nyou know.\n\nthat is the frightening part.',presentation:'scene'})},
  {id:'arrange_deliveries',label:'Arrange regular food deliveries with your helper',description:'$90 to set it up. Food costs $4 per bag, plus $3 a day for transport. Someone helps; the bills stay yours.',category:'care',subcategory:'arrangement',requirement:16,challenge:3,desire:.6,weight:30,
    when:s=>f(s,'stockWon')&&f(s,'wagon')&&f(s,'surplusDeal')&&hasHelper(s)&&!f(s,'careContract')&&s.money>=90,
    effects:()=>({money:-90,rapture:-3,disquiet:-2,flags:{careContract:true},relationships:{town:1}}),outcome:()=>({title:'An arrangement',text:'the times written down.\n\nthe gate key copied.\n\nyou are paying someone to return.\n\nyou are still returning.',presentation:'scene'})},
];

export const RHYTHM_RULE_EVENTS=[{
 id:'transport_pressure',title:'your hands',timeSlots:['morning','daytime','evening'],
 when:s=>s.flags.foodStrain&&!s.flags.wagon,
 text:'the handles have left their shape.\n\nthere is more food to carry.\n\na wagon outside the hardware shop.\n\n$72.\n\nyou stand there for a while.',
 options:[
  {id:'event_transport_buy',label:'Buy the wagon for $72',description:'Pay now. Carry more in one trip.',requirement:0,minMoney:72,challenge:3,personality:{resolve:.08,caution:.08},effects:()=>({money:-72,rapture:-3,disquiet:-2,flags:{wagon:true}}),outcome:scene('The handle','you count the notes.\n\nhe counts them again.\n\nyou lift the handle.')},
  {id:'event_transport_credit',label:'Take the wagon on credit',description:'$12 now, $84 still owed. It costs more this way.',requirement:0,minMoney:12,challenge:2,personality:{resolve:.12,caution:-.08},effects:()=>({money:-12,rapture:-2,disquiet:1,progress:{foodDebt:84},flags:{wagon:true,wagonCredit:true}}),outcome:scene('Your signature','twelve dollars.\n\nyour name beneath the rest.\n\nthe wheels follow you outside.')},
  {id:'event_transport_carry',label:'Keep carrying it yourself',description:'No purchase. The trips and the weight remain.',requirement:0,personality:{resolve:-.08,caution:.06},effects:()=>({rapture:2,disquiet:3,flags:{declinedWagon:true}}),outcome:scene('Past the shop','the same bags.\n\nyou change hands.\n\nanother journey later.')},
 ]
}];
