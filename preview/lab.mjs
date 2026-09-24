// The display lab's side palette. It changes only this copy's drawing and its
// prototype deal; it has no access to the manuscript.
import {PAIN,NEED,PAIRINGS} from './card-treatments.mjs';
import {STORY_ENABLED,storySettings,saveStorySettings} from './first-nights.mjs';
const KEY='alignment.display-lab.v3';
// Roy, September 23: need cards come on a chain; pain marks and needs wait for the heart;
// three cards until Roy brings in the fourth, face-down card; a check takes one to two hours.
const defaults={cardDesign:'simple',photoMode:'gray',border:'fern',pain:'bramble',need:'chain',needIds:['dinner'],surprising:[],withdrawCost:1,checkMin:60,checkMax:120,dependency:2,faceDownCard:false,threads:{}};
export const lab={...defaults};
try{const saved=JSON.parse(localStorage.getItem(KEY));Object.assign(lab,saved||{...JSON.parse(localStorage.getItem('alignment.display-lab.v2')||'{}'),cardDesign:'simple'});}catch{}
if(!PAIN.some(t=>t.id===lab.pain))lab.pain=defaults.pain;
if(!NEED.some(t=>t.id===lab.need))lab.need=defaults.need;
for(const key of ['needIds','surprising'])if(!Array.isArray(lab[key]))lab[key]=[...defaults[key]];
if(!lab.threads||typeof lab.threads!=='object')lab.threads={};
// Public previews use the selected format; research photos and design palettes stay local.
if(globalThis.location?.hostname&&!['localhost','127.0.0.1'].includes(location.hostname))Object.assign(lab,defaults);
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(lab));}catch{}};

const h=(tag,props={},...children)=>{
  const el=document.createElement(tag);
  // Hyphenated names (aria-*) are attributes, not element properties.
  for(const [key,value] of Object.entries(props))key.includes('-')?el.setAttribute(key,value):el[key]=value;
  el.append(...children.filter(c=>c!==null&&c!==undefined));return el;
};
let dealView=null;
// Called after each redraw with the current hand, so the palette can show the odds.
export function showDeal(info) {
  if(!dealView)return;
  if(!info?.cards.length){dealView.textContent='No hand on this screen.';return;}
  const total=info.pool.reduce((sum,c)=>sum+c.weight,0);
  dealView.textContent=[`turn ${info.turn}`,...info.pool.map(c=>{
    const dealt=info.cards.find(d=>d.action.id===c.action.id);
    const role=!dealt?'not dealt':dealt.faceDown?'face down':dealt.need?'need':dealt.pain?`pain ${'✱'.repeat(dealt.level)}`:'';
    return `${c.action.label.padEnd(22)} pull ${String(Math.round(c.weight/total*100)).padStart(3)}%  ${role}`;
  })].join('\n');
}

