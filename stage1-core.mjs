import * as CONTENT from './stage1-content.mjs';
import { RHYTHM_SCENES, NIGHT_DREAMS, CHARACTER_EVENTS, RESET_PASSAGES } from './stage1-rhythm-content.mjs';
import { DAY_WINDOWS, ARC_TIMELINE, dayNumber, windowAt, windowDuration, metaphysicalRate, reliefPerBag, isScheduledWork, hasHelper, availableHelpers, hasAvailableHelper, denseLife, compressedDays, nightlyDisquietRelief, INTENTIONS, RHYTHM_RULE_ACTIONS, RHYTHM_RULE_EVENTS } from './stage1-rhythm.mjs';
const { INTRO } = CONTENT;
const ACTIONS=[...CONTENT.ACTIONS,...RHYTHM_RULE_ACTIONS];
export const SAVE_VERSION=3;
export const ATTRIBUTE_KEYS=['disquiet','rapture','choice','hunger','money','lifestyle'];
export const DEFAULT_RULES=Object.freeze({hungerRaptureThreshold:10}); // Retained only for old-save compatibility.
const STAT_KEYS=['rapture','disquiet','choice','hunger'];
const SKILL_KEYS=['coding','math','finance','social','practical'];
const RELATIONSHIP_KEYS=['friend','person','town','jim','ethan','wendy','madame','priestess','fool','sun'];
const PERSONALITY_KEYS=['honesty','empathy','resolve','caution'];
const HELPERS=[{id:'jim',name:'GRINGO JIM',flag:'Jim'},{id:'ethan',name:'ETHAN',flag:'Ethan'},{id:'wendy',name:'WENDY',flag:'Wendy'}];
const MAX_HISTORY=1200;
const clamp=(n,lo=0,hi=100)=>Math.max(lo,Math.min(hi,n));
const round=n=>Math.round(n*1000)/1000;
const clone=v=>JSON.parse(JSON.stringify(v));
const evaluate=(value,state,fallback=0)=>typeof value==='function'?value(state):value??fallback;
const actionMap=new Map(ACTIONS.map(a=>[a.id,a]));
const storyEvents=[...RHYTHM_RULE_EVENTS,...(CONTENT.STORY_EVENTS||[]),...CHARACTER_EVENTS];
const eventMap=new Map(storyEvents.map(e=>[e.id,e]));
for(const event of storyEvents)for(const option of event.options)actionMap.set(option.id,{category:'story',subcategory:event.id,...option,eventId:event.id});
const FINISH={id:'finish_stage1'};
actionMap.set(FINISH.id,{...actionMap.get('stage1_complete'),id:FINISH.id});
const WAIT={id:'wait',label:'Let this part of the day pass',description:'Stay with the hours. The appetite keeps growing.',category:'rest',subcategory:'waiting',requirement:()=>0,challenge:0,desire:0,effects:()=>({rapture:2,disquiet:-.5}),outcome:()=>({title:'The hours',text:'you leave it until later.\n\nlater comes.'})};
actionMap.set(WAIT.id,WAIT);
const SYSTEMS=[
 {id:'local',label:'Home and the hole',unlocked:()=>true,hint:'Look around your life.'},
 {id:'fintech',label:'Work, learning, and money',unlocked:()=>true,hint:'Notice where your attention goes.'},
 {id:'social',label:'Town and people',unlocked:()=>true,hint:'Make room for other people.'}
];
export function attributeDescription(stat){return {
 hunger:'Hunger is metaphysical. Eating does not relieve it. Throwing food into the hole does.\n\nAs your Hunger increases, events that happen to you generate less Rapture and more Disquiet. It rises as time passes.',
 disquiet:'Disquiet is gained and lost as appropriate to the circumstance.\n\nOver the course of a day, you will lose Rapture equal to your Disquiet total. The night reports this loss; it does not charge it again.',
 rapture:'Rapture is gained and lost as appropriate to the circumstance.\n\nSometimes when you make a decision you must sacrifice it. If it reaches zero, you reset and continue. Your reset count remains.',
 choice:'You gain Choice by making decisions where you sacrifice Rapture.\n\nYou lose Choice under mysterious circumstances. Some truths are harder to choose than others.\n\nHunger and Disquiet can raise the Choice some decisions require. Feeding the hole and letting Disquiet settle can make those decisions easier.',
 money:'Ordinary money. Wages, bills, groceries, dates, and paid company.\n\nA reset does not erase a bill.',
 lifestyle:'The way you are living. Healthy food, a cared-for home, and habits that leave something for tomorrow.\n\nEating well can improve Lifestyle. Better habits help Disquiet settle during sleep. They cannot feed the Hunger.'
}[stat]||'';}
export function gameDate(hours=0){const date=new Date(Date.UTC(1997,7,6,5)+Math.floor(clamp(Number.isFinite(hours)?hours:0,0,100_000_000)*60+1e-8)*60_000);const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];return {year:date.getUTCFullYear(),month:date.getUTCMonth()+1,day:date.getUTCDate(),hour:date.getUTCHours(),minute:date.getUTCMinutes(),date:`${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`};}
export function appetiteRate(state){return typeof state==='object'?metaphysicalRate(state):.9;}
export function friendCare(s){const rate=metaphysicalRate(s),capacity=s.flags.wagon?8:2;return {...s.care,intervalDays:CONTENT.careInterval(s),foodRequired:CONTENT.careFoodRequired(s),capacity,rate,reliefPerBag:reliefPerBag(s),dueIn:round(Math.max(0,60-s.stats.hunger)/rate),overdue:Math.max(0,(s.stats.hunger-60)/rate),automatic:!!s.flags.careContract&&hasAvailableHelper(s)&&!s.flags.deliveryMissed};}
const ledger=s=>({day:dayNumber(s),disquietLoss:0,expenses:0,income:0,deliveries:0,automaticDeliveries:0,bags:0,hungerStart:s.stats.hunger,resetsStart:s.resets});
export function createGame(seed=Date.now(),rules={}){const s={version:SAVE_VERSION,seed:String(seed),rng:hashSeed(seed),phase:'intro',introIndex:0,rules:{...DEFAULT_RULES,...rules},turn:0,hours:0,stats:{rapture:36,disquiet:2,choice:38,hunger:16},money:20,food:0,lifestyle:20,resets:0,skills:Object.fromEntries(SKILL_KEYS.map(k=>[k,0])),relationships:Object.fromEntries(RELATIONSHIP_KEYS.map(k=>[k,0])),flags:{},progress:{feeds:0,danger:0},care:{lastFedAt:0,nextFeedAt:48},personality:Object.fromEntries(PERSONALITY_KEYS.map(k=>[k,0])),pendingEvent:null,completedEvents:[],lastEventTurn:-3,history:[],journal:[],offers:[],crisis:null,lastOutcome:null,interludes:[],interludeReturn:null,rhythm:{mode:'daily',stepDays:1,intentions:{local:'balance',fintech:'learning',social:'town'}},nights:[]};s.dayLedger=ledger(s);return s;}
export function inspectSystem(state){return state;}
function systemUnlocked(system,s){return s.phase!=='intro'&&system.unlocked(s);}
function revealedStats(s){return s.phase==='intro'?[]:ATTRIBUTE_KEYS.filter(k=>s.flags[k+'Discovered']);}
function queueScene(s,key,reveal){if(s.interludes.some(x=>x.key===key)||s.flags['scene_'+key])return;const authored=RHYTHM_SCENES[key]||{title:key.replaceAll('_',' '),text:'something has changed.',presentation:'scene'};const entry={...authored,key,...(reveal?{reveal}:{})};s.flags['scene_'+key]=true;s.interludes.push(entry);s.journal.push({turn:s.turn,hours:s.hours,title:entry.title,text:entry.text,presentation:'scene',changes:[]});}
function displayInterlude(s){if(!s.interludes.length)return;if(!s.interludeReturn)s.interludeReturn=s.lastOutcome;s.lastOutcome={...s.interludes[0]};}
function durationFor(s){return s.rhythm.mode==='spaced'?24*s.rhythm.stepDays:windowDuration(s);}
function taskEligible(a,s){return eligible(a,s)&&!(a.id==='rest')&&!(a.id==='temporary_shift'&&windowAt(s).id!=='daytime')&&!(a.id==='return_to_hole'&&(s.flags.pactMade||s.stats.hunger<40));}
function blockedReason(a,s){
 if(s.interludes.length)return 'Read what is happening first.';
 if(s.pendingEvent&&a.eventId!==s.pendingEvent)return 'You have to answer what is happening first.';
 if(a.eventId&&a.eventId!==s.pendingEvent)return 'That conversation is not happening now.';
 if((a.id==='stage1_complete'||a.id===FINISH.id)&&!stageReady(s))return 'There are still commitments between you and this life.';
 if(!a.eventId&&!taskEligible(a,s))return 'That opportunity is not available now.';
 if(a.meal&&s.progress.lastMealDay===dayNumber(s))return 'You have already had this day’s meal opportunity.';
 const req=currentRequirement(a,s);if(s.stats.choice<req)return `Requires ${req} Choice. That is very hard for you to do.`;
 const effects=evaluate(a.effects,s,{});if(s.money+Number(effects.money||0)<-.00001)return `You need $${Math.ceil(-effects.money)}.`;
 if(s.food+Number(effects.food||0)<-.00001)return `You need ${Math.ceil(-effects.food)} bags of food.`;
 if(['feed_friend','stock_feeder'].includes(a.id)&&(!s.flags.pactMade||s.stats.hunger<12))return 'The appetite is quiet enough for now.';
 if(a.id==='wait'&&(isScheduledWork(s)||windowAt(s).id==='night'&&s.rhythm.mode==='daily'||!s.flags.pactMade&&s.stats.hunger>=65))return 'This part of the day needs your attention.';
 return '';
}
export function taskSuccessChance(s,a){if(!a.task)return 1;const t=s.personality;const affinity=a.task.skill==='social'?t.empathy*.12+t.honesty*.08:t.resolve*.12+t.caution*.1;return clamp(.68-Number(a.task.difficulty||.4)*.3+(s.skills[a.task.skill]||0)*.065+Math.min(.12,s.history.filter(x=>x.id===a.id).length*.015)+affinity+(s.flags.awakening?.1:0),.25,.97);}
function emotionalEffect(s,a,stat,n){const p=s.personality;if(stat==='choice')return n*(1+p.resolve*.12);if(stat==='disquiet')return n*(1+p.caution*.12-p.resolve*.08)*(n>0?1+s.stats.hunger/60:1);if(stat==='rapture')return n*(1+(['relationship','social','care','story'].includes(a.category)?p.empathy*.15:p.resolve*.1))*(n>0?1/(1+s.stats.hunger/45):1);return n;}
function maybeReset(s,changes,source){if(s.stats.rapture>0)return;s.resets++;appendChange(s,changes,'rapture',42,'reset','A reset. You can continue; the consequences remain.');s.progress.lastResetAt=s.hours;}
function pay(s,changes,amount,source,label){const paid=Math.min(s.money,amount);appendChange(s,changes,'money',-paid,source,label);s.dayLedger.expenses+=paid;if(paid<amount)s.progress.foodDebt=round((s.progress.foodDebt||0)+amount-paid);}
function repayDebt(s,changes,income,source){if(income<=0||!s.progress.foodDebt)return;const payment=Math.min(s.money,s.progress.foodDebt,income*.25);appendChange(s,changes,'money',-payment,source,'Repaying what you owe');s.progress.foodDebt=round(s.progress.foodDebt-payment);s.dayLedger.expenses+=payment;}
function automaticCare(s,changes,availableAt=s.hours){if(!s.flags.careContract)return;if(s.stats.hunger<50)return;if(!hasAvailableHelper(s,availableAt)){s.flags.deliveryMissed=true;return;}const load=Math.min(s.flags.wagon?8:2,Math.max(1,Math.ceil((s.stats.hunger-5)/reliefPerBag(s))));const missing=Math.max(0,load-s.food);if(s.money<missing*4){s.flags.deliveryMissed=true;return;}if(missing){pay(s,changes,missing*4,'automatic-care','Food delivered to the hole');appendChange(s,changes,'food',missing,'automatic-care','The market supplies the agreed delivery');}appendChange(s,changes,'food',-load,'automatic-care','Food actually thrown into the hole');appendChange(s,changes,'hunger',-load*reliefPerBag(s),'automatic-care','Your helper feeds the hole');s.dayLedger.automaticDeliveries++;s.dayLedger.deliveries++;s.dayLedger.bags+=load;s.progress.feeds++;s.care.lastFedAt=s.hours;s.care.nextFeedAt=s.hours+Math.max(0,60-s.stats.hunger)/metaphysicalRate(s);s.flags.deliveryMissed=false;}
function nightRecovery(s,changes){
 const night={category:'night'};
 appendChange(s,changes,'disquiet',emotionalEffect(s,night,'disquiet',-nightlyDisquietRelief(s)),'night','Sleep still comes between the days');
 appendChange(s,changes,'rapture',emotionalEffect(s,night,'rapture',10+Math.min(4,s.lifestyle/20)),'night','Rest in the days between');
}
function drainDisquiet(s,changes,loss,source){
 // Time keeps passing through a collapse. Only chosen sacrifices may stop at
 // the Rapture available before a reset; an hour's remaining drain still applies.
 let remaining=round(loss);
 while(remaining>0){
  maybeReset(s,changes,source);
  const before=s.stats.rapture;
  appendChange(s,changes,'rapture',-remaining,source,'Disquiet through the day');
  const paid=round(before-s.stats.rapture);
  s.dayLedger.disquietLoss=round(s.dayLedger.disquietLoss+paid);
  remaining=round(remaining-paid);
 }
}
function advanceTime(s,changes,duration,source,{manualTrip=false}={}){
 // Preserve an old save's pending transport accounting once, before new trips are counted.
 s.dayLedger.automaticDeliveries ??= s.flags.careContract&&hasHelper(s)?s.dayLedger.deliveries:0;
 const start=s.hours,end=round(start+duration);
 while(s.hours<end-.00001){
  const dayStart=Math.floor(s.hours/24)*24,boundary=dayStart+24,nightStart=dayStart+17;
  // A skipped night begins at the same 22:00 boundary as an explicit night.
  // An explicit rest at that boundary has already applied its own recovery.
  if(!manualTrip&&s.rhythm.mode==='spaced'&&Math.abs(s.hours-nightStart)<.0001&&!(source==='night_rest'&&Math.abs(s.hours-start)<.0001))nightRecovery(s,changes);
  const nextNight=s.hours<nightStart-.0001?nightStart:nightStart+24;
  const dt=Math.min(1,end-s.hours,boundary-s.hours,nextNight-s.hours);
  const loss=s.stats.disquiet*dt/24;
  appendChange(s,changes,'hunger',metaphysicalRate(s)*dt,source,'Metaphysical Hunger grows with time');
  const availableAt=s.hours;s.hours=round(s.hours+dt);if(!manualTrip)automaticCare(s,changes,availableAt);drainDisquiet(s,changes,loss,source);maybeReset(s,changes,source);
  if(Math.abs(s.hours-boundary)<.0001){
   if(s.flags.modelLaunched){const profit=44+(s.dayLedger.day*7%13);appendChange(s,changes,'money',profit,'trader','Your tested automated trader');s.dayLedger.income+=profit;repayDebt(s,changes,profit,'trader');}
   pay(s,changes,6,'night','Daily living costs');
   if(s.dayLedger.day%7===0)pay(s,changes,65,'night','Weekly rent and bills');
   if(s.dayLedger.automaticDeliveries>0)pay(s,changes,3,'night','Your helper’s transport');
   const report={...s.dayLedger,hungerEnd:s.stats.hunger,resets:s.resets-s.dayLedger.resetsStart};
   s.nights.push(report);s.nights=s.nights.slice(-90);s.dayLedger=ledger(s);
   if(s.rhythm.mode==='spaced'&&!denseLife(s)){s.rhythm.mode='daily';s.rhythm.stepDays=1;break;}
  }
 }
}
function compactChanges(changes){const groups=new Map();for(const c of changes){const key=[c.stat,c.source,c.label,Math.sign(c.amount)].join('|');const old=groups.get(key);if(old)old.amount=round(old.amount+c.amount);else groups.set(key,{...c});}return [...groups.values()];}
function nightText(s,report){if(!report)return '';return `Disquiet took ${report.disquietLoss.toFixed(1)} Rapture over ${report.days>1?report.days+' days':'the day'}.\n$${report.expenses.toFixed(2)} spent. $${report.income.toFixed(2)} earned.${report.deliveries?`\n${report.deliveries} deliveries; ${report.bags} bags into the hole.`:''}\nHunger ${report.hungerEnd.toFixed(1)}.${report.resets?` ${report.resets} ${report.resets===1?'reset':'resets'}.`:''}${s.progress.foodDebt?`\n$${s.progress.foodDebt.toFixed(2)} still owed.`:''}`;}
function resolve(state,a,{preview=false}={}){
 const s=clone(state),changes=[];const succeeded=!a.task||preview||random(s)<taskSuccessChance(state,a);const effects=evaluate(succeeded?a.effects:a.task.failureEffects,state,{});const requestedDuration=durationFor(state);let duration=requestedDuration;
 const delivery=['feed_friend','stock_feeder','provision_and_feed','emergency_delivery','return_to_hole'].includes(a.id);
 if(delivery){duration=windowDuration(state);s.rhythm.mode='daily';s.rhythm.stepDays=1;}
 const directD=emotionalEffect(state,a,'disquiet',Number(effects.disquiet||0));appendChange(s,changes,'disquiet',directD,a.id,directD>0?'Hunger sharpens the difficult part':'The world grows quieter');
 appendChange(s,changes,'rapture',emotionalEffect(state,a,'rapture',Number(effects.rapture||0)),a.id,Number(effects.rapture||0)>0?'Pleasure, diminished by Hunger':'What you choose to sacrifice');
 let bonus=emotionalEffect(state,a,'choice',choiceBonus(a,state,changes));if(a.recovery)bonus=Math.min(bonus,Math.max(0,a.recovery.ceiling-state.stats.choice));appendChange(s,changes,'choice',bonus,a.id,'Rapture sacrificed for a decision');appendChange(s,changes,'choice',-Math.max(0,Number(evaluate(a.ethics,state,0))),a.id,'A promise to yourself becomes smaller');
 if(Number(effects.choice||0)<0)appendChange(s,changes,'choice',effects.choice,a.id,'What the decision asks');
 const money=Number(effects.money||0);appendChange(s,changes,'money',money,a.id,money<0?'Spent':'Earned');s.dayLedger[money<0?'expenses':'income']+=Math.abs(money);
 repayDebt(s,changes,money,a.id);
 appendChange(s,changes,'food',Number(effects.food||0),a.id,Number(effects.food||0)<0?'Food for the hole':'Supplies');appendChange(s,changes,'lifestyle',Number(effects.lifestyle||0),a.id,'The way you live');s.lifestyle=clamp(s.lifestyle);
 for(const k of SKILL_KEYS){let gain=Number(effects.skills?.[k]||0);if(gain>0&&['coding','math','finance'].includes(k))gain*=1+(s.flags.pactMade?.25:0)+(s.flags.awakening?.35:0);if(gain>0&&k==='practical'&&s.flags.recruitedEthan)gain*=1.2;appendChange(s,changes,`skills.${k}`,gain,a.id,s.flags.pactMade?'Understanding comes too easily':'Practice');}
 for(const k of RELATIONSHIP_KEYS)appendChange(s,changes,`relationships.${k}`,Number(effects.relationships?.[k]||0),a.id,'A bond changes');
 for(const[k,n]of Object.entries(effects.progress||{}))s.progress[k]=Math.max(0,round((s.progress[k]||0)+n));Object.assign(s.flags,effects.flags||{});
 for(const k of PERSONALITY_KEYS)s.personality[k]=round(clamp(state.personality[k]+Number(evaluate(a.personality,state,{})[k]||0),-1,1));
 const helpersOff=(a.helperBreaks||[]).map(id=>HELPERS.find(h=>h.id===id)).filter(h=>h&&s.flags['recruited'+h.flag]);
 for(const h of helpersOff)s.progress[h.id+'RestUntil']=Math.max(s.progress[h.id+'RestUntil']||0,dayNumber(state)*24);
 const helperReactions=helperConsequences(s,changes);
 const restingHelpers=helpersOff.filter(h=>s.flags['recruited'+h.flag]);
 if(restingHelpers.length)helperReactions.push(restingHelpers.map(h=>h.name).join(' and ')+(restingHelpers.length===1?' is':' are')+' off until morning.'+(s.flags.careContract?(hasAvailableHelper(s)?' Another helper can make the deliveries.':' No helper will make a delivery before morning. The appetite keeps growing.') : ''));
 if(state.rhythm.mode==='spaced'&&!denseLife(s)){s.rhythm.mode='daily';s.rhythm.stepDays=1;duration=windowDuration(state);}
 maybeReset(s,changes,a.id);advanceTime(s,changes,duration,a.id,{manualTrip:delivery});
 // Nothing but food delivered to the hole can reduce metaphysical Hunger.
 if(delivery){const load=a.id==='return_to_hole'?1:Math.max(0,-Number(effects.food||0),Number(effects.progress?.bagsDelivered||0));appendChange(s,changes,'hunger',a.id==='return_to_hole'?8-s.stats.hunger:-load*reliefPerBag(state),a.id,'Food in the hole. Your own appetite eases.');s.dayLedger.deliveries++;s.dayLedger.bags+=load;s.care.lastFedAt=s.hours;s.care.nextFeedAt=s.hours+Math.max(0,60-s.stats.hunger)/metaphysicalRate(s);if(a.id==='return_to_hole'){s.progress.pactAt=s.hours;s.progress.feeds++;s.flags.pactMade=true;}}
 s.turn++;s.progress[`visits_${a.id}`]=(state.progress[`visits_${a.id}`]||0)+1;if(a.meal)s.progress.lastMealDay=dayNumber(state);if(a.id==='temporary_shift')s.progress.lastShiftDay=dayNumber(state);
 s.history.push({id:a.id,category:a.category||'other',subcategory:a.subcategory||a.id,turn:s.turn,day:dayNumber(state),slot:windowAt(state).id});s.history=s.history.slice(-MAX_HISTORY);
 const authored=succeeded?a.outcome:a.task.failureOutcome;const raw=evaluate(authored,state,{title:a.label,text:a.description||'The hours pass.'});const outcome=typeof raw==='string'?{title:a.label,text:raw}:{...raw};
 if(helperReactions.length){outcome.text+='\n\n'+helperReactions.join('\n\n');outcome.presentation='scene';}
 const interval=s.nights.filter(n=>n.day>=dayNumber(state)&&n.day<dayNumber(s));
 if(a.id==='night_rest'||(state.rhythm.mode==='spaced'||delivery)&&interval.length){
  const report=interval.length?{...interval.at(-1),days:interval.length,disquietLoss:interval.reduce((n,r)=>n+r.disquietLoss,0),expenses:interval.reduce((n,r)=>n+r.expenses,0),income:interval.reduce((n,r)=>n+r.income,0),deliveries:interval.reduce((n,r)=>n+r.deliveries,0),bags:interval.reduce((n,r)=>n+r.bags,0),resets:interval.reduce((n,r)=>n+r.resets,0)}:s.nights.at(-1);let dream='no dream you can remember.';const candidates=NIGHT_DREAMS.filter(d=>!d.when||d.when(s));if(candidates.length&&dayNumber(state)%(s.rhythm.mode==='spaced'?4:3)!==0)dream=candidates[(dayNumber(state)-1)%candidates.length].text;
  outcome.title=a.id==='night_rest'?'Night':outcome.title;outcome.text+=(delivery?'\n\nawake. the night passes on the road.\n\nBefore the food reaches the hole:':a.id==='night_rest'?'\n\n'+dream:'\n\nthe days pass. '+(dayNumber(state)%4===0?dream:''))+'\n\n'+nightText(s,report);outcome.presentation='scene';
  if(!delivery){s.rhythm.mode=denseLife(s)?'spaced':'daily';s.rhythm.stepDays=compressedDays(s);}
 }
 if(state.rhythm.mode==='spaced'&&s.hours-state.hours<requestedDuration-.001)outcome.text+=windowAt(s).id==='morning'?'\n\nthe next day needs your attention.':'\n\nthe day needs your attention.';
 return {state:s,changes:compactChanges(changes),outcome,taskSucceeded:succeeded};
}
function milestones(s){const items=CONTENT.STAGE1_MILESTONES.map(m=>({id:m.id,label:m.label,done:!!m.test(s),detail:String(evaluate(m.detail,s,''))}));items.push({id:'security',label:'Carry the cost of the life you are making',done:!!s.flags.stockWon&&!!s.flags.careContract&&s.money>=120,detail:!s.flags.foodStrain?'The cost has not yet revealed itself.':!s.flags.stockWon?'Learn, and follow the opportunity the food bill makes urgent.':!s.flags.careContract?'A wagon, a market arrangement, and a trusted helper can keep the deliveries going.':s.money<120?'Leave some money beyond the next delivery.':'There is food, and money beyond tomorrow.'});return s.flags.stage1Complete?items.map(item=>({...item,done:true,detail:'Completed in Stage 1.'})):items;}
function stageReady(s){return milestones(s).every(m=>m.done)&&s.stats.hunger<75&&!s.crisis&&dayNumber(s)>=24;}
function eventFits(e,s){if(!evaluate(e.when,s,true))return false;if(s.rhythm.mode==='spaced')return true;const slots=e.timeSlots||(/person|house|jim|ethan|wendy|helper/.test(e.id)?['evening']:['morning','evening']);return slots.includes(windowAt(s).id);}
function intentWeight(a,s){let weight=Math.max(.01,Number(evaluate(a.weight,s,3)));const intents=Object.values(s.rhythm.intentions);const match=(intents.includes('learning')&&a.category==='learning')||(intents.includes('money')&&['career','work'].includes(a.category))||(intents.includes('trader')&&/model|trader|stock|budget/.test(a.id))||(intents.includes('care')&&a.category==='care')||(intents.includes('home')&&/clean|repair|wash|budget/.test(a.id))||(intents.includes('pleasure')&&Number(evaluate(a.effects,s,{}).rapture||0)>0)||(intents.includes('person')&&/person|trust/.test(a.id))||(intents.includes('friends')&&/jim|ethan|wendy/.test(a.id))||(intents.includes('house')&&/brothel|madame|priestess|fool|sun/.test(a.id))||(intents.includes('town')&&a.category==='town');if(match)weight*=4;const recent=s.history.slice(-6).filter(h=>h.id===a.id).length;weight*=Math.pow(.18,recent);if(blockedReason(a,s))weight*=.15;return weight;}

