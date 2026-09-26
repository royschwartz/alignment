import {cardEntries as entries,incomingLinks,moveCard,duplicateCard,removalReason,removeCard} from './editor-model.mjs';
import {cardChoices,validateDocument} from './author-schema.mjs?v=1.4.4';
import {storyTime,DEFAULT_START_HOUR} from './story-clock.mjs';
const $=id=>document.getElementById(id);
const h=(tag,attrs={},...children)=>{const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='class')e.className=v;else if(k in e)e[k]=v;else e.setAttribute(k,v);}for(const c of children.flat())if(c!==null&&c!==undefined)e.append(typeof c==='string'?document.createTextNode(c):c);return e;};
const btn=(label,fn,attrs={})=>h('button',{type:'button',onclick:fn,...attrs},label);
const uid=prefix=>prefix+'-'+crypto.randomUUID().slice(0,12);
const date=value=>new Date(value).toLocaleString(undefined,{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',second:'2-digit'});
const title=(doc,s)=>s.type==='intro'?(doc.intro.find(n=>n.id===s.id)?.text||'Untitled card'):s.type==='actions'?(doc.actions.find(a=>a.id===s.id)?.label||'Untitled choice'):(doc[s.type]?.[s.id]||'Untitled text');
const groupName={intro:'intro cards',actions:'choice cards',messages:'intertitles',logs:'log messages',statLabels:'stat names',ui:'interface labels'};
export async function mountEditor(bridge) {
  let initial;try{const r=await fetch('/__editor/state');if(!r.ok)return null;initial=await r.json();}catch{return null;}
  let draft=initial.document,revision=initial.revision,token=initial.token,savedAt=initial.savedAt;
  let selection=bridge.current(),mode='edit',opened=false,dirty=false,inflight=null,generation=0,timer,problem='',conflict=null,historyView=null,testing=false;
  const draftKey='alignment.writer.unsaved.v1', undo=[];
  const rail=h('aside',{class:'editor-rail','aria-label':'Writing tools'},h('div',{class:'palette-title'},'AUTHOR'),
    btn('edit text',()=>open('edit'),{id:'edit-current'}),btn('all cards',()=>open('cards')),btn('choice cards',()=>open('options')));
  const tools=h('aside',{id:'editor-tools',class:'editor-rail','aria-label':'Writing history'},btn('save history',()=>open('history')),h('span',{class:'rail-note'},'Your writing.\nYour game.'));
  const panel=h('aside',{id:'editor-panel',hidden:true,'aria-label':'Game editor'});
  const testBar=h('div',{id:'editor-test-bar',hidden:true},h('span',{},'test play'),btn('back to editor',()=>{testing=false;testBar.hidden=true;document.body.classList.remove('editor-testing');show();bridge.preview(selection);}));
  $('desktop').prepend(rail);$('desktop').append(tools,panel);document.body.append(testBar);document.body.classList.add('has-editor');bridge.resize();
  function safeSelection(doc=draft){if(!entries(doc).some(s=>s.type===selection.type&&s.id===selection.id))selection={type:'intro',id:doc.intro[0].id};}
  function localDraft(){try{localStorage.setItem(draftKey,JSON.stringify({revision,document:draft,savedAt:new Date().toISOString()}));}catch{problem='Local recovery is unavailable. Keep this tab open until saved.';}}
  function status(){const e=$('writer-status');if(e){e.textContent=problem||(dirty?'saving…':`saved ${new Date(savedAt).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})}`);e.classList.toggle('save-problem',!!problem);}}
  function edited(){dirty=true;generation++;problem='';localDraft();try{validateDocument(draft);bridge.apply(draft);refreshChoiceExport();refreshLinks();}catch(e){problem=e.message;}status();clearTimeout(timer);timer=setTimeout(flush,450);}
  async function post(route,body){const r=await fetch('/__editor/'+route,{method:'POST',headers:{'Content-Type':'application/json','X-Editor-Token':token},body:JSON.stringify(body)});const result=await r.json();if(!r.ok){const error=new Error(result.error||'Unable to save.');error.latest=result.latest;throw error;}return result;}
  async function flush(){
    if(inflight){await inflight;if(dirty&&!problem)return flush();return !dirty;}
    if(!dirty)return true;
    try{validateDocument(draft);}catch(e){problem=e.message;status();return false;}
    const sent=generation,document=structuredClone(draft);problem='';
    inflight=(async()=>{try{const result=await post('save',{document,revision});revision=result.revision;savedAt=result.savedAt;
      if(sent===generation){dirty=false;try{localStorage.removeItem(draftKey);}catch{}}else localDraft();
      problem='';
    }catch(e){problem=e.message;let latest=e.latest||null;
      if(!latest)try{latest=await(await fetch('/__editor/state')).json();token=latest.token;}catch{}
      if(latest&&JSON.stringify(latest.document)===JSON.stringify(document)){
        revision=latest.revision;savedAt=latest.savedAt;problem='';conflict=null;
        if(sent===generation){dirty=false;try{localStorage.removeItem(draftKey);}catch{}}else localDraft();
      }else{conflict=latest&&latest.revision!==revision?latest:null;localDraft();if(conflict&&opened)render();}
    }finally{inflight=null;status();}})();
    await inflight;if(dirty&&!problem)return flush();return !dirty;
  }
  function show(){opened=true;panel.hidden=false;tools.hidden=true;document.body.classList.add('editor-open');render();bridge.resize();}
  async function open(nextMode){
    if(testing){selection=bridge.current();safeSelection();testing=false;testBar.hidden=true;document.body.classList.remove('editor-testing');bridge.preview(selection);}
    if(!opened){selection=bridge.current();if(!dirty&&!inflight){try{const latest=await(await fetch('/__editor/state')).json();draft=latest.document;revision=latest.revision;savedAt=latest.savedAt;token=latest.token;}catch{}}safeSelection();}
    if(nextMode==='history')await flush();else historyView=null;mode=nextMode;show();if(!historyView){bridge.apply(draft);bridge.preview(selection);}
  }
  function select(s){historyView=null;selection=s;mode='edit';safeSelection();show();bridge.apply(draft);bridge.preview(selection);}
  async function play(){if(!await flush())return;historyView=null;opened=false;testing=false;testBar.hidden=true;document.body.classList.remove('editor-testing');panel.hidden=true;tools.hidden=false;document.body.classList.remove('editor-open');bridge.apply(draft);bridge.play();}
  function heading(name){return h('h2',{},name);}
  function field(label,value,change,{multiline=false,type='text',readOnly=false}={}) {
    const input=h(multiline?'textarea':'input',{...(multiline?{rows:7}:{type}),value: value??'','aria-label':label,readOnly,oninput:e=>{change(e.target.value);edited();}});
    return h('label',{class:'writer-field'},h('span',{},label),input);
  }
  function check(label,value,change){return h('label',{class:'writer-check'},h('input',{type:'checkbox',checked:!!value,onchange:e=>{change(e.target.checked);edited();}}),label);}
  function selectField(label,value,options,change){const input=h('select',{'aria-label':label,onchange:e=>{change(e.target.value);edited();}});for(const [v,t]of options)input.append(h('option',{value:v,selected:v===value},t));return h('label',{class:'writer-field'},h('span',{},label),input);}
  const destinations=()=>[['@begin','home / game options'],...draft.intro.map((n,i)=>[n.id,`${i+1}. ${n.text.slice(0,55)||'Untitled card'}`])];
  function navigate(offset){const all=entries(draft),index=all.findIndex(s=>s.type===selection.type&&s.id===selection.id);select(all[(index+offset+all.length)%all.length]);}
  function render(){
    panel.replaceChildren(h('header',{class:'palette-title'},h('span',{},'ALIGNMENT / WRITE'),btn('×',play,{'aria-label':'Close editor'})),
      h('div',{class:'writer-save'},h('span',{id:'writer-status',role:'status'}),btn('save now',async()=>{await flush();status();})),
      h('nav',{class:'writer-tabs'},...['edit','cards','links','history'].map(m=>btn(m,()=>open(m),{'aria-pressed':mode===m||(m==='cards'&&mode==='options')}))),
      h('div',{id:'writer-body'}));status();
    const body=$('writer-body');
    if(conflict){body.append(h('p',{},'Newer writing was saved in another window. Your draft is preserved here.'),btn('use latest writing',()=>{draft=conflict.document;revision=conflict.revision;savedAt=conflict.savedAt;dirty=false;conflict=null;problem='';localStorage.removeItem(draftKey);safeSelection();select(selection);}),btn('keep my draft as a new version',async()=>{revision=conflict.revision;await post('checkpoint',{revision}).then(r=>revision=r.revision);conflict=null;problem='';await flush();render();}));return;}
    if(mode==='history'){renderHistory();return;}
    if(mode==='cards'||mode==='options'){renderList(body,mode==='options'?'actions':null);return;}
    if(mode==='links'){safeSelection();body.append(heading(title(draft,selection)));renderLinks(body);return;}
    safeSelection();body.append(h('div',{class:'writer-nav'},btn('←',()=>navigate(-1),{'aria-label':'Previous editable card'}),h('span',{},groupName[selection.type]),btn('→',()=>navigate(1),{'aria-label':'Next editable card'})));
    const s=selection;
    if(s.type==='intro')renderIntro(body,draft.intro.find(n=>n.id===s.id));
    else if(s.type==='actions'){const action=draft.actions.find(a=>a.id===s.id);renderAction(body,action);renderChoiceRules(body,action);}
    else {body.append(heading(s.type==='messages'?'Intertitle':s.type==='logs'?'Log message':'Label'),field('Text',draft[s.type][s.id],v=>draft[s.type][s.id]=v,{multiline:true}));
      if(s.type==='logs')body.append(field('Date on log',draft.ui.logDate||'',v=>draft.ui.logDate=v),
        selectField('Starting time',draft.ui.logStartHour??String(DEFAULT_START_HOUR),Array.from({length:24},(_,hour)=>[String(hour),storyTime(0,hour)]),v=>draft.ui.logStartHour=v),
        field('Starting money',draft.startingValues?.money??900,v=>{draft.startingValues??={};draft.startingValues.money=Number(v);},{type:'number'}),
        h('p',{class:'writer-help'},'Starting money applies to new playthroughs.'),
        h('p',{class:'writer-help'},'The date and time stay at the top right. The clock advances by the full task duration, including events longer than one hour.'));
      if(s.type==='messages'){const link=()=>{draft.messageLinks??={};return draft.messageLinks[s.id]??={};};body.append(h('div',{class:'writer-row'},check('bold',draft.messageLinks?.[s.id]?.bold,v=>link().bold=v),check('italic',draft.messageLinks?.[s.id]?.italic,v=>link().italic=v)));}}
    if(s.type==='messages'&&Object.values(draft.choiceWarnings||{}).includes(s.id))body.append(h('p',{class:'writer-help'},!draft.choiceWarnings.cost?'Shown before spending rapture. The heart appears without charging anything. Tap to return, then select the choice again to complete it.':s.id===draft.choiceWarnings.cost?'Second warning. X becomes the calculated rapture cost. Tapping brings you back to the choices.':'First warning for a choice that loses rapture. Tapping brings you back to the choices.'));
    if(s.type==='messages'&&s.id===draft.firstPurchaseMessage)body.append(h('p',{class:'writer-help'},'Plays on the first purchase anywhere in the game. Tapping this first intertitle reveals the money icon with a brief blink, then continues to the next linked intertitle.'));
    if(s.type==='messages')for(const event of draft.scheduledEvents||[])if(event.message===s.id)body.append(
      heading('Scheduled passage'),check('Enable at the story hour',event.enabled!==false,v=>event.enabled=v),
      selectField('Story hour',String(event.hour),Array.from({length:24},(_,hour)=>[String(hour),storyTime(0,hour)]),v=>event.hour=Number(v)),
      selectField('Event choice card',event.action||'',[['','play the passage automatically'],...draft.actions.map(action=>[action.id,action.label||'Untitled choice'])],v=>{if(v)event.action=v;else delete event.action;}),
      h('p',{class:'writer-help'},'Once a task reaches this hour, finish its intertitles, then offer the event card alone. Selecting it opens this passage without adding time or a charge. With no event card linked, the passage plays automatically. Reading does not advance the clock.'));
    if(s.type==='actions'&&s.id==='sleep'&&draft.storyRules)renderStorySettings(body);
    if(['intro','messages','actions','logs'].includes(s.type))renderPlacement(body,s);
    renderManipulation(body);
    if(!['ui','statLabels'].includes(s.type))renderLinks(body);
    body.append(h('div',{class:'writer-footer'},btn('test from here',async()=>{if(!await flush())return;testing=true;panel.hidden=true;tools.hidden=false;document.body.classList.remove('editor-open');testBar.hidden=false;document.body.classList.add('editor-testing');bridge.test(selection);}),btn('back to game',play)));
  }
  function renderStorySettings(body) {
    const r=draft.storyRules,section=h('details',{},h('summary',{},'story timing & supplies'));
    section.append(h('p',{class:'writer-help'},'Sleep advances to the wake hour. Starting supplies apply to new saves; completed tasks keep their recorded amounts.'));
    const policy=()=>draft.choicePolicy??={hideUnavailable:false,mealGapMinutes:0};
    section.append(field('Starting possessions (IDs separated by commas)',draft.startingItems?.join(', ')||'',v=>draft.startingItems=v.trim()?v.split(',').map(x=>x.trim()):[]),h('p',{class:'writer-help'},'Starting possessions apply to new games only. A choice can grant an item when it is completed.'));
    section.append(check('Hide unavailable choice cards',draft.choicePolicy?.hideUnavailable===true,v=>policy().hideUnavailable=v),
      field('Time between meals (minutes)',draft.choicePolicy?.mealGapMinutes??0,v=>policy().mealGapMinutes=Number(v),{type:'number'}),
      h('p',{class:'writer-help'},'The meal gap starts when a meal ends. The first cook after dishes, first breakfast and required post-shift meal can still appear.'));
    if(draft.choicePolicy?.deal){
      const deal=draft.choicePolicy.deal;
      for(const [key,label]of Object.entries({size:'Choices per deal (1–4)',recentWindow:'Recent choices to consider (1–20)',repeatWeight:'Recent choice weight (above 0 to 1)',threadBoost:'Shared thread boost (0–10)'}))section.append(field(label,deal[key],v=>deal[key]=Number(v),{type:'number'}));
      section.append(h('p',{class:'writer-help'},'Only eligible choices enter the deal. Lower repeat weights make recently chosen cards less likely; a thread boost favors choices connected to recent activity.'));
    }
    for(const [key,label]of Object.entries({sleepHour:'Sleep available from hour',wakeHour:'Wake hour',sleepChance:'Later-night chance (0–1)',startingPortions:r.startingFrozenPortions===undefined?'Starting portions':'Starting non-frozen portions',startingJoints:'Starting joints',groceryPortions:'Non-frozen portions bought',mealPortions:'Portions per meal',mealRelief:'Hunger relief per meal',hungryAt:'Hungry passage threshold',offeringMax:'Maximum offering portions',offeringPerHunger:'Hunger per offering portion',holeReliefTo:'Hunger after feeding'}))section.append(field(label,r[key],v=>r[key]=Number(v),{type:'number'}));
    if(r.startingFrozenPortions!==undefined)section.append(field('Starting frozen portions',r.startingFrozenPortions,v=>r.startingFrozenPortions=Number(v),{type:'number'}));
    if(r.leftoverPortions!==undefined)section.append(field('Extra portions set aside as leftovers when cooking',r.leftoverPortions,v=>r.leftoverPortions=Number(v),{type:'number'}),h('p',{class:'writer-help'},'Taken from the existing food supply after the meal. Earlier meals keep their recorded amounts.'));
    section.append(selectField('First hunger reveal',r.hungerReveal,[['hidden','keep hidden'],['meal','after the first meal'],['ribcage','at the hunger passage']],v=>{r.hungerReveal=v;draft.hungerIndicator.enabled=v!=='hidden';}));
    if(r.openingFlow){
      const f=r.openingFlow;
      section.append(check('Home / first-night opening for new games',f.enabled,v=>f.enabled=v));
      for(const [key,label]of Object.entries({shiftStartHour:'Shift starts at hour',shiftEndHour:'Shift ends at hour',shiftRapture:'First shift rapture change',mealRapture:'Unsatisfying meal rapture change',morningGroceriesMinutes:'Morning grocery trip minutes',postMealMinutes:'Minutes after cooking before hunger reveal'}))section.append(field(label,f[key],v=>f[key]=Number(v),{type:'number'}));
      section.append(selectField('Hunger passage',f.hungerMessage,Object.entries(draft.messages).map(([id,text])=>[id,text||id]),v=>f.hungerMessage=v));
      if(f.firstNight){
        const n=f.firstNight,night=h('details',{},h('summary',{},'first evening & restless night'));
        night.append(check('Use the first-night progression',n.enabled,v=>n.enabled=v));
        if(n.cookingAfterGroceries!==undefined)night.append(check('Offer dishes and cooking after shopping',n.cookingAfterGroceries,v=>n.cookingAfterGroceries=v));
        for(const [key,label]of Object.entries({windDownHour:'Offer sleep from hour',settlingMinutes:'Restless time after trying to sleep',mealPortions:'Maximum portions eaten per first-night meal'}))night.append(field(label,n[key],v=>n[key]=Number(v),{type:'number'}));
        night.append(
          field('Earliest bedtime (25 means 1 am)',n.bedHours[0],v=>n.bedHours[0]=Number(v),{type:'number'}),
          field('Latest bedtime (26 means 2 am)',n.bedHours[1],v=>n.bedHours[1]=Number(v),{type:'number'}));
        night.append(h('p',{class:'writer-help'},'Hunger begins on waking. Each activity uses its own duration. Cooking and other home activities stay optional; the clock brings the evening toward sleep.'));
        section.append(night);
      }
      for(const a of draft.actions)section.append(check(`At home: ${a.label}`,f.homeActions.includes(a.id),v=>{f.homeActions=f.homeActions.filter(id=>id!==a.id);if(v)f.homeActions.push(a.id);}));
    }
    body.append(section);
  }
  function renderChoiceRules(body,action) {
    const section=h('details',{},h('summary',{},'availability, deal & variable time'));
    for(const [key,label]of [['requiresItems','Required possessions'],['grantsItems','Possessions acquired']])section.append(field(label+' (IDs separated by commas)',action[key]?.join(', ')||'',v=>{if(v.trim())action[key]=v.split(',').map(x=>x.trim());else delete action[key];}));
    section.append(check('Only offer as an event card',action.eventOnly===true,v=>action.eventOnly=v));
    section.append(field('Thread',action.thread??'',v=>action.thread=v),
      field('Deal weight (above 0 to 100)',action.dealWeight??1,v=>{if(v.trim())action.dealWeight=Number(v);else delete action.dealWeight;},{type:'number'}),
      h('p',{class:'writer-help'},'Choices with the same thread can follow one another more often. A higher deal weight makes this card more likely among eligible choices; the default is 1. These settings apply when dealing is enabled.'));
    section.append(selectField('Available after reading intertitle',action.requiresMessage||'',[['','no passage required'],...messageOptions()],v=>{if(v)action.requiresMessage=v;else delete action.requiresMessage;}),
      h('p',{class:'writer-help'},'The player must dismiss this passage before the choice can appear. A blank passage does not unlock it.'));
    const set=(key,value)=>{
      if(value===undefined){if(action.availability){delete action.availability[key];if(!Object.keys(action.availability).length)delete action.availability;}}
      else {action.availability??={};action.availability[key]=value;}
    };
    section.append(field('Duration alternatives (minutes, separated by commas)',action.durations?.join(', ')||'',v=>{
      if(v.trim())action.durations=v.split(',').map(part=>part.trim()?Number(part.trim()):NaN);else delete action.durations;
    }),h('p',{class:'writer-help'},'Leave blank to use the normal duration or each random outcome’s duration. Alternatives override those durations; reading and reloading keep the same selection. Special sleep and work schedules still apply.'),
      field('Offer when food portions are at most',action.availability?.maxPortions??'',v=>set('maxPortions',v.trim()?Number(v):undefined),{type:'number'}),
      field('Wait after completion (minutes)',action.availability?.cooldownMinutes??'',v=>set('cooldownMinutes',v.trim()?Number(v):undefined),{type:'number'}),
      check('Once per story day',action.availability?.oncePerDay===true,v=>set('oncePerDay',v||undefined)),
      check('Limit available hours',!!action.availability?.hours,v=>{set('hours',v?[0,24]:undefined);render();}),
      h('p',{class:'writer-help'},'Blank limits do not restrict the choice. Daily limits and waiting time use the story clock, starting from completion.'));
    if(action.availability?.hours)section.append(
      field('Available from hour (0–24)',action.availability.hours[0],v=>set('hours',[Number(v),action.availability.hours[1]]),{type:'number'}),
      field('Available until hour (0–24)',action.availability.hours[1],v=>set('hours',[action.availability.hours[0],Number(v)]),{type:'number'}));
    for(const [key,label,help]of [
      ['afterAny','Available after any of these choices','One selected choice must have been completed. Leave all unchecked for no added prerequisite.'],
      ['renewedBy','Available again after one of these choices','After completing this task, one selected choice must happen before it returns.']
    ]){
      const links=h('details',{},h('summary',{},label),h('p',{class:'writer-help'},help));
      for(const source of draft.actions.filter(a=>a.id!==action.id))links.append(check(source.label||'Untitled choice',action.availability?.[key]?.includes(source.id),v=>{
        const ids=(action.availability?.[key]||[]).filter(id=>id!==source.id);if(v)ids.push(source.id);set(key,ids.length?ids:undefined);
      }));
      section.append(links);
    }
    body.append(section);
  }
  function renderPlacement(body,s) {
    let line='all';
    const value=()=>s.type==='intro'?draft.intro.find(n=>n.id===s.id).text:s.type==='actions'?draft.actions.find(a=>a.id===s.id).label:draft[s.type][s.id];
    const current=()=>{const layout=draft.textLayouts?.[s.type]?.[s.id]||{};return line==='all'?layout:layout.lines?.[line]||{};};
    const commit=(key,value)=>{
      draft.textLayouts??={};draft.textLayouts[s.type]??={};const layout=draft.textLayouts[s.type][s.id]??={};
      const position=line==='all'?layout:((layout.lines??={})[line]??={});position[key]=value;edited();bridge.preview(s);
    };
    const section=h('details',{class:'writer-placement'},h('summary',{},'text placement'));
    section.addEventListener('toggle',()=>{if(section.open){fill();bridge.preview(s);}});
    const controls=h('div');section.append(h('p',{class:'writer-help'},'One line centers automatically. Longer passages use equal side margins. Move the whole text or a line below; positions scale with the screen and save automatically.'),controls);
    function fill(){
      controls.replaceChildren();
      const lines=value().split('\n').map((text,index)=>[String(index),`Line ${index+1}: ${text.trim().slice(0,40)||'(blank)'}`]);
      if(line!=='all'&&!lines.some(([id])=>id===line))line='all';
      const selector=h('select',{'aria-label':'Move text',onchange:e=>{line=e.target.value;fill();bridge.preview(s);}},
        ...[['all','whole text'],...lines].map(([id,label])=>h('option',{value:id,selected:id===line},label)));
      controls.append(h('label',{class:'writer-field'},h('span',{},'Move'),selector));
      if(lines.length>1)controls.append(h('p',{class:'writer-help'},'Line breaks identify separate lines. A line that wraps stays together.'));
      controls.append(h('label',{class:'writer-field'},h('span',{},'Text alignment'),h('select',{'aria-label':'Text alignment',onchange:e=>commit('align',e.target.value)},
        ...[['auto',line==='all'?'automatic':'follow whole text'],['left','left'],['center','center'],['right','right']].map(([id,label])=>h('option',{value:id,selected:id===(current().align||'auto')},label)))));
      for(const [axis,label] of [['x','Horizontal'],['y','Vertical']]) {
        const update=e=>{if(e.target.value==='')return;const value=Number(e.target.value);if(!Number.isFinite(value))return;const offset=Math.max(-100,Math.min(100,value));commit(axis,offset);slider.value=String(offset);number.value=String(offset);};
        const slider=h('input',{type:'range',min:-100,max:100,step:1,value:current()[axis]||0,'aria-label':`${label} position`,oninput:update});
        const number=h('input',{type:'number',min:-100,max:100,step:1,value:current()[axis]||0,'aria-label':`${label} offset (%)`,oninput:update});
        controls.append(h('div',{class:'writer-field'},h('span',{},`${label} offset (%)`),h('div',{class:'writer-position-axis'},slider,number)));
      }
      controls.append(h('div',{class:'writer-nudge'},...[
        ['←','Move text left','x',-2],['↑','Move text up','y',-2],['↓','Move text down','y',2],['→','Move text right','x',2]
      ].map(([label,name,axis,amount])=>btn(label,()=>{commit(axis,Math.max(-100,Math.min(100,(current()[axis]||0)+amount)));fill();},{'aria-label':name}))),
      btn(line==='all'?'reset all placement':'reset this line',()=>{
        if(line==='all'){if(draft.textLayouts?.[s.type])delete draft.textLayouts[s.type][s.id];}
        else if(draft.textLayouts?.[s.type]?.[s.id]?.lines)delete draft.textLayouts[s.type][s.id].lines[line];
        edited();bridge.preview(s);fill();
      },{class:'writer-placement-reset'}));
    }
    body.append(section);
  }
  function structural(change) {
    undo.push({document:structuredClone(draft),selection:{...selection}});if(undo.length>20)undo.shift();
    change();safeSelection();edited();select(selection);
  }
  function undoCardChange(){const previous=undo.pop();if(!previous)return;draft=previous.document;selection=previous.selection;edited();select(selection);}
  function renderManipulation(body) {
    const type=selection.type;if(['ui','statLabels'].includes(type))return;
    const all=entries(draft).filter(s=>s.type===type),index=all.findIndex(s=>s.id===selection.id),reason=removalReason(draft,selection);
    const section=h('details',{},h('summary',{},'arrange this card'),h('p',{class:'writer-help'},`Position ${index+1} of ${all.length}. Explicit links stay attached when cards move.`),
      h('div',{class:'writer-actions'},btn('move up',()=>structural(()=>moveCard(draft,selection,-1)),{disabled:index===0}),btn('move down',()=>structural(()=>moveCard(draft,selection,1)),{disabled:index===all.length-1}),
      btn('duplicate',()=>structural(()=>selection=duplicateCard(draft,selection,uid))),btn('remove',()=>structural(()=>{removeCard(draft,selection);selection=all[index+1]||all[index-1]||{type:'intro',id:draft.intro[0].id};}),{disabled:!!reason})),
      reason?h('p',{class:'writer-help'},reason):null,undo.length?btn('undo last card change',undoCardChange):null);
    body.append(section);
  }
  function renderList(body,type){
    body.append(heading(type?'Choice cards':'All cards'));
    const create=h('div',{class:'writer-create'},btn('+ choice card',()=>addAction()),btn('+ intertitle',()=>addText('messages')),btn('+ log message',()=>addText('logs')),btn('+ intro card',addCard));
    body.append(create);
    const list=h('div',{class:'writer-list'}),search=h('input',{type:'search',placeholder:'find a line…','aria-label':'Find writing',oninput:()=>fill()});
    const filter=h('select',{'aria-label':'Card type',onchange:()=>fill()},h('option',{value:''},'all types'),...Object.entries(groupName).map(([value,label])=>h('option',{value,selected:value===type},label)));
    body.append(filter,search,list);function fill(){list.replaceChildren();for(const s of entries(draft).filter(s=>(!filter.value||s.type===filter.value)&&title(draft,s).toLowerCase().includes(search.value.toLowerCase()))){list.append(btn('',()=>select(s),{class:'writer-card',title:groupName[s.type]}));list.lastChild.append(h('small',{},groupName[s.type]),h('span',{},title(draft,s).slice(0,100)));}}fill();
    if(undo.length)body.append(btn('undo last card change',undoCardChange));
  }
  function addText(type,attach){structural(()=>{const id=uid(type==='messages'?'intertitle':'log');draft[type][id]='';attach?.(id);selection={type,id};});}
  function messageOptions(exclude) {
    return Object.keys(draft.messages).filter(id=>{let cursor=id;const seen=new Set();while(cursor&&!seen.has(cursor)){if(cursor===exclude)return false;seen.add(cursor);cursor=draft.messageLinks?.[cursor]?.next;}return true;}).map(id=>[id,title(draft,{type:'messages',id}).slice(0,70)]);
  }
  function prerequisiteOptions(action){return draft.actions.filter(a=>{let cursor=a;const seen=new Set();while(cursor&&!seen.has(cursor.id)){if(cursor.id===action.id)return false;seen.add(cursor.id);cursor=draft.actions.find(n=>n.id===cursor.requires);}return true;}).map(a=>[a.id,a.label||'Untitled choice']);}
  function renderLinks(body) {
    const s=selection,section=h('section',{class:'writer-links'},heading('Links'));
    if(s.type==='messages'&&Object.values(draft.choiceWarnings||{}).includes(s.id)){
      section.append(h('p',{class:'writer-help'},'Shown for choices that reduce rapture. Tapping this warning always returns to the choice cards; it does not run the task or create a log.'));body.append(section);return;
    }
    const reference=(label,type,value,options,setter)=>{
      section.append(selectField(label,value||'',[['',type==='messages'?'choice cards / no intertitle':'no log message'],...options],v=>{setter(v);render();}),
        h('div',{class:'writer-actions'},value?btn('edit linked '+(type==='messages'?'intertitle':'log'),()=>select({type,id:value})):null,
          btn('+ new '+(type==='messages'?'intertitle':'log'),()=>addText(type,setter))));
    };
    if(s.type==='actions') {
      const action=draft.actions.find(a=>a.id===s.id),set=(key,v)=>{if(v)action[key]=v;else delete action[key];};
      if(action.outcomes?.length) {
        for(const outcome of action.outcomes)reference('Random outcome log','logs',outcome.log,Object.keys(draft.logs).map(id=>[id,title(draft,{type:'logs',id})]),v=>{if(v)outcome.log=v;});
      } else {
      reference('Result intertitle','messages',action.message,messageOptions(),v=>set('message',v));
      reference('First rapture gain intertitle','messages',action.firstGainMessage,messageOptions(),v=>set('firstGainMessage',v));
      if((action.effects.money||0)<0)reference('First purchase intertitle (shared)','messages',draft.firstPurchaseMessage,messageOptions(),v=>{if(v)draft.firstPurchaseMessage=v;else delete draft.firstPurchaseMessage;});
      reference('Record log message','logs',action.log,Object.keys(draft.logs).map(id=>[id,title(draft,{type:'logs',id})]),v=>set('log',v));
      section.append(selectField('Replace x in the log with remaining supply',action.logInventory||'',[['','no replacement'],['portions','non-frozen food portions'],['frozenPortions','frozen food portions'],['leftovers','leftover portions'],['joints','joints']],v=>set('logInventory',v)));
      }
      if(action.firstLog)reference('First-use description','logs',action.firstLog,Object.keys(draft.logs).map(id=>[id,title(draft,{type:'logs',id})]),v=>set('firstLog',v));
      if(action.hintMessage)reference('Requirement hint','messages',action.hintMessage,messageOptions(),v=>set('hintMessage',v));
      if(draft.storyRules)section.append(check('Requires the PERSON encounter',action.requiresPerson,v=>action.requiresPerson=v),check('Morning only',action.morningOnly,v=>action.morningOnly=v));
      section.append(selectField('Available after outcome',action.requiresOutcome||'',[['','no outcome requirement'],...draft.actions.flatMap(a=>(a.outcomes||[]).map(o=>[o.id,`${a.label}: ${draft.logs[o.log]||'(blank)'}`]))],v=>set('requiresOutcome',v)));
      section.append(selectField('Available after',action.requires||'',[['','from the beginning'],...prerequisiteOptions(action)],v=>set('requires',v)),btn('+ following choice card',()=>addAction(action.id)));
      section.append(selectField('Permanently remove after',action.unavailableAfter||'',[['','no other choice removes it'],...draft.actions.filter(a=>a.id!==action.id).map(a=>[a.id,a.label||'Untitled choice'])],v=>set('unavailableAfter',v)));
    } else if(s.type==='messages') {
      const set=(key,v)=>{draft.messageLinks??={};draft.messageLinks[s.id]??={};if(v)draft.messageLinks[s.id][key]=v;else delete draft.messageLinks[s.id][key];};
      reference('Tap continues to','messages',draft.messageLinks?.[s.id]?.next,messageOptions(s.id),v=>set('next',v));
      reference('Record when shown','logs',draft.messageLinks?.[s.id]?.log,Object.keys(draft.logs).map(id=>[id,title(draft,{type:'logs',id})]),v=>set('log',v));
    } else if(s.type==='intro')section.append(h('p',{class:'writer-help'},'Set the next card and choice destinations in the edit tab.'));
    if(['messages','logs'].includes(s.type))section.append(selectField(s.type==='messages'?'Link as the result of a choice':'Record after a choice','',[['','choose a choice card…'],...draft.actions.map(a=>[a.id,a.label||'Untitled choice'])],v=>{if(v){draft.actions.find(a=>a.id===v)[s.type==='messages'?'message':'log']=s.id;render();}}));
    if(s.type==='logs')section.append(selectField('Record on an intertitle','',[['','choose an intertitle…'],...messageOptions()],v=>{if(v){draft.messageLinks??={};draft.messageLinks[v]??={};draft.messageLinks[v].log=s.id;render();}}));
    const incoming=incomingLinks(draft,s);section.append(h('h3',{},'Linked from'));
    if(!incoming.length)section.append(h('p',{class:'writer-help'},s.type==='logs'&&s.id==='opening'?'Recorded when the game begins.':'No explicit incoming links yet.'));
    for(const link of incoming)section.append(btn(`${title(draft,link).slice(0,65)} → ${link.label}`,()=>select(link),{class:'writer-card'}));
    body.append(section);
  }
  function addCard(){structural(()=>{const index=selection.type==='intro'?draft.intro.findIndex(n=>n.id===selection.id):draft.intro.length-1;
    const previous=draft.intro[index],id=uid('card'),next=previous?.next||draft.intro[index+1]?.id;
    const card={id,text:'',...(next?{next}:{begin:true})};draft.intro.splice(index+1,0,card);
    if(previous&&!cardChoices(previous).length){if(previous.begin){delete previous.begin;card.begin=true;delete card.next;}previous.next=id;}
    selection={type:'intro',id};});
  }
  function addAction(requires){structural(()=>{const id=uid('option'),message=uid('message'),log=uid('log');draft.messages[message]='';draft.logs[log]='';draft.actions.push({id,label:'',message,log,minutes:0,effects:{},reveal:[],hideWhenDone:false,...(requires?{requires}:{})});selection={type:'actions',id};});}
  function renderIntro(body,node){
    body.append(heading('Intro card'),field('Text',node.text,v=>node.text=v,{multiline:true}),h('div',{class:'writer-row'},check('bold',node.bold,v=>node.bold=v),check('italic',node.italic,v=>node.italic=v)),
      selectField('Card style',node.kind||'line',[['line','text'],['title','title'],['feeding','blank / feeding sound']],v=>{node.kind=v;render();}));
    if(node.kind==='feeding')body.append(field('Sound description',node.sound||'',v=>node.sound=v,{multiline:true}));
    body.append(check('BEGIN after this card',node.begin,v=>{node.begin=v;if(v){delete node.yes;delete node.no;node.choices=[];}render();}));
    if(node.begin)body.append(selectField('After BEGIN',node.next||'@begin',destinations(),v=>{if(v==='@begin')delete node.next;else node.next=v;}));
    if(!node.begin&&!cardChoices(node).length)body.append(selectField('Continue to',node.next||'', [['','next card in order'],...destinations()],v=>{if(v)node.next=v;else delete node.next;}));
    const choices=cardChoices(node);
    if(choices.length)body.append(heading('Choices on this card'));
    const editChoices=()=>{if(!node.choices){node.choices=cardChoices(node);delete node.yes;delete node.no;}return node.choices;};
    choices.forEach((choice,index)=>body.append(h('section',{class:'writer-choice'},field(`Choice ${index+1}`,choice.label,v=>editChoices()[index].label=v),selectField(`Choice ${index+1} leads to`,choice.target,destinations(),v=>editChoices()[index].target=v),btn('remove choice',()=>{editChoices().splice(index,1);edited();render();}))));
    body.append(btn('+ choice',()=>{editChoices().push({id:uid('choice'),label:'',target:node.next||draft.intro[draft.intro.indexOf(node)+1]?.id||'@begin'});node.begin=false;edited();render();}),btn('+ card after this',addCard));
  }
  function renderAction(body,action){
    if(action.outcomes?.length){renderRandomAction(body,action);return;}
    const setMessage=(fieldName,value)=>{if(!action[fieldName]){action[fieldName]=uid(fieldName==='log'?'log':'message');}const type=fieldName==='log'?'logs':'messages';draft[type][action[fieldName]]=value;bridge.preview({type,id:action[fieldName]});};
    body.append(heading('Choice card'),field('Choice text',action.label,v=>{action.label=v;bridge.preview({type:'actions',id:action.id});}),field('Intertitle text',draft.messages[action.message]||'',v=>setMessage('message',v),{multiline:true}));
    if(action.firstGainMessage&&action.firstGainMessage!==action.message)body.append(field('First rapture gain message',draft.messages[action.firstGainMessage],v=>{draft.messages[action.firstGainMessage]=v;bridge.preview({type:'messages',id:action.firstGainMessage});},{multiline:true}));
    else if(action.firstGainMessage)body.append(h('p',{class:'writer-help'},'The regular result and first rapture gain use this same intertitle. Edit the text above, or choose a different intertitle under Links.'));
    if((action.effects.money||0)<0&&draft.firstPurchaseMessage) {
      body.append(heading('First purchase intertitles'),h('p',{class:'writer-help'},'This sequence plays once for the first purchase, in place of that choice’s regular intertitles.'));
      const seen=new Set();let id=draft.firstPurchaseMessage;
      while(id&&!seen.has(id)){seen.add(id);const cardId=id;body.append(btn(draft.messages[id]||'Blank intertitle',()=>select({type:'messages',id:cardId}),{class:'writer-card'}));id=draft.messageLinks?.[id]?.next;}
    }
    for(const start of [...new Set([action.message,action.firstGainMessage].filter(Boolean))]) {
      const following=[],seen=new Set([start]);let next=draft.messageLinks?.[start]?.next;
      while(next&&!seen.has(next)){seen.add(next);following.push(next);next=draft.messageLinks?.[next]?.next;}
      if(following.length)body.append(heading(start===action.message?'Following intertitles':'Following first-gain intertitles'),
        h('p',{class:'writer-help'},'Each appears on its own screen. Tap to continue; the last returns to the choices.'),
        ...following.map((id,index)=>btn(`${index+2}. ${draft.messages[id]||'Blank intertitle'}`,()=>select({type:'messages',id}),{class:'writer-card'})));
    }
    body.append(field(draft.requireActionLogs?'Log phrase':'Log message text (optional)',draft.logs[action.log]||'',v=>setMessage('log',v),{multiline:true}),check('Show this choice in the game',action.enabled!==false,v=>action.enabled=v),check('Hide once completed',action.hideWhenDone,v=>action.hideWhenDone=v));
    body.append(check('Can be repeated',action.repeatable===true,v=>action.repeatable=v));
    body.append(check('Play linked intertitles after the result',action.followMessageLinks!==false,v=>action.followMessageLinks=v));
    body.append(check('Allow a stat-only log while writing',action.statOnlyLog===true,v=>action.statOnlyLog=v));
    body.append(h('p',{class:'writer-help'},draft.requireActionLogs?'A task needs your log phrase, or permission above to use its automatic stat changes alone.':'Descriptions are optional. Leaving this blank keeps the activity playable and clears the previous description.'));
    const details=h('details',{},h('summary',{},'time & stat changes'),field('Duration (minutes)',action.minutes,v=>action.minutes=Number(v),{type:'number'}));
    details.append(check('Time spent reduces rapture',action.drainRapture!==false,v=>action.drainRapture=v),h('p',{class:'writer-help'},'Durations can exceed one hour. Hunger still grows with time.'));
    if(draft.choiceWarnings)details.append(check('Warn before losing rapture',action.warnRaptureLoss!==false,v=>action.warnRaptureLoss=v));
    details.append(h('p',{class:'writer-help'},'Direct changes appear beneath revealed attribute totals. The description contains only your writing; hunger and time-drain amounts remain hidden.'));
    for(const key of ['rapture','hunger','disquiet','money','choice'])details.append(field(`${key} change`,action.effects[key]||0,v=>{const n=Number(v);if(n)action.effects[key]=n;else delete action.effects[key];},{type:'number'}));
    for(const key of ['rapture','hunger','money','disquiet','choice'])details.append(check(`Reveal ${key}`,action.reveal.includes(key),v=>{action.reveal=action.reveal.filter(k=>k!==key);if(v)action.reveal.push(key);}));
    details.append(check('Reveal attributes after the final intertitle',action.revealAtEnd===true,v=>action.revealAtEnd=v));
    details.append(selectField('Reveal attributes on intertitle',action.revealOnMessage||'',[['','use reveal timing above'],...messageOptions()],v=>{if(v)action.revealOnMessage=v;else delete action.revealOnMessage;}));
    body.append(details);
    renderChoiceExport(body,action);
  }
  function renderChoiceExport(body,action){
    const exportBox=h('details',{},h('summary',{},'choice card image'));
    const downloads=h('div',{'data-choice-export':action.id});exportBox.append(downloads);
    exportBox.addEventListener('toggle',()=>{if(exportBox.open)refreshChoiceExport();});
    exportBox.append(h('p',{class:'writer-help'},'The compact card used two per row throughout the game. Exact pixels at this window size, including when only one choice is shown.'));body.append(exportBox);refreshChoiceExport();
  }
  function renderRandomAction(body,action){
    body.append(heading('Choice card'),field('Choice text',action.label,v=>action.label=v),
      check('Show this choice in the game',action.enabled!==false,v=>action.enabled=v),
      check('Can be repeated',action.repeatable===true,v=>action.repeatable=v),
      check('Play linked intertitles after the result',action.followMessageLinks!==false,v=>action.followMessageLinks=v),
      check('Time spent reduces rapture',action.drainRapture!==false,v=>action.drainRapture=v),
      ...(draft.choiceWarnings?[check('Warn before losing rapture',action.warnRaptureLoss!==false,v=>action.warnRaptureLoss=v)]:[]),
      heading('Changing outcomes'),h('p',{class:'writer-help'},'The choice name stays the same. One outcome is drawn each time. Every enabled outcome is used once before the pool reshuffles. Reading, warnings and reloading keep the same draw.'));
    const reveals=h('details',{},h('summary',{},'attribute reveals'));
    for(const key of ['rapture','hunger','money','disquiet','choice'])reveals.append(check(`Reveal ${key}`,action.reveal.includes(key),v=>{action.reveal=action.reveal.filter(k=>k!==key);if(v)action.reveal.push(key);}));
    reveals.append(check('Reveal attributes after the final intertitle',action.revealAtEnd===true,v=>action.revealAtEnd=v),
      selectField('Reveal attributes on intertitle',action.revealOnMessage||'',[['','use reveal timing above'],...messageOptions()],v=>{if(v)action.revealOnMessage=v;else delete action.revealOnMessage;}),
      h('p',{class:'writer-help'},'With linked intertitles off, an intertitle-specific reveal happens only when that card is drawn.'));
    body.append(reveals);
    action.outcomes.forEach((outcome,index)=>{
      const section=h('section',{class:'writer-choice'},h('h3',{},`Outcome ${index+1}`),
        selectField('Result intertitle',outcome.message||'',[['','no intertitle'],...messageOptions()],v=>{if(v)outcome.message=v;else delete outcome.message;render();}),
        ...(outcome.message?[btn('edit result intertitle',()=>select({type:'messages',id:outcome.message}))]:[]),
        field('Log phrase',draft.logs[outcome.log],v=>draft.logs[outcome.log]=v,{multiline:true}),
        field('Duration (minutes)',outcome.minutes,v=>outcome.minutes=Number(v),{type:'number'}),
        ...['rapture','money','disquiet','choice','hunger'].map(key=>field(`${key} change`,outcome.effects[key]||0,v=>{const amount=Number(v);if(amount)outcome.effects[key]=amount;else delete outcome.effects[key];},{type:'number'})),
        check('Include in random draws',outcome.enabled!==false,v=>outcome.enabled=v),
        btn('edit log placement',()=>select({type:'logs',id:outcome.log})));
      if(action.outcomes.length>1)section.append(btn('remove outcome',()=>structural(()=>action.outcomes.splice(index,1))));
      body.append(section);
    });
    body.append(btn('+ random outcome',()=>structural(()=>{
      const id=uid('outcome'),log=uid('log');draft.logs[log]='';
      action.outcomes.push({id,log,minutes:15,effects:{rapture:1},enabled:false});
    })),h('p',{class:'writer-help'},'Descriptions may be blank. Direct changes appear beneath revealed attribute totals. Negative rapture outcomes use the shared cost warning when enabled above.'));
    renderChoiceExport(body,action);
  }
  function refreshLinks(){const old=panel.querySelector('.writer-links');if(!old||old.contains(document.activeElement))return;const holder=h('div');renderLinks(holder);old.replaceWith(holder.firstChild);}
  function refreshChoiceExport(){
    const downloads=panel.querySelector('[data-choice-export]');if(!downloads)return;
    downloads.replaceChildren();const id=downloads.dataset.choiceExport;
    for(const blank of [false,true]){const image=bridge.choiceImage(id,blank);downloads.append(h('a',{class:'writer-download',href:image.url,download:`alignment-choice-${blank?'blank':id}-${image.width}x${image.height}.png`},`${blank?'Blank template':'This choice card'} · ${image.width} × ${image.height} PNG`));}
  }
  new ResizeObserver(refreshChoiceExport).observe($('stack'));
  async function renderHistory(){
    const body=$('writer-body');if(!body)return;body.replaceChildren(heading('Saved writing'),h('p',{class:'writer-help'},'Autosaves update for one hour, then a new dated version begins. Earlier hours stay here.'),btn('keep a version now',async()=>{if(!await flush())return;try{const r=await post('checkpoint',{revision});revision=r.revision;savedAt=r.savedAt;renderHistory();status();}catch(e){problem=e.message;status();}}));
    try{const response=await fetch('/__editor/history'),{saves}=await response.json();if(mode!=='history')return;
      for(const saved of saves)body.append(btn(`${date(saved.savedAt)} · ${saved.kind==='autosave'?'autosave':saved.kind.replaceAll('-',' ')}`,async()=>{
        if(!await flush())return;
        const r=await fetch('/__editor/snapshot?id='+encodeURIComponent(saved.id));historyView=await r.json();
        const old=historyView.document;body.replaceChildren(heading(date(saved.savedAt)),h('p',{class:'writer-help'},'Viewing a previous save. Your latest writing is still preserved.'),btn('restore this version',restoreSelected),btn('back to saves',()=>{historyView=null;bridge.apply(draft);bridge.preview(selection);renderHistory();}));
        const list=h('select',{'aria-label':'Saved card',onchange:()=>previewOld(Number(list.value))});const all=entries(old);all.forEach((s,i)=>list.append(h('option',{value:String(i)},title(old,s).slice(0,80))));
        const text=h('textarea',{readOnly:true,rows:12,'aria-label':'Saved text'});body.append(list,text);
        function previewOld(i){const s=all[i];text.value=title(old,s);bridge.apply(old,{temporary:true});bridge.preview(s);}previewOld(0);
      },{class:'writer-card'}));
    }catch(e){body.append(h('p',{},'Unable to load saves. '+e.message));}
  }
  async function restoreSelected(){if(!historyView)return;try{const result=await post('restore',{id:historyView.id,revision});draft=result.document;revision=result.revision;savedAt=result.savedAt;dirty=false;historyView=null;problem='';safeSelection();select(selection);}catch(e){problem=e.message;conflict=e.latest||null;status();}}
  try{const recovered=JSON.parse(localStorage.getItem(draftKey));if(recovered?.document){validateDocument(recovered.document);draft=recovered.document;dirty=true;generation++;if(recovered.revision===revision){problem='Recovered unsaved writing.';setTimeout(()=>{problem='';flush();},700);}else{conflict=initial;problem='A recovered draft differs from the latest save.';}}}catch{}
  bridge.apply(draft);safeSelection();
  setInterval(async()=>{if(dirty){if(!inflight&&!conflict)flush();return;}if(historyView||testing||inflight)return;try{const r=await fetch('/__editor/state'),latest=await r.json();token=latest.token;if(latest.revision!==revision){draft=latest.document;revision=latest.revision;savedAt=latest.savedAt;safeSelection();bridge.apply(draft);if(opened){bridge.preview(selection);render();}}}catch{}},5000);
  addEventListener('beforeunload',()=>{if(dirty)localDraft();});
  return {open,flush};
}
