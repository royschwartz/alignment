import {STAT_KEYS} from './game-stats.mjs';
// Editor input is data, never executable code or HTML.
const id = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/.test(v);
const plain = v => v && typeof v === 'object' && !Array.isArray(v);
const string = v => typeof v === 'string' && v.length <= 30000;
const keys = o => Object.keys(o).every(k => id(k) && !['__proto__','constructor','prototype'].includes(k));
export function validateDocument(doc) {
  const fail = message => { throw new Error(message); };
  if (!plain(doc) || doc.format !== 1 || !id(doc.script)) fail('This is not an Alignment writing file.');
  for (const field of ['messages','logs','statLabels','ui']) {
    if (!plain(doc[field]) || !keys(doc[field]) || !Object.values(doc[field]).every(string)) fail(`Check the ${field} text.`);
  }
  if (!Object.hasOwn(doc.logs,'opening')) fail('Keep an opening log entry.');
  const itemList=value=>Array.isArray(value)&&value.length<=100&&value.every(id)&&new Set(value).size===value.length;
  if(doc.startingItems!==undefined&&!itemList(doc.startingItems))fail('Check the starting possessions.');
  if(doc.scheduledEvents!==undefined) {
    if(!Array.isArray(doc.scheduledEvents)||doc.scheduledEvents.length>100)fail('Keep at most 100 scheduled passages.');
    const scheduledIds=new Set();
    for(const event of doc.scheduledEvents) {
      if(!plain(event)||!id(event.id)||scheduledIds.has(event.id)||!Number.isInteger(event.hour)||event.hour<0||event.hour>23||
        !id(event.message)||!Object.hasOwn(doc.messages,event.message)||event.enabled!==undefined&&typeof event.enabled!=='boolean')fail('Check the scheduled passage, starting intertitle, and story hour.');
      scheduledIds.add(event.id);
    }
  }
  if(doc.startingValues!==undefined&&(!plain(doc.startingValues)||Object.entries(doc.startingValues).some(([k,v])=>!STAT_KEYS.includes(k)||!Number.isFinite(v)||Math.abs(v)>1000000||k!=='money'&&v<0)))fail('Check the starting attribute values.');
  if(doc.requireActionLogs!==undefined && typeof doc.requireActionLogs!=='boolean')fail('Check the log requirement.');
  if(doc.allowEmptyDescriptions!==undefined&&typeof doc.allowEmptyDescriptions!=='boolean')fail('Check whether descriptions are optional.');
  if(doc.choicePolicy!==undefined) {
    const policy=doc.choicePolicy;
    if(!plain(policy)||Object.keys(policy).some(key=>!['hideUnavailable','mealGapMinutes','deal'].includes(key))||typeof policy.hideUnavailable!=='boolean'||
      !Number.isInteger(policy.mealGapMinutes)||policy.mealGapMinutes<0||policy.mealGapMinutes>10080)fail('Check the unavailable-card setting and time between meals.');
    if(policy.deal!==undefined) {
      const deal=policy.deal;
      if(!plain(deal)||Object.keys(deal).some(key=>!['size','recentWindow','repeatWeight','threadBoost'].includes(key))||
        !Number.isInteger(deal.size)||deal.size<1||deal.size>4||!Number.isInteger(deal.recentWindow)||deal.recentWindow<1||deal.recentWindow>20||
        !Number.isFinite(deal.repeatWeight)||deal.repeatWeight<=0||deal.repeatWeight>1||
        !Number.isFinite(deal.threadBoost)||deal.threadBoost<0||deal.threadBoost>10)fail('Check the deal size, recent-choice window, repeat weight and thread boost.');
    }
  }
  if(doc.firstPurchaseMessage!==undefined&&(!id(doc.firstPurchaseMessage)||!Object.hasOwn(doc.messages,doc.firstPurchaseMessage)))fail('The first purchase needs its linked intertitle.');
  if(doc.hungerIndicator!==undefined&&(!plain(doc.hungerIndicator)||typeof doc.hungerIndicator.enabled!=='boolean'||
    !Number.isFinite(doc.hungerIndicator.rapidPerHour)||doc.hungerIndicator.rapidPerHour<=0||doc.hungerIndicator.rapidPerHour>1000000))fail('Check the hunger indicator settings.');
  if(doc.choiceWarnings!==undefined) {
    if(!plain(doc.choiceWarnings))fail('Check the choice warnings.');
    for(const key of ['question',...(doc.choiceWarnings.cost!==undefined?['cost']:[])])if(!id(doc.choiceWarnings[key])||!Object.hasOwn(doc.messages,doc.choiceWarnings[key]))fail('A choice warning needs its linked intertitle.');
  }
  if (doc.messageLinks !== undefined) {
    if (!plain(doc.messageLinks) || !keys(doc.messageLinks)) fail('Check the intertitle links.');
    for (const [source,link] of Object.entries(doc.messageLinks)) {
      if (!Object.hasOwn(doc.messages,source) || !plain(link)) fail('An intertitle link has a missing source.');
      if (link.next && !Object.hasOwn(doc.messages,link.next)) fail('An intertitle points to a missing intertitle.');
      if (link.log && !Object.hasOwn(doc.logs,link.log)) fail('An intertitle points to a missing log message.');
      for (const style of ['bold','italic']) if (link[style] !== undefined && typeof link[style] !== 'boolean') fail('Check the intertitle style.');
      const seen=new Set([source]);let cursor=link.next;
      while(cursor) { if(seen.has(cursor))fail('Intertitle links form a loop. End the sequence at the choice cards.');seen.add(cursor);cursor=doc.messageLinks[cursor]?.next; }
    }
  }
  if (!Array.isArray(doc.intro) || !doc.intro.length || doc.intro.length > 1000) fail('Keep between 1 and 1,000 intro cards.');
  if (!Array.isArray(doc.actions) || doc.actions.length > 1000) fail('Keep fewer than 1,000 options.');
  const ids = new Set();
  for (const node of doc.intro) {
    if (!plain(node) || !id(node.id) || ids.has(node.id) || !string(node.text)) fail('Each card needs its own identity and text field.');
    ids.add(node.id);
    if (node.kind && !['line','title','feeding'].includes(node.kind)) fail('Choose a valid card style.');
    if (node.sound !== undefined && !string(node.sound)) fail('Check the sound description.');
    if (node.choices && (!Array.isArray(node.choices) || node.choices.length > 20)) fail('Keep at most 20 choices on a card.');
  }
  for (const node of doc.intro) {
    for (const target of [node.next,node.yes,node.no,...(node.choices||[]).map(c=>c.target)].filter(Boolean)) {
      if (target !== '@begin' && !ids.has(target)) fail('A card points to a missing card.');
    }
    const choices = new Set();
    for (const choice of node.choices||[]) {
      if (!plain(choice) || !id(choice.id) || choices.has(choice.id) || !string(choice.label) || !choice.target) fail('Check the card’s choices and destinations.');
      choices.add(choice.id);
    }
  }
  const actions = new Set();
  for (const action of doc.actions) {
    if (!plain(action) || !id(action.id) || actions.has(action.id) || !string(action.label)) fail('Each option needs its own identity and label.');
    actions.add(action.id);
    for(const key of ['requiresItems','grantsItems'])if(action[key]!==undefined&&!itemList(action[key]))fail('Possessions need distinct item IDs, such as computer.');
    if(action.thread!==undefined&&(typeof action.thread!=='string'||action.thread.length>96))fail('A choice thread must be text of at most 96 characters.');
    if(action.dealWeight!==undefined&&(!Number.isFinite(action.dealWeight)||action.dealWeight<=0||action.dealWeight>100))fail('A choice’s deal weight must be greater than 0 and at most 100.');
    if (!Number.isFinite(action.minutes) || action.minutes < 0 || action.minutes > 10080) fail('Task duration must be between 0 and 10,080 minutes.');
    if(action.durations!==undefined&&(!Array.isArray(action.durations)||!action.durations.length||action.durations.some(minutes=>!Number.isInteger(minutes)||minutes<0||minutes>10080)))fail('Duration alternatives must be whole minutes between 0 and 10,080.');
    if(action.availability!==undefined) {
      const rule=action.availability;
      if(!plain(rule)||Object.keys(rule).some(key=>!['maxPortions','cooldownMinutes','oncePerDay','hours','afterAny','renewedBy'].includes(key)))fail('Check when this choice is available.');
      for(const key of ['maxPortions','cooldownMinutes'])if(rule[key]!==undefined&&(!Number.isInteger(rule[key])||rule[key]<0))fail('Supply limits and waiting time must be nonnegative whole numbers.');
      if(rule.oncePerDay!==undefined&&typeof rule.oncePerDay!=='boolean')fail('Choose whether this task is available once per story day.');
      if(rule.hours!==undefined&&(!Array.isArray(rule.hours)||rule.hours.length!==2||rule.hours.some(hour=>!Number.isFinite(hour)||hour<0||hour>24)||rule.hours[0]>=rule.hours[1]))fail('Available hours must start before they end, between 0 and 24.');
      for(const key of ['afterAny','renewedBy'])if(rule[key]!==undefined&&(!Array.isArray(rule[key])||rule[key].some(value=>!id(value))||new Set(rule[key]).size!==rule[key].length))fail('Choose valid, distinct availability links.');
    }
    if (action.drainRapture !== undefined && typeof action.drainRapture !== 'boolean') fail('Choose whether time spent on this task reduces rapture.');
    if (action.warnRaptureLoss !== undefined && typeof action.warnRaptureLoss !== 'boolean') fail('Choose whether rapture loss needs a warning.');
    if (action.statOnlyLog !== undefined && typeof action.statOnlyLog !== 'boolean') fail('Choose whether this option can use a stat-only log.');
    if(action.repeatable!==undefined&&typeof action.repeatable!=='boolean')fail('Choose whether this option can be repeated.');
    if(action.followMessageLinks!==undefined&&typeof action.followMessageLinks!=='boolean')fail('Choose whether to play linked intertitles.');
    for(const key of ['requiresPerson','morningOnly','choiceLocked','eventOnly'])if(action[key]!==undefined&&typeof action[key]!=='boolean')fail('Check the story option settings.');
    if(action.firstLog!==undefined&&(!id(action.firstLog)||!Object.hasOwn(doc.logs,action.firstLog)))fail('Choose a first-use description.');
    if(action.hintMessage!==undefined&&(!id(action.hintMessage)||!Object.hasOwn(doc.messages,action.hintMessage)))fail('Choose a requirement hint.');
    if(action.requiresMessage!==undefined&&(!id(action.requiresMessage)||!Object.hasOwn(doc.messages,action.requiresMessage)))fail('Choose an existing intertitle that must be read before this choice appears.');
    if(action.requiresOutcome!==undefined&&(!id(action.requiresOutcome)||!doc.actions.some(a=>a.outcomes?.some(o=>o.id===action.requiresOutcome))))fail('Choose an existing prerequisite outcome.');
    if(action.outcomes!==undefined) {
      if(!Array.isArray(action.outcomes)||!action.outcomes.length||action.outcomes.length>100)fail('Keep between 1 and 100 random outcomes.');
      const outcomeIds=new Set();
      for(const outcome of action.outcomes) {
        if(!plain(outcome)||!id(outcome.id)||outcomeIds.has(outcome.id)||Object.keys(outcome).some(k=>!['id','log','message','minutes','effects','enabled'].includes(k)))fail('Check the random outcomes.');
        outcomeIds.add(outcome.id);
        if(!Number.isFinite(outcome.minutes)||outcome.minutes<0||outcome.minutes>10080)fail('Check the random outcome duration.');
        if(!plain(outcome.effects)||Object.entries(outcome.effects).some(([k,v])=>!STAT_KEYS.includes(k)||!Number.isFinite(v)||Math.abs(v)>1000000))fail('Check the random outcome stat changes.');
        if(!id(outcome.log)||!Object.hasOwn(doc.logs,outcome.log))fail('A random outcome needs its linked log.');
        if(outcome.message!==undefined&&(!id(outcome.message)||!Object.hasOwn(doc.messages,outcome.message)))fail('A random outcome has a missing intertitle.');
        if(outcome.enabled!==undefined&&typeof outcome.enabled!=='boolean')fail('Choose whether this random outcome is enabled.');
      }
    }
    for (const field of ['message','firstGainMessage']) if (action[field] && !Object.hasOwn(doc.messages,action[field])) fail('An option has a missing result message.');
    if (action.log && !Object.hasOwn(doc.logs,action.log)) fail('An option has a missing log entry.');
    if(action.logInventory!==undefined&&!['portions','frozenPortions','leftovers','joints'].includes(action.logInventory))fail('Choose which remaining supply replaces x in the log.');
    if (!plain(action.effects) || Object.entries(action.effects).some(([k,v])=>!STAT_KEYS.includes(k)||!Number.isFinite(v)||Math.abs(v)>1000000)) fail('Check the option’s stat changes.');
    if (!Array.isArray(action.reveal) || action.reveal.some(k=>!STAT_KEYS.includes(k))) fail('Check the revealed stats.');
    if(action.revealAtEnd!==undefined&&typeof action.revealAtEnd!=='boolean')fail('Choose when to reveal the attributes.');
    if(action.revealOnMessage!==undefined&&(!id(action.revealOnMessage)||!Object.hasOwn(doc.messages,action.revealOnMessage)))fail('Choose an existing intertitle for the attribute reveal.');
  }
  for (const action of doc.actions) {
    for(const key of ['afterAny','renewedBy'])if(action.availability?.[key]?.some(value=>!actions.has(value)))fail('An availability rule points to a missing choice.');
    if(action.unavailableAfter!==undefined&&(!id(action.unavailableAfter)||!actions.has(action.unavailableAfter)||action.unavailableAfter===action.id))fail('Choose another existing option that permanently removes this choice.');
    const seen = new Set([action.id]); let cursor = action;
    while (cursor.requires) {
      if (!actions.has(cursor.requires) || seen.has(cursor.requires)) fail('An option’s prerequisite is missing or loops back to itself.');
      seen.add(cursor.requires); cursor = doc.actions.find(a=>a.id===cursor.requires);
    }
  }
  for(const event of doc.scheduledEvents||[])if(event.action!==undefined&&(!id(event.action)||!actions.has(event.action)))fail('A scheduled passage needs an existing event choice.');
  if(doc.storyRules!==undefined) {
    const r=doc.storyRules;
    if(!plain(r))fail('Check the story settings.');
    if(r.startingFrozenPortions!==undefined&&(!Number.isInteger(r.startingFrozenPortions)||r.startingFrozenPortions<0||r.startingFrozenPortions>1000))fail('Starting frozen portions must be a whole number between 0 and 1,000.');
    if(r.leftoverPortions!==undefined&&(!Number.isInteger(r.leftoverPortions)||r.leftoverPortions<0||r.leftoverPortions>1000))fail('Leftovers set aside must be a whole number between 0 and 1,000.');
    for(const key of ['startingPortions','startingJoints','groceryPortions','mealPortions','mealRelief','hungryAt','offeringMax','offeringPerHunger','holeReliefTo','sleepHour','wakeHour'])
      if(!Number.isInteger(r[key])||r[key]<0||r[key]>1000)fail(`Check ${key}.`);
    if(r.offeringPerHunger<1||r.offeringMax<1||r.mealPortions<1||r.sleepHour>23||r.wakeHour>23||!Number.isFinite(r.sleepChance)||r.sleepChance<0||r.sleepChance>1||!['hidden','meal','ribcage'].includes(r.hungerReveal))fail('Check sleep and hunger settings.');
    for(const key of ['meals','libraryChoices'])if(!Array.isArray(r[key])||r[key].some(value=>!actions.has(value)))fail('A story rule refers to a missing choice.');
    if(!actions.has(r.personAfter)||!Object.hasOwn(doc.messages,r.personMessage)||!Object.hasOwn(doc.logs,r.libraryPrompt))fail('A story rule has a missing passage or choice.');
    if(r.openingFlow!==undefined){
      const f=r.openingFlow;
      if(!plain(f)||typeof f.enabled!=='boolean'||!Array.isArray(f.homeActions)||f.homeActions.some(value=>!actions.has(value))||!Object.hasOwn(doc.messages,f.hungerMessage))fail('Check the opening choices and hunger passage.');
      for(const key of ['shiftStartHour','shiftEndHour'])if(!Number.isInteger(f[key])||f[key]<0||f[key]>23)fail('Check the work shift hours.');
      if(f.shiftEndHour<=f.shiftStartHour)fail('The shift must end after it starts.');
      for(const key of ['morningGroceriesMinutes','postMealMinutes'])if(!Number.isInteger(f[key])||f[key]<1||f[key]>10080)fail('Check the opening duration.');
      for(const key of ['shiftRapture','mealRapture'])if(!Number.isFinite(f[key])||Math.abs(f[key])>1000000)fail('Check the opening rapture changes.');
      for(const key of ['try-sleep','breakfast','pace','sleep','hardware-store','cook','groceries','go-hole'])if(!actions.has(key))fail('An opening choice is missing.');
      if(f.firstNight!==undefined){
        const n=f.firstNight;
        if(!plain(n)||typeof n.enabled!=='boolean')fail('Check the first-night settings.');
        if(n.cookingAfterGroceries!==undefined&&typeof n.cookingAfterGroceries!=='boolean')fail('Check the first-night cooking sequence.');
        for(const key of ['windDownHour','settlingMinutes','mealPortions'])if(!Number.isInteger(n[key])||n[key]<1||n[key]>1440)fail('Check the first-night timing and food amounts.');
        if(n.windDownHour>23)fail('Check the first-night evening hours.');
        // Earlier manuscripts retain their retired turn budget and appetite
        // settings for history; current play no longer uses them.
        if(n.dayChoices!==undefined&&(!Number.isInteger(n.dayChoices)||n.dayChoices<3||n.dayChoices>8))fail('Check the earlier first-night choice budget.');
        if(n.sickAfterPortions!==undefined&&(!Number.isInteger(n.sickAfterPortions)||n.sickAfterPortions<1||n.sickAfterPortions>1440))fail('Check the earlier first-night food amount.');
        if(!Array.isArray(n.bedHours)||n.bedHours.length!==2||n.bedHours.some(h=>!Number.isFinite(h)||h<24||h>30)||n.bedHours[1]<n.bedHours[0]||n.settlingMinutes>n.bedHours[0]*60-n.windDownHour*60)fail('Check the first-night bedtime range.');
        if(n.dayDurations!==undefined&&(!Array.isArray(n.dayDurations)||!n.dayDurations.length||n.dayDurations.length>20||n.dayDurations.some(m=>!Number.isInteger(m)||m<1||m>480)))fail('Check the earlier first-night activity durations.');
        if(!Array.isArray(n.settlingActions)||!n.settlingActions.length||n.settlingActions.some(id=>!actions.has(id)))fail('Choose existing first-night settling activities.');
        if(!plain(n.appendices)||['hungry','stillHungry','sick'].some(k=>!Object.hasOwn(doc.logs,n.appendices[k])))fail('A first-night appended phrase is missing.');
      }
    }
  }
  if(doc.textLayouts!==undefined) {
    if(!plain(doc.textLayouts))fail('Check the text placement settings.');
    const position=(value,allowLines)=>{
      if(!plain(value)||Object.keys(value).some(k=>!['x','y','align',...(allowLines?['lines']:[])].includes(k)))fail('Check the text placement settings.');
      for(const axis of ['x','y'])if(value[axis]!==undefined&&(!Number.isFinite(value[axis])||Math.abs(value[axis])>100))fail('Text offsets must be between -100 and 100 percent.');
      if(value.align!==undefined&&!['auto','left','center','right'].includes(value.align))fail('Choose a valid text alignment.');
      if(value.lines!==undefined){if(!plain(value.lines))fail('Check the line positions.');for(const [line,offset] of Object.entries(value.lines)){if(!/^(0|[1-9]\d{0,4})$/.test(line)||Number(line)>30000)fail('Check the selected line.');position(offset,false);}}
    };
    for(const [type,layouts] of Object.entries(doc.textLayouts)) {
      if(!['intro','actions','messages','logs'].includes(type)||!plain(layouts)||!keys(layouts))fail('Check the cards with text placement.');
      for(const [key,layout] of Object.entries(layouts)) {
        if(['intro','actions'].includes(type)?!doc[type].some(card=>card.id===key):!Object.hasOwn(doc[type],key))fail('Text placement belongs to a missing card.');
        position(layout,true);
      }
    }
  }
  if (JSON.stringify(doc).length > 2000000) fail('This writing file is too large.');
  return doc;
}
export const cardChoices = node => node.choices || (node.yes ? [{id:'yes',label:'y',target:node.yes},{id:'no',label:'n',target:node.no}] : []);