function directedOpportunity(s,pool){
 const order=[];
 if(s.flags.foodStrain&&!s.flags.stockWon){if(s.skills.finance<2)order.push('study_finance');else if(s.skills.coding<1)order.push('learn_code');else if(s.money<80)order.push('paid_small_program','temporary_shift');}
 const mode=s.rhythm.intentions.fintech;
 if(mode==='trader'||s.flags.stockWon)order.push('test_trader','launch_model','build_model',...(!s.flags.budgetSorted?['make_budget']:[]));
 if((mode==='money'&&s.money<200)||(s.flags.traderBuilt&&!s.flags.modelLaunched&&s.money<100))order.push('paid_small_program','salaried_work');
 const learn=[['learn_code','coding',4],['study_math','math',3],['study_finance','finance',3],['learn_practical','practical',2],['practice_social','social',2]].filter(([,k,n])=>s.skills[k]<n).sort((a,b)=>s.skills[a[1]]/a[2]-s.skills[b[1]]/b[2]).map(x=>x[0]);
 const person=['repair_trust','meet_person',...((s.progress.conversations||0)<2?['talk_person']:[]),'cafe_person','walk_person','confide_person','honest_limit',...(s.relationships.person<11?['talk_person']:[])];
 const friends=[...((s.progress.townVisits||0)<1?['go_town']:[]),'reassure_ethan','reassure_jim','reassure_wendy','recruit_ethan','recruit_jim','recruit_wendy','meet_ethan','meet_jim','meet_wendy',...(s.relationships.ethan<5?['talk_ethan']:[]),...(s.relationships.jim<5?['talk_jim','jim_sober']:[]),...(s.relationships.wendy<5?['talk_wendy']:[])];
 const house=['visit_brothel','meet_priestess','meet_fool','meet_sun','company_sun','company_fool','company_priestess','talk_madame'];
 const town=[...(s.relationships.town<4?['go_town']:[]),...(!hasHelper(s)?friends:person)];
 const social={person,friends,house,town}[s.rhythm.intentions.social];
 const care=['arrange_surplus',...(!s.flags.wagon&&s.flags.foodStrain?['buy_wagon']:[]),'arrange_deliveries',...(s.stats.disquiet>35?['clean_room']:[])];
 const lanes=[learn,social,care];order.push(...lanes[s.turn%3],...lanes[(s.turn+1)%3],...lanes[(s.turn+2)%3]);
 return order.map(id=>pool.find(a=>a.id===id)).find(a=>a&&!blockedReason(a,s));
}

