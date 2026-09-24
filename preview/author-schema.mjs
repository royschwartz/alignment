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
    if (!Number.isFinite(action.minutes) || action.minutes < 0 || action.minutes > 10080) fail('Task duration must be between 0 and 10,080 minutes.');
    if (action.drainRapture !== undefined && typeof action.drainRapture !== 'boolean') fail('Choose whether time spent on this task reduces rapture.');
    if (action.warnRaptureLoss !== undefined && typeof action.warnRaptureLoss !== 'boolean') fail('Choose whether rapture loss needs a warning.');
    if (action.statOnlyLog !== undefined && typeof action.statOnlyLog !== 'boolean') fail('Choose whether this option can use a stat-only log.');
    if(action.repeatable!==undefined&&typeof action.repeatable!=='boolean')fail('Choose whether this option can be repeated.');
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
    if (!plain(action.effects) || Object.entries(action.effects).some(([k,v])=>!STAT_KEYS.includes(k)||!Number.isFinite(v)||Math.abs(v)>1000000)) fail('Check the option’s stat changes.');
    if (!Array.isArray(action.reveal) || action.reveal.some(k=>!STAT_KEYS.includes(k))) fail('Check the revealed stats.');
    if(action.revealAtEnd!==undefined&&typeof action.revealAtEnd!=='boolean')fail('Choose when to reveal the attributes.');
    if(action.revealOnMessage!==undefined&&(!id(action.revealOnMessage)||!Object.hasOwn(doc.messages,action.revealOnMessage)))fail('Choose an existing intertitle for the attribute reveal.');
  }
  for (const action of doc.actions) {
    if(action.unavailableAfter!==undefined&&(!id(action.unavailableAfter)||!actions.has(action.unavailableAfter)||action.unavailableAfter===action.id))fail('Choose another existing option that permanently removes this choice.');
    const seen = new Set([action.id]); let cursor = action;
    while (cursor.requires) {
      if (!actions.has(cursor.requires) || seen.has(cursor.requires)) fail('An option’s prerequisite is missing or loops back to itself.');
      seen.add(cursor.requires); cursor = doc.actions.find(a=>a.id===cursor.requires);
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
export const cardChoices = node => node.choices || (node.yes ? [{id:'yes',label:'Y',target:node.yes},{id:'no',label:'N',target:node.no}] : []);
