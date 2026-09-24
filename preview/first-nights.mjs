// Roy's September 23–24 writing and clarifications. This opt-in lab overlay
// never writes the live manuscript. Bracketed directions are not story text.
import {seedFrom} from './action-outcomes.mjs';
export const STORY_ENABLED=new URLSearchParams(globalThis.location?.search||'').has('story');
export const storySettings={sleepHour:22,wakeHour:8,sleepChance:0.55,startingPortions:1,mealPortions:1,mealRelief:12,hungryAt:22,offeringMax:3,offeringPerHunger:12,holeReliefTo:8,hungerReveal:'meal'};
const settingsKey='alignment.first-nights-settings.v1';
const ranges={sleepHour:[18,23],wakeHour:[6,12],sleepChance:[0,1],startingPortions:[0,15],mealPortions:[1,5],mealRelief:[0,50],hungryAt:[1,100],offeringMax:[1,15],offeringPerHunger:[1,50],holeReliefTo:[0,50]};
try{
  const saved=JSON.parse(localStorage.getItem(settingsKey)||'{}');
  for(const [key,[min,max]] of Object.entries(ranges))if(Number.isFinite(saved[key])&&saved[key]>=min&&saved[key]<=max&&(key==='sleepChance'||Number.isInteger(saved[key])))storySettings[key]=saved[key];
  if(['meal','begin'].includes(saved.hungerReveal))storySettings.hungerReveal=saved.hungerReveal;
}catch{}
export const saveStorySettings=()=>{try{localStorage.setItem(settingsKey,JSON.stringify(storySettings));}catch{}};
export const STORY_MESSAGES={
  'dream-start':'the first night you have three dreams',
  'dream-bull':'one of a bull flying headless into an ocean',
  'dream-city':'one of a city consumed in purple smoke',
  'dream-laugh':'one of a laugh from a place deeper than you can imagine',
  'dream-pull':'you find yourself sucked into that laugh',
  'body-hungry':'you’re hungry',
  'body-still-hungry':'You’re still hungry, though you can’t stand the sight of food',
  'hole-standing':'you’re standing in front of the hole. everything is still',
  'hole-look':'you look over the edge but it’s just dark in a certain area',
  'hole-say':'you try but cannot bring yourself to speech. it would be pointless',
  'hole-bread':'you throw in some bread and other stuff',
  'hole-unwrap':'you listen and it seems like someone is unwrapping the bread',
  'hole-eat':'then eating just bread',
  'hole-leave':'you can stay no longer',
  'hole-home':'but returning home you find your hunger has subsided'
};
export const STORY_LOGS={...STORY_MESSAGES,'sleep-poor':'your sleep is poor. many werid dreams','hole-better':'you feel much better'};
const action=(id,label,message,log=message)=>({id,label,message,log,minutes:0,effects:{},reveal:[],drainRapture:false,hideWhenDone:true});
const extraActions=[
  {...action('sleep','sleep','dream-start','sleep-poor'),repeatable:true},
  action('go-hole','GO TO THE. HOLE','hole-standing'),
  action('hole-look','look inside','hole-look'),
  {...action('hole-flashlight','use your flashlight',null),choiceLocked:true,requiredChoice:1e12,pain:true},
  {...action('hole-climb','climb inside',null),choiceLocked:true,requiredChoice:1e12,pain:true},
  action('hole-say','say something','hole-say'),
  action('hole-feed','throw in X portions','hole-bread','hole-better')
];
export function extendStoryDocument(document) {
  if(!STORY_ENABLED)return document;
  const doc=structuredClone(document);
  doc.messages={...STORY_MESSAGES,...doc.messages};doc.logs={...STORY_LOGS,...doc.logs};
  doc.messageLinks??={};
  for(const chain of [['dream-start','dream-bull','dream-city','dream-laugh','dream-pull'],['hole-bread','hole-unwrap','hole-eat','hole-leave','hole-home']])
    chain.forEach((id,i)=>{doc.messageLinks[id]??=chain[i+1]?{next:chain[i+1]}:{};});
  doc.actions.push(...structuredClone(extraActions.filter(a=>!doc.actions.some(current=>current.id===a.id))));
  for(const id of ['groceries','dinner','cook'])Object.assign(doc.actions.find(a=>a.id===id),{repeatable:true,hideWhenDone:false});
  doc.hungerIndicator={...doc.hungerIndicator,enabled:true};
  return doc;
}
export function storyTotals(origin,events) {
  const story={portions:origin.portions??storySettings.startingPortions,hungry:false,strange:false,visited:false,encounter:false,looked:false,spoke:false,offering:0,sleptNights:[]};
  for(const e of events){const s=e.story;if(!s)continue;
    story.portions+=s.portions||0;
    if(s.hungry)story.hungry=true;
    if(s.strange)story.strange=true;
    if(s.sleepNight!==undefined)story.sleptNights.push(s.sleepNight);
    if(s.enter){story.encounter=true;story.offering=s.offering;}
    if(s.looked)story.looked=true;if(s.spoke)story.spoke=true;
    if(s.leave){story.encounter=false;story.visited=true;}
  }
  return story;
}
export const storyClock=(state,ui)=>Number(ui.logStartHour??13)*60+state.elapsedMinutes;
export const storyDay=(state,ui)=>Math.floor(storyClock(state,ui)/1440)+1;
export const strangeDay=state=>2+seedFrom(`${state.randomSeed}:strange-day`)%2;
export function storyDate(ui,elapsedMinutes) {
  const days=Math.floor((Number(ui.logStartHour??13)*60+elapsedMinutes)/1440);
  if(!days)return ui;
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const match=/^(\w+) (\d+)(?:st|nd|rd|th)$/.exec(ui.logDate||'');
  if(!match||!months.includes(match[1]))return {...ui,logDate:`${ui.logDate} · day ${days+1}`};
  const date=new Date(Date.UTC(1997,months.indexOf(match[1]),Number(match[2])+days)),n=date.getUTCDate();
  const suffix=n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');
  return {...ui,logDate:`${months[date.getUTCMonth()]} ${n}${suffix}`};
}
export function sleepOffer(state,ui) {
  const clock=storyClock(state,ui),hour=clock%1440/60,night=Math.floor((clock-6*60)/1440);
  const isNight=hour>=storySettings.sleepHour||hour<6;
  const chance=seedFrom(`${state.randomSeed}:sleep:${night}`)/4294967296;
  return {night,available:isNight&&!state.story.sleptNights.includes(night)&&(night===0||chance<storySettings.sleepChance)};
}
const offering=state=>Math.min(state.story.portions,storySettings.offeringMax,Math.max(1,Math.ceil(state.values.hunger/storySettings.offeringPerHunger)));
export function storyVisible(state,action,ui) {
  if(!STORY_ENABLED)return true;
  const s=state.story;
  if(s.encounter){
    if(s.looked&&s.spoke)return action.id==='hole-feed';
    return action.id==='hole-look'&&!s.looked||action.id==='hole-flashlight'&&s.looked||action.id==='hole-climb'||action.id==='hole-say'&&!s.spoke;
  }
  if(action.id.startsWith('hole-'))return false;
  if(action.id==='go-hole')return s.strange&&!s.visited;
  if(action.id==='sleep')return sleepOffer(state,ui).available;
  return true;
}
export function storyPlayable(state,action) {
  if(!STORY_ENABLED)return true;
  if(action.choiceLocked)return false;
  if(['dinner','cook'].includes(action.id))return state.story.portions>=storySettings.mealPortions;
  if(action.id==='go-hole')return state.story.portions>=1;
  if(action.id==='hole-feed')return state.story.offering>=1&&state.story.portions>=state.story.offering;
  return true;
}
export function resolveStoryAction(state,action,ui) {
  if(!STORY_ENABLED)return action;
  const a={...action,effects:{...action.effects},reveal:[...action.reveal]},s=state.story;
  if(a.id==='sleep') {
    const clock=storyClock(state,ui),hour=clock%1440/60;
    a.minutes=(Math.floor(clock/1440)+(hour>=storySettings.wakeHour?1:0))*1440+storySettings.wakeHour*60-clock;
    if(s.sleptNights.length)a.message=null;
  }
  if(['dinner','cook'].includes(a.id)) {
    a.effects.hunger=(a.effects.hunger||0)-(s.hungry&&storyDay(state,ui)>=strangeDay(state)&&!s.visited?0:storySettings.mealRelief);
    if(storySettings.hungerReveal==='meal'&&!a.reveal.includes('hunger')){a.reveal.push('hunger');a.revealAtEnd=true;}
  }
  if(a.id==='hole-feed') {
    a.label=a.label.replace('X',String(s.offering));
    a.effects.hunger=Math.min(0,storySettings.holeReliefTo-state.values.hunger);
  }
  return a;
}
// All numeric tuning is captured on the receipt at commitment. Reading/reload
// never spends portions or time again, and settings cannot rewrite past charges.
export function storyReceipt(state,action,after,ui) {
  if(!STORY_ENABLED)return null;
  const s={};
  if(action.id==='groceries')s.portions=15;
  if(['dinner','cook'].includes(action.id)) {
    s.portions=-storySettings.mealPortions;
    if(state.story.hungry&&!state.story.strange&&!state.story.visited&&storyDay(state,ui)>=strangeDay(state))s.strange=true;
  }
  if(action.id==='sleep')s.sleepNight=sleepOffer(state,ui).night;
  if(action.id!=='sleep'&&Object.hasOwn(state.stats,'hunger')&&!state.story.hungry&&!state.story.encounter&&after.hunger>=storySettings.hungryAt)s.hungry=true;
  if(action.id==='go-hole'){s.enter=true;s.offering=offering(state);}
  if(action.id==='hole-look')s.looked=true;
  if(action.id==='hole-say')s.spoke=true;
  if(action.id==='hole-feed'){s.leave=true;s.portions=-state.story.offering;}
  return Object.keys(s).length?s:null;
}
export function validStoryReceipt(s) {
  if(!s||typeof s!=='object'||Array.isArray(s))return false;
  const flags=['hungry','strange','enter','looked','spoke','leave'];
  if(Object.keys(s).some(k=>![...flags,'portions','sleepNight','offering'].includes(k)))return false;
  if(flags.some(k=>s[k]!==undefined&&s[k]!==true))return false;
  if(s.portions!==undefined&&(!Number.isInteger(s.portions)||Math.abs(s.portions)>1000))return false;
  if(s.sleepNight!==undefined&&(!Number.isInteger(s.sleepNight)||s.sleepNight<0))return false;
  if(s.enter!==undefined&&(!Number.isInteger(s.offering)||s.offering<1||s.offering>1000))return false;
  return s.offering===undefined||s.enter===true;
}