function selectOffers(s){
 if(s.phase!=='playing'){s.offers=[];return;}if(s.interludes.length){s.offers=s.pendingEvent?eventMap.get(s.pendingEvent).options.map(o=>o.id):[];return;}
 if(s.pendingEvent){s.offers=eventMap.get(s.pendingEvent).options.map(o=>o.id);return;}
 if(s.rhythm.mode==='daily'&&windowAt(s).id==='night'){s.offers=['night_rest'];return;}
 if(isScheduledWork(s)){s.offers=['temporary_shift'];return;}
 if(!s.flags.pactMade&&s.stats.hunger>=65){s.offers=['return_to_hole'];return;}
 if(s.turn-s.lastEventTurn>=7&&s.flags.pactMade){const eligibleEvents=storyEvents.filter(e=>!s.completedEvents.includes(e.id)&&eventFits(e,s));const e=eligibleEvents.find(e=>e.id==='person_confrontation')||eligibleEvents[0];if(e){s.pendingEvent=e.id;s.offers=e.options.map(o=>o.id);if(/person_confrontation/.test(e.id)&&!s.flags.choiceDiscovered)queueScene(s,'choice_discovery','choice');return;}}
 const pool=ACTIONS.filter(a=>taskEligible(a,s)&&!a.id.startsWith('crisis_')&&!['night_rest','stage1_complete','temporary_shift'].includes(a.id)&&(!a.timeSlots||s.rhythm.mode==='spaced'||a.timeSlots.includes(windowAt(s).id))&&(!a.meal||s.progress.lastMealDay!==dayNumber(s))&&(s.flags.pactMade||['self','avoidance','town','rest'].includes(a.category)||a.id==='return_to_hole'));
 const selected=[];const add=id=>{const at=pool.findIndex(a=>a.id===id);if(at>=0&&!blockedReason(pool[at],s)){selected.push(id);pool.splice(at,1);return true;}return false;};
 if(stageReady(s))selected.push('stage1_complete');
 if(s.flags.pactMade&&s.stats.hunger>=50&&!(s.flags.careContract&&hasAvailableHelper(s)&&!s.flags.deliveryMissed)){if(!add('feed_friend'))if(!add('provision_and_feed'))add('emergency_delivery');}
 if(!s.flags.pactMade&&s.stats.hunger>=40)add('return_to_hole');
 const neededChoice=pool.some(a=>['learning','relationship','work','career'].includes(a.category)&&currentRequirement(a,s)>s.stats.choice);if(s.stats.choice<50&&neededChoice&&selected.length<2)add('wash_one_cup');
 if(s.stats.rapture<16){const pleasure=pool.filter(a=>Number(evaluate(a.effects,s,{}).rapture||0)>5&&!blockedReason(a,s)).sort((a,b)=>{const x=evaluate(a.effects,s,{}),y=evaluate(b.effects,s,{});return (Number(y.rapture)-2*Number(y.disquiet||0))-(Number(x.rapture)-2*Number(x.disquiet||0));})[0];if(pleasure&&selected.length<2)add(pleasure.id);}
 if(s.stats.choice<32&&selected.length<2)add('wash_one_cup');
 const important=['stock_gamble','arrange_deliveries',...(s.flags.foodStrain&&!s.flags.wagon?['buy_wagon']:[]),...(!s.flags.metPerson&&s.flags.pactMade?['meet_person']:[])];for(const id of important)if(selected.length<3&&add(id))break;
 const direction=directedOpportunity(s,pool);if(direction&&selected.length<3)add(direction.id);
 while(selected.length<3&&pool.length){const weights=pool.map(a=>intentWeight(a,s));let pick=random(s)*weights.reduce((a,b)=>a+b,0),idx=pool.length-1;for(let i=0;i<pool.length;i++){pick-=weights[i];if(pick<0){idx=i;break;}}selected.push(pool.splice(idx,1)[0].id);}
 if(!selected.length)selected.push('wait');s.offers=[...new Set(selected)];
}
function offerView(a,s){const scheduled=a.id==='temporary_shift'&&isScheduledWork(s);const action=scheduled?{...a,requirement:()=>0}:a;const lockedReason=blockedReason(action,s);const effects=evaluate(a.effects,s,{});const cost=Number(effects.money||0);const preview=lockedReason?null:resolve(s,action,{preview:true});return {id:a.id,label:scheduled?'Work your scheduled grocery shift':a.label,description:(scheduled?'You are on the rota. 9 a.m.–5 p.m. $52 before bills. ':String(evaluate(a.description,s,'')))+(cost<0&&!/\$/.test(String(evaluate(a.description,s,'')))?` Costs $${-cost}.`:''),category:a.category||'other',duration:preview?round(preview.state.hours-s.hours):durationFor(s),requirement:currentRequirement(action,s),requirementHint:choiceRequirementHint(action,s,lockedReason),available:!lockedReason,lockedReason,blinking:!lockedReason&&Number(effects.rapture||0)>0,thorny:Number(effects.rapture||0)<0,preview:preview?.changes||[],finish:a.id===FINISH.id||a.id==='stage1_complete',uncertain:!!a.task,mandatory:scheduled||a.id==='night_rest'||a.id==='return_to_hole'&&!s.flags.pactMade&&s.stats.hunger>=65};}
function careDescription(s){
 if(!s.flags.pactMade)return 'You do not want to make another trip.';
 if(!s.flags.careContract)return 'Food must go into the hole.';
 if(!hasHelper(s))return 'No one is making the trips. Bring food yourself, or find someone willing to help.';
 if(!hasAvailableHelper(s))return 'Your helper is off until morning. No automatic deliveries tonight. The appetite keeps growing.';
 const status=s.flags.deliveryMissed?'A helper is available. The last delivery could not be made.':'A helper takes food to the hole.';
 return status+' Food comes from your supplies; missing bags cost $4 each. Transport costs $3 on days a helper delivers.';
}
function systemsView(s){return SYSTEMS.map(system=>{let text;if(system.id==='local')text=`${s.flags.hungerDiscovered?'Hunger is '+s.stats.hunger.toFixed(1)+'. Eating cannot relieve it.':'You have not admitted what the appetite wants.'}\n${s.food} bags. ${s.flags.wagon?'A wagon.':'Two bags at a time, in your hands.'}\n${careDescription(s)}\n${s.flags.lifestyleDiscovered?'Lifestyle '+s.lifestyle.toFixed(1)+'.':'Your room. Your habits.'} ${s.progress.foodDebt?`$${s.progress.foodDebt.toFixed(2)} owed.`:''}`;else if(system.id==='fintech')text=`$${s.money.toFixed(2)}. Living costs $6 a day; rent and bills $65 a week.\n${s.flags.financialSecurity&&s.money>=100?'You can choose how to use the working day.':'Grocery shifts: Monday–Friday, 9 a.m.–5 p.m. $52 a shift.'}\nCoding ${s.skills.coding.toFixed(1)}. Math ${s.skills.math.toFixed(1)}. Markets ${s.skills.finance.toFixed(1)}.\n${s.flags.stockWon?'The stock paid. You still remember knowing.':s.flags.foodStrain?'The cost of food demands another way.':'You keep looking at what might be possible.'}`;else text=`${s.flags.metPerson?'PERSON has her own life. Make room for it.':'There are people beyond these rooms.'}\n${HELPERS.filter(h=>s.flags['recruited'+h.flag]).map(h=>h.name+(availableHelpers(s).includes(h.flag)?' helps.':' is off until morning.')).join(' ')}\nThe house: tea $3; THE SUN $30; THE FOOL $35; THE PRIESTESS $40.\nLooking and setting an intention cost no time.`;return {id:system.id,label:system.label,unlocked:systemUnlocked(system,s),hint:'An intention makes related opportunities more likely. It does not spend this part of the day.',text,actions:INTENTIONS[system.id].map(i=>({id:`intent:${system.id}:${i.value}`,label:i.label,description:i.description,category:'intention',selected:s.rhythm.intentions[system.id]===i.value,available:true,requirement:0,duration:0,preview:[],blinking:false,thorny:false,system:system.id}))};});}
export function getView(s){const event=eventMap.get(s.pendingEvent),interlude=s.interludes.length>0;const scheduled=isScheduledWork(s);return {phase:s.phase,intro:s.phase==='intro'?INTRO[s.introIndex]:null,title:s.phase==='intro'?INTRO[s.introIndex].title:s.lastOutcome?.title||'A long nap',text:s.phase==='intro'?INTRO[s.introIndex].text:s.lastOutcome?.text||CONTENT.STAGE1_START,interlude,chapter:s.phase==='stage2'?'Stage 2':s.flags.timeStretched?'The days loosen':s.flags.stockWon?'You knew':s.flags.foodStrain?'The cost':s.flags.pactMade?'The pact':'Denial',mood:s.stats.hunger>=70?'The appetite is inside everything':s.flags.pactMade?'More of the world reaches you':'You do not want to return',offers:s.phase==='playing'&&!interlude?s.offers.map(id=>actionMap.get(id)).filter(Boolean).map(a=>offerView(a,s)):[],wait:s.phase==='playing'&&!interlude&&!event&&!scheduled&&!(windowAt(s).id==='night'&&s.rhythm.mode==='daily')&&!(s.stats.hunger>=65&&!s.flags.pactMade)?offerView(WAIT,s):null,storyEvent:event&&!interlude?{id:event.id,title:event.title,text:String(evaluate(event.text,s,'')),options:event.options.map(o=>offerView(actionMap.get(o.id),s))}:null,systems:systemsView(s),revealedStats:revealedStats(s),presentation:s.phase==='intro'||interlude?'scene':s.lastOutcome?.presentation||'log',milestones:milestones(s),ready:stageReady(s),day:dayNumber(s),hour:gameDate(s.hours).hour,calendar:gameDate(s.hours),care:friendCare(s),crisis:null,ending:s.ending||null,resets:s.resets,lifestyle:s.lifestyle,rhythm:{day:dayNumber(s),slot:windowAt(s).id,label:s.rhythm.mode==='spaced'?(s.rhythm.stepDays>1?'A few days':'Today'):windowAt(s).label,density:s.rhythm.mode,scheduledWork:scheduled,stepDays:s.rhythm.stepDays},timeline:ARC_TIMELINE};}
function finishTurn(result,old,a){const s=result.state;if(a.eventId){s.completedEvents.push(a.eventId);s.pendingEvent=null;s.lastEventTurn=s.turn;}
 if(a.id==='return_to_hole'){queueScene(s,'first_return');queueScene(s,'pact');queueScene(s,'hunger_discovery','hunger');queueScene(s,'disquiet_discovery','disquiet');result.outcome={title:'The agreement',text:'you know where the next meal must go.',presentation:'log'};}
 if(!s.flags.raptureDiscovered&&result.changes.some(c=>c.stat==='rapture'&&c.source===a.id&&c.amount>0))queueScene(s,'rapture_discovery','rapture');
 if(s.lifestyle!==old.lifestyle&&!s.flags.lifestyleDiscovered)queueScene(s,'lifestyle_discovery','lifestyle');
 if(s.flags.pactMade&&!s.flags.awakening&&s.hours-(s.progress.pactAt||0)>=24){s.flags.awakening=true;queueScene(s,'sensitivities');}
 if(s.flags.pactMade&&dayNumber(s)>=14&&!s.flags.foodStrain){s.flags.foodStrain=true;queueScene(s,'food_strain');}
 if(s.flags.wagon&&!old.flags.wagon)queueScene(s,'wagon');
 if(s.flags.stockPosition&&!s.flags.stockWon&&s.hours-(s.progress.stockBoughtAt||0)>=24){appendChange(s,result.changes,'money',1600,'stock-settlement','The fictional stock pays off');s.dayLedger.income+=1600;repayDebt(s,result.changes,1600,'stock-settlement');s.flags.stockWon=true;s.flags.stockPosition=false;s.flags.financialSecurity=true;appendChange(s,result.changes,'rapture',emotionalEffect(s,a,'rapture',35),'stock-settlement','You feel that you knew');appendChange(s,result.changes,'disquiet',6,'stock-settlement','The certainty frightens you');queueScene(s,'stock_gamble_win');}
 if(s.flags.stockWon&&s.flags.metPerson)queueScene(s,'money_security');
 if(s.flags.careContract&&s.flags.modelLaunched&&!s.flags.timeStretched){s.flags.timeStretched=true;queueScene(s,'time_stretch');}
 if(s.resets>old.resets){if(!s.flags.resetDiscovered)queueScene(s,'reset_discovery');else s.interludes.push({key:'reset_repeat',title:'Again',text:RESET_PASSAGES[Math.max(0,s.resets-2)%RESET_PASSAGES.length],presentation:'scene'});s.flags.resetDiscovered=true;}
 if(s.flags.careContract&&!hasHelper(s)){s.flags.deliveryMissed=true;s.rhythm.mode='daily';s.rhythm.stepDays=1;if(hasHelper(old))result.outcome.text+='\n\nthe delivery book closes. no one is making the trips now. you will have to bring the food yourself.';}
 if(a.id==='stage1_complete'||a.id===FINISH.id){queueScene(s,'intimacy');s.phase='dream';s.flags.relationship=true;s.flags.stage1Complete=true;s.offers=[];}
 const major=['wagon','awakening','recruitedJim','recruitedEthan','recruitedWendy','traderBuilt','traderTested','modelLaunched','relationship'].some(f=>s.flags[f]&&!old.flags[f]);result.outcome.presentation=result.outcome.presentation==='scene'||major?'scene':'log';s.lastOutcome={...result.outcome};s.journal.push({turn:s.turn,hours:s.hours,actionId:a.id,...result.outcome,changes:clone(result.changes),...(a.eventId?{eventId:a.eventId}:{})});s.journal=s.journal.slice(-240);selectOffers(s);displayInterlude(s);return {...result,ok:true,outcome:s.interludes.length?{...s.lastOutcome}:result.outcome};}