export function mountLab({actions,jump,changed,resize,motion,setMotion}) {
  document.body.classList.add('has-lab');
  const panel=h('aside',{id:'lab-panel','aria-label':'Display lab'});
  const toggle=h('button',{type:'button',className:'lab-toggle','aria-expanded':'true'},'hide');
  const body=h('div',{className:'lab-body'});
  panel.append(h('header',{},h('span',{},'DISPLAY LAB'),toggle),body);
  toggle.onclick=()=>{const hidden=panel.classList.toggle('collapsed');toggle.textContent=hidden?'show':'hide';toggle.setAttribute('aria-expanded',String(!hidden));};
  document.getElementById('desktop').prepend(panel);

  const update=()=>{persist();render();changed();};
  const select=(list,value,onchange)=>{
    const el=h('select',{},...list.map(t=>h('option',{value:t.id,selected:t.id===value},t.name)));
    el.onchange=()=>onchange(el.value);return el;
  };
  const number=(label,key,{min=0,max=60,step=1}={})=>{
    const input=h('input',{type:'number',min,max,step,value:lab[key]});
    input.onchange=()=>{const v=Number(input.value);if(Number.isFinite(v)){lab[key]=Math.min(max,Math.max(min,v));update();}};
    return h('label',{className:'lab-field'},h('span',{},label),input);
  };
  const checkbox=(label,checked,onchange)=>{
    const input=h('input',{type:'checkbox',checked});input.onchange=()=>onchange(input.checked);
    return h('label',{className:'lab-check'},input,label);
  };
  const storyNumber=(label,key,min,max,step=1)=>{
    const input=h('input',{type:'number',min,max,step,value:storySettings[key]});
    input.onchange=()=>{const value=Number(input.value);if(Number.isFinite(value)){storySettings[key]=Math.min(max,Math.max(min,step===1?Math.round(value):value));saveStorySettings();changed();}};
    return h('label',{className:'lab-field'},h('span',{},label),input);
  };
  const toggleIn=(key,id)=>v=>{lab[key]=v?[...new Set([...lab[key],id])]:lab[key].filter(x=>x!==id);update();};
  function render() {
    const painNote=PAIN.find(t=>t.id===lab.pain).note,needNote=NEED.find(t=>t.id===lab.need).note;
    dealView=h('pre',{className:'lab-deal'});
    body.replaceChildren(
      h('p',{className:'lab-help'},'A side copy of the game for trying the deal, need cards and pain cards. It reads your writing but can’t change it, and it keeps its own save.'),
      h('a',{className:'lab-link',href:STORY_ENABLED?'/?test':'/?story&test'},STORY_ENABLED?'return to the card lab →':'first nights and the hole →'),
      ...(STORY_ENABLED?[
        h('h2',{},'First nights'),
        h('p',{className:'lab-help'},'Roy’s new sequence. Sleep is optional; the first night offers it, later nights sometimes do. The flashlight and climbing cards can never be selected. This preview uses a separate save. These numbers are provisional.'),
        h('div',{className:'lab-grid'},...[['night','first-night dreams'],['hunger','after eating'],['hole','at the hole']].map(([id,label])=>{const b=h('button',{type:'button'},label);b.onclick=()=>jump(id);return b;})),
        storyNumber('sleep offered from hour','sleepHour',18,23),
        storyNumber('wake hour','wakeHour',6,12),
        storyNumber('later-night sleep chance','sleepChance',0,1,.05),
        storyNumber('meal portions','mealPortions',1,5),
        storyNumber('meal hunger relief','mealRelief',0,50),
        storyNumber('hungry threshold','hungryAt',1,100),
        storyNumber('most portions for the hole','offeringMax',1,15),
        storyNumber('hunger per offered portion','offeringPerHunger',1,50),
        storyNumber('hunger after feeding','holeReliefTo',0,50),
        h('label',{className:'lab-field'},h('span',{},'earlier hunger reveal'),select([{id:'meal',name:'after the first meal'},{id:'begin',name:'when play begins'}],storySettings.hungerReveal,value=>{storySettings.hungerReveal=value;saveStorySettings();})),
        h('p',{className:'lab-help'},'The hunger reveal placement is provisional; restart or use a shortcut after changing it. The second-or-third-day trigger and later sleep offers are fixed by the playthrough seed; reading or reloading never rerolls them. Use the shortcuts to replay the rules from the opening.')
      ]:[]),
      h('h2',{},'Card design'),
      h('label',{className:'lab-field'},h('span',{},'cards'),select([{id:'simple',name:'HyperCard · approved format'},{id:'photo',name:'photo cards'},{id:'original',name:'earlier prototype'}],lab.cardDesign,v=>{lab.cardDesign=v;update();})),
      h('label',{className:'lab-field'},h('span',{},'photographs'),select([{id:'atkinson',name:'Atkinson dither'},{id:'ordered',name:'ordered dither'},{id:'gray',name:'16-tone grayscale'}],lab.photoMode,v=>{lab.photoMode=v;update();})),
      h('label',{className:'lab-field'},h('span',{},'border'),select([{id:'fern',name:'branching ornament'},{id:'maze',name:'pixel maze'},{id:'plain',name:'small crosses'}],lab.border,v=>{lab.border=v;update();})),
      h('a',{className:'lab-link',href:'design.html',target:'_blank'},'open the card design study →'),
      h('h2',{},'Go to'),
      h('div',{className:'lab-grid'},
        ...[['opening','opening choices'],['groceries','after groceries'],['dishes','after dishes'],['intro','intro']].map(([id,label])=>{
          const b=h('button',{type:'button'},label);b.onclick=()=>jump(id);return b;})),
      h('h2',{},'This hand'),dealView,
      h('p',{className:'lab-help'},'How hard each playable card is pulled into this hand, from earlier choices. Three are dealt. As you add cards, the threads have more room to shape the hand.'),
      h('h2',{},'Need cards'),
      h('label',{className:'lab-field'},h('span',{},'look'),select(NEED,lab.need,v=>{lab.need=v;update();})),
      h('p',{className:'lab-note'},needNote),
      h('p',{className:'lab-help'},'Photo cards use a breathing border and black chain. The look selector applies to HyperCard and earlier cards. Need cards don’t appear until the heart has been revealed. Which cards are needs (a stand-in until the deal decides this):'),
      h('div',{className:'lab-checks'},...actions().map(a=>checkbox(a.label,lab.needIds.includes(a.id),toggleIn('needIds',a.id)))),
      number('rapture lost when withdrawn','withdrawCost',{max:10}),
      h('h2',{},'Pain cards'),
      h('label',{className:'lab-field'},h('span',{},'look'),select(PAIN,lab.pain,v=>{lab.pain=v;update();})),
      h('p',{className:'lab-note'},painNote),
      h('p',{className:'lab-help'},'Photo cards use white printed wire. The look selector applies to the earlier prototype. Marked only once the heart has been revealed, never on tasks that can go either way (tv). Thorns get heavier in steps: 1 rapture, 2–3, 4 or more.'),
      h('p',{className:'lab-help'},'A pain card costs rapture or raises disquiet. Losses the narrator can’t see coming stay unmarked until they have happened once:'),
      h('div',{className:'lab-checks'},...actions().map(a=>checkbox(a.label,lab.surprising.includes(a.id),toggleIn('surprising',a.id)))),
      h('h2',{},'Deal'),
      checkbox('4th card, face down (waiting for Roy)',lab.faceDownCard,v=>{lab.faceDownCard=v;update();}),
      number('check: fewest minutes','checkMin',{max:480,step:5}),
      number('check: most minutes','checkMax',{max:480,step:5}),
      number('pull of earlier choices','dependency',{max:10}),
      h('p',{className:'lab-help'},'Each finished task strengthens its own thread and the cards it unlocked; a stronger thread is dealt more often. Name shared threads below (a person, a place), separated by commas:'),
      h('div',{className:'lab-threads'},...actions().map(a=>{
        const input=h('input',{type:'text',value:lab.threads[a.id]||'',placeholder:'thread'});
        input.onchange=()=>{lab.threads={...lab.threads,[a.id]:input.value.trim()};update();};
        return h('label',{className:'lab-field'},h('span',{},a.label),input);})),
      h('h2',{},'Motion'),
      checkbox('reduce motion (still versions)',motion(),v=>setMotion(v)),
      h('h2',{},'Other looks'),
      h('div',{className:'lab-list'},...PAIRINGS.map(p=>{
        const b=h('button',{type:'button','aria-pressed':String(p.pain===lab.pain&&p.need===lab.need)},p.name);
        b.onclick=()=>{lab.pain=p.pain;lab.need=p.need;update();};return b;})),
      h('a',{className:'lab-link',href:'gallery.html',target:'_blank'},'compare every look side by side →')
    );
  }
  render();resize();
}