export function choose(state,id){
 if(id.startsWith('intent:')&&state.phase!=='intro'){const[,system,value]=id.split(':');if(!INTENTIONS[system]?.some(i=>i.value===value))return {state,ok:false,error:'Unknown intention.',changes:[],outcome:null};const s=clone(state);s.rhythm.intentions[system]=value;return {state:s,ok:true,changes:[],outcome:null};}
 if(state.phase==='intro'){if(id==='decline'&&state.introIndex<2)return {state,ok:true,changes:[],outcome:{title:'',text:INTRO[state.introIndex].refusal,presentation:'scene',returnToLine:INTRO[state.introIndex].returnToLine}};if(id!=='continue')return {state,ok:false,error:'Continue the opening first.',changes:[],outcome:null};const s=clone(state);s.introIndex++;if(s.introIndex>=INTRO.length){s.phase='playing';s.lastOutcome={title:'A long nap',text:CONTENT.STAGE1_START,presentation:'log'};s.journal.push({turn:0,hours:0,...s.lastOutcome});queueScene(s,'denial');queueScene(s,'money_discovery','money');displayInterlude(s);}return {state:s,ok:true,changes:[],outcome:s.lastOutcome};}
 if(state.interludes.length){if(id!=='continue_interlude')return {state,ok:false,error:'Read what is happening first.',changes:[],outcome:null};const s=clone(state),done=s.interludes.shift();if(done.reveal)s.flags[done.reveal+'Discovered']=true;if(s.interludes.length)s.lastOutcome={...s.interludes[0]};else{s.lastOutcome=s.interludeReturn||{title:'The day',text:'the hours are yours.',presentation:'log'};s.interludeReturn=null;selectOffers(s);displayInterlude(s);}return {state:s,ok:true,changes:[],outcome:s.interludes.length?{...s.lastOutcome}:null};}
 if(state.phase==='dream'&&id==='sleep'){const s=clone(state),changes=[];advanceTime(s,changes,7,id);s.turn++;s.phase='complete';s.flags.dreamSeen=true;s.ending='stage-one';const outcome={title:'The dream',text:CONTENT.STAGE1_DREAM,presentation:'scene'};s.lastOutcome=outcome;s.journal.push({turn:s.turn,hours:s.hours,actionId:id,...outcome,changes});return {state:s,ok:true,changes,outcome};}
 if(state.phase==='complete'&&id==='begin_stage2'){const s=clone(state);s.phase='stage2';s.flags.stage2Started=true;s.progress.stage2StartedAt=s.hours;s.progress.stage2TargetAt=s.hours+182*24;s.progress.stage3TargetAt=s.hours+(182+730)*24;s.progress.stage4TargetAt=8*365.25*24;const outcome={title:'STAGE 2',text:'PERSON asleep beside you.\n\nsomewhere else, you are awake.\n\nSix months are opening.',presentation:'scene'};s.lastOutcome=outcome;s.journal.push({turn:s.turn,hours:s.hours,actionId:id,...outcome,changes:[]});return {state:s,ok:true,changes:[],outcome};}
 if(state.phase!=='playing')return {state,ok:false,error:'This chapter has ended.',changes:[],outcome:null};
 if(id!==WAIT.id&&!state.offers.includes(id))return {state,ok:false,error:'That is not one of this part of the day’s opportunities.',changes:[],outcome:null};let a=actionMap.get(id);if(!a)return {state,ok:false,error:'Unknown decision.',changes:[],outcome:null};if(id==='temporary_shift'&&isScheduledWork(state))a={...a,requirement:()=>0};const error=blockedReason(a,state);if(error)return {state,ok:false,error,changes:[],outcome:null};return finishTurn(resolve(state,a),state,a);
}
function hashSeed(seed) {
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) || 1;
}


function random(state) {
  let value = state.rng;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.rng = (value >>> 0) || 1;
  return state.rng / 4294967296;
}


function eligible(action, state) {
  if (typeof action.when === 'function') return Boolean(action.when(state));
  if (action.when && typeof action.when === 'object') return Object.entries(action.when).every(([key, value]) => state.flags[key] === value);
  return true;
}


function currentRequirement(action, state) {
  if (typeof action.requirement === 'function') return Math.round(clamp(action.requirement(state)));
  if (action.category === 'crisis' || action.eventId) return Math.round(clamp(action.requirement || 0));
  const history = state.history.filter(entry => entry.id === action.id).length;
  const categorySkill = { learning: 'coding', career: 'finance', work: 'finance', social: 'social', relationship: 'social', care: 'practical', practical: 'practical' }[action.category];
  const practice = Math.min(7, history * 1.5) + (categorySkill ? Math.min(6, state.skills[categorySkill] * 0.6) : 0);
  let mood = 0;
  if (['social', 'relationship', 'learning', 'career'].includes(action.category)) mood += Math.max(0, state.stats.disquiet - 40) * 0.11;
  if (action.category === 'care') mood -= Math.max(0, state.stats.hunger - 40) * 0.09;
  else mood += Math.max(0, state.stats.hunger - 65) * 0.09;
  return Math.round(clamp((action.requirement || 0) + mood - practice));
}

function choiceRequirementHint(action, state, lockedReason) {
  if (!lockedReason.startsWith('Requires ')) return '';
  const required = currentRequirement(action, state), hints = [];
  const lowered = (stat, limit) => currentRequirement(action, { ...state, stats: { ...state.stats, [stat]: limit } }) < required;
  if (state.flags.hungerDiscovered && state.stats.hunger > 65 && lowered('hunger', 65)) hints.push('Hunger is making this harder to choose. Feeding the hole can lower the Choice it asks for.');
  if (state.flags.disquietDiscovered && state.stats.disquiet > 40 && lowered('disquiet', 40)) hints.push('Disquiet is making this harder to choose. Letting it settle can lower the Choice it asks for.');
  return hints.join('\n\n');
}


function choiceBonus(action, state, changes) {
  // Only Rapture actually sacrificed by this decision qualifies. Daily losses
  // are applied later and cannot earn Choice just by letting time pass.
  if (!changes.some(change => change.stat === 'rapture' && change.amount < 0) || Number(evaluate(action.ethics, state, 0)) > 0) return 0;
  const reward = Number(evaluate(action.challenge, state, 2));
  if (action.meal?.healthy && !action.meal.tasty) {
    const paid = -changes.filter(c => c.stat === 'rapture' && c.source === action.id && c.amount < 0).reduce((n,c) => n+c.amount,0);
    return Math.min(1, paid);
  }
  if (action.recovery) {
    const sacrificed = -changes.filter(change => change.source === action.id && change.stat === 'rapture' && change.amount < 0).reduce((sum, change) => sum + change.amount, 0);
    return Math.min(reward, sacrificed, Math.max(0, action.recovery.ceiling - state.stats.choice));
  }
  let similarity = 0;
  for (const old of state.history) {
    if (old.id === action.id) return 0;
    if (old.category === action.category) similarity = Math.max(similarity, old.subcategory === action.subcategory ? 0.8 : 0.55);
  }
  return reward * (1 - similarity);
}


function appendChange(state, changes, stat, amount, source, label) {
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.000001) return;
  let container = state;
  let key = stat;
  if (STAT_KEYS.includes(stat)) container = state.stats;
  else if (stat.startsWith('skills.')) { container = state.skills; key = stat.slice(7); }
  else if (stat.startsWith('relationships.')) { container = state.relationships; key = stat.slice(14); }
  const old = container[key] || 0;
  let next = old + amount;
  if (STAT_KEYS.includes(stat) || stat === 'lifestyle') next = clamp(next);
  else next = Math.max(0, next);
  container[key] = round(next);
  const actual = round(container[key] - old);
  if (Math.abs(actual) >= 0.0005) changes.push({ stat, amount: actual, source, label });
}


function helperConsequences(state, changes) {
  const reactions = [];
  for (const helper of HELPERS) {
    if (!state.flags[`met${helper.flag}`]) continue;
    const suspicion = state.progress[`${helper.id}Suspicion`] || 0;
    const warned = `warned${helper.flag}`, reported = `reported${helper.flag}`;
    if (suspicion >= 10 && state.flags[warned] && !state.flags[reported]) {
      state.flags[reported] = true;
      state.flags[`recruited${helper.flag}`] = false;
      state.progress.danger = (state.progress.danger || 0) + 1;
      appendChange(state, changes, 'disquiet', 8, helper.id, 'Someone has told the town');
      reactions.push(`${helper.name} has told someone about the trips into the woods. A car slows outside your house. Your friend feels you watching it.`);
    } else if (suspicion >= 6 && !state.flags[warned]) {
      state.flags[warned] = true;
      reactions.push(`${helper.name} no longer believes your explanation. They say they will tell someone if this keeps happening. You still have time to speak honestly and repair their trust.`);
    }
    if (suspicion < 6) state.flags[warned] = false;
  }
  return reactions;
}


function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }

function validChanges(changes) {
  return Array.isArray(changes) && changes.every(change => plainObject(change) && typeof change.stat === 'string' && Number.isFinite(change.amount) && typeof change.source === 'string' && typeof change.label === 'string');
}

function validPresentation(entry) {
  return (entry.presentation === undefined || ['scene', 'log'].includes(entry.presentation)) &&
    (entry.unlockedSystems === undefined || Array.isArray(entry.unlockedSystems) && entry.unlockedSystems.every(id => SYSTEMS.some(system => system.id === id)));
}

function safeData(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  if (typeof value === 'string') return value.length <= 16000;
  if (Array.isArray(value)) return value.length <= MAX_HISTORY && value.every(item => safeData(item, depth + 1));
  if (!plainObject(value) || Object.keys(value).length > 300) return false;
  return Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeData(item, depth + 1));
}

export function validateSave(s){
 if(!safeData(s)||!plainObject(s)||s.version!==SAVE_VERSION)return false;
 if(!['intro','playing','dream','complete','stage2','failed'].includes(s.phase)||typeof s.seed!=='string'||!Number.isInteger(s.rng)||s.rng<=0||s.rng>4294967295)return false;
 if(!Number.isInteger(s.turn)||s.turn<0||!Number.isFinite(s.hours)||s.hours<0||!Number.isInteger(s.introIndex)||s.introIndex<0||s.introIndex>INTRO.length||s.phase==='intro'&&s.introIndex>=INTRO.length)return false;
 for(const[group,keys]of [['stats',STAT_KEYS],['skills',SKILL_KEYS],['relationships',RELATIONSHIP_KEYS]])if(!plainObject(s[group])||!keys.every(k=>Number.isFinite(s[group][k])&&s[group][k]>=0&&(group!=='stats'||s[group][k]<=100)))return false;
 if(!Number.isFinite(s.money)||s.money<0||!Number.isFinite(s.food)||s.food<0||!Number.isFinite(s.lifestyle)||s.lifestyle<0||s.lifestyle>100||!Number.isInteger(s.resets)||s.resets<0)return false;
 if(!plainObject(s.flags)||!Object.values(s.flags).every(x=>typeof x==='boolean')||!plainObject(s.progress)||!Object.values(s.progress).every(x=>Number.isFinite(x)&&x>=0))return false;
 if(!plainObject(s.personality)||!PERSONALITY_KEYS.every(k=>Number.isFinite(s.personality[k])&&Math.abs(s.personality[k])<=1))return false;
 if(!plainObject(s.care)||!Number.isFinite(s.care.lastFedAt)||s.care.lastFedAt<0||s.care.lastFedAt>s.hours||!Number.isFinite(s.care.nextFeedAt)||s.care.nextFeedAt<s.care.lastFedAt)return false;
 if(!plainObject(s.rhythm)||!['daily','spaced'].includes(s.rhythm.mode)||![1,2].includes(s.rhythm.stepDays)||!plainObject(s.rhythm.intentions)||!Object.entries(INTENTIONS).every(([k,list])=>list.some(i=>i.value===s.rhythm.intentions[k])))return false;
 if(!Array.isArray(s.interludes)||s.interludes.length>30||!s.interludes.every(i=>plainObject(i)&&typeof i.key==='string'&&typeof i.title==='string'&&typeof i.text==='string'&&(!i.reveal||ATTRIBUTE_KEYS.includes(i.reveal))))return false;
 if(!plainObject(s.dayLedger)||!['day','disquietLoss','expenses','income','deliveries','bags','hungerStart','resetsStart'].every(k=>Number.isFinite(s.dayLedger[k])&&s.dayLedger[k]>=0)||!Array.isArray(s.nights)||s.nights.length>90)return false;
 if(s.dayLedger.automaticDeliveries!==undefined&&(!Number.isInteger(s.dayLedger.automaticDeliveries)||s.dayLedger.automaticDeliveries<0||s.dayLedger.automaticDeliveries>s.dayLedger.deliveries))return false;
 if(!s.nights.every(n=>plainObject(n)&&['day','disquietLoss','expenses','income','deliveries','bags','hungerStart','resetsStart','hungerEnd','resets'].every(k=>Number.isFinite(n[k])&&n[k]>=0)))return false;
 if(!s.nights.every(n=>n.automaticDeliveries===undefined||Number.isInteger(n.automaticDeliveries)&&n.automaticDeliveries>=0&&n.automaticDeliveries<=n.deliveries))return false;
 if(!Array.isArray(s.completedEvents)||new Set(s.completedEvents).size!==s.completedEvents.length||!s.completedEvents.every(id=>eventMap.has(id))||!Number.isInteger(s.lastEventTurn)||s.lastEventTurn>s.turn||s.lastEventTurn< -3)return false;
 if(s.pendingEvent!==null&&(!eventMap.has(s.pendingEvent)||s.completedEvents.includes(s.pendingEvent)||s.phase!=='playing'))return false;
 if(!Array.isArray(s.offers)||s.offers.length>3||new Set(s.offers).size!==s.offers.length||!s.offers.every(id=>actionMap.has(id)))return false;
 if(s.pendingEvent&&s.offers.join('|')!==eventMap.get(s.pendingEvent).options.map(o=>o.id).join('|'))return false;
 if(!s.pendingEvent&&s.offers.some(id=>actionMap.get(id).eventId))return false;
 if(s.phase==='playing'&&!s.interludes.length&&!s.offers.length)return false;
 if(s.phase!=='playing'&&s.offers.length)return false;
 if(!Array.isArray(s.history)||!s.history.every(e=>plainObject(e)&&typeof e.id==='string'&&typeof e.category==='string'&&typeof e.subcategory==='string'&&Number.isInteger(e.turn)))return false;
 if(!Array.isArray(s.journal)||!s.journal.every(e=>plainObject(e)&&typeof e.title==='string'&&typeof e.text==='string'&&Number.isFinite(e.hours)&&Number.isInteger(e.turn)&&(e.changes===undefined||validChanges(e.changes))&&validPresentation(e)))return false;
 for(const item of [s.lastOutcome,s.interludeReturn])if(item!==null&&(!plainObject(item)||typeof item.title!=='string'||typeof item.text!=='string'||!validPresentation(item)))return false;
 if(['dream','complete','stage2'].includes(s.phase)&&(!s.flags.relationship||!s.flags.stage1Complete))return false;
 if(['complete','stage2'].includes(s.phase)&&!s.flags.dreamSeen)return false;
 return true;
}
export function serializeGame(state){if(!validateSave(state))throw Error('The game cannot be saved because its state is invalid.');return JSON.stringify(state);}
export function restoreGame(text){try{if(typeof text!=='string'||text.length>2_000_000)return null;let s=JSON.parse(text);if(s?.version===1||s?.version===2)s=migrateSave(s);return validateSave(s)?s:null;}catch{return null;}}
function migrateSave(old){
 if(!safeData(old)||!plainObject(old)||!plainObject(old.stats)||!plainObject(old.skills)||!plainObject(old.relationships)||!plainObject(old.flags)||!plainObject(old.progress)||!Array.isArray(old.history)||!Array.isArray(old.journal)||!Number.isFinite(old.hours)||old.hours<0||!Number.isInteger(old.turn)||old.turn<0)return null;
 const s={...createGame(old.seed,old.rules),...old,version:SAVE_VERSION,skills:{math:0,...old.skills},relationships:{...Object.fromEntries(RELATIONSHIP_KEYS.map(k=>[k,0])),...old.relationships},flags:{...old.flags},progress:{...old.progress},stats:{...old.stats},resets:0,lifestyle:20,interludes:[],interludeReturn:null,rhythm:{mode:'daily',stepDays:1,intentions:{local:'balance',fintech:'learning',social:'town'}},nights:[],crisis:null,care:{lastFedAt:Math.min(old.hours,old.care?.lastFedAt||0),nextFeedAt:Math.max(old.hours,old.care?.nextFeedAt||old.hours+24)},personality:old.personality||Object.fromEntries(PERSONALITY_KEYS.map(k=>[k,0])),completedEvents:old.completedEvents||[],pendingEvent:old.pendingEvent||null,lastEventTurn:old.lastEventTurn??Math.max(-3,old.turn-3)};
 s.dayLedger=ledger(s);s.flags.pactMade=!!old.flags.pactMade||(old.progress.feeds||0)>0;if(s.flags.pactMade)s.progress.pactAt=Math.max(0,old.care?.lastFedAt||0);
 if(old.flags.modelLaunched){s.flags.traderBuilt=true;s.flags.traderTested=true;}if(old.version===1&&old.phase==='complete'){s.phase='dream';s.flags.relationship=true;s.flags.stage1Complete=true;}
 for(const k of ATTRIBUTE_KEYS)s.flags[k+'Discovered']=k!=='lifestyle'&&(k==='hunger'||k==='money'||!!old.flags[k+'Discovered']||(old.turn>0&&k!=='choice'));
 if(s.phase==='playing'){queueScene(s,'hunger_discovery','hunger');queueScene(s,'disquiet_discovery','disquiet');s.interludeReturn={title:'The same life',text:'the things you have done remain.\n\nthe appetite has a clearer name now.',presentation:'log'};selectOffers(s);displayInterlude(s);}else s.offers=[];
 return s;
}
