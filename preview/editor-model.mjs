// Card operations share the same document and identities as the running game.
export const cardEntries = doc => [
  ...doc.intro.map(n=>({type:'intro',id:n.id})),
  ...doc.actions.map(a=>({type:'actions',id:a.id})),
  ...['messages','logs','statLabels','ui'].flatMap(type=>Object.keys(doc[type]).map(id=>({type,id})))
];
export function incomingLinks(doc,{type,id}) {
  const links=[];
  const add=(type,id,label)=>links.push({type,id,label});
  if(type==='logs'&&Object.values(doc.storyRules?.openingFlow?.firstNight?.appendices||{}).includes(id))add('actions','sleep','first-night appended phrase');
  if(type==='intro') for(const n of doc.intro) {
    if([n.next,n.yes,n.no,...(n.choices||[]).map(c=>c.target)].includes(id))add('intro',n.id,'intro link');
  }
  for(const a of doc.actions) {
    if(type==='actions'&&a.requires===id)add('actions',a.id,'unlocks this choice');
    if(type==='actions'&&a.unavailableAfter===id)add('actions',a.id,'permanently removes this choice');
    if(type==='actions'&&a.availability?.afterAny?.includes(id))add('actions',a.id,'makes this choice available');
    if(type==='actions'&&a.availability?.renewedBy?.includes(id))add('actions',a.id,'makes this choice available again');
    if(type==='messages'&&a.message===id)add('actions',a.id,'result intertitle');
    if(type==='messages'&&a.firstGainMessage===id)add('actions',a.id,'first rapture gain');
    if(type==='messages'&&a.revealOnMessage===id)add('actions',a.id,'attribute reveal');
    if(type==='messages'&&a.requiresMessage===id)add('actions',a.id,'must be read before this choice appears');
    if(type==='messages'&&doc.firstPurchaseMessage===id&&(a.effects.money||0)<0)add('actions',a.id,'first purchase');
    if(type==='logs'&&a.log===id)add('actions',a.id,'records this log');
    if(type==='logs'&&a.firstLog===id)add('actions',a.id,'first-use description');
    if(type==='messages'&&a.hintMessage===id)add('actions',a.id,'requirement hint');
    if(type==='actions'&&a.requiresOutcome&&doc.actions.find(choice=>choice.id===id)?.outcomes?.some(o=>o.id===a.requiresOutcome))add('actions',a.id,'unlocked by an outcome');
    for(const outcome of a.outcomes||[]) {
      if(type==='logs'&&outcome.log===id)add('actions',a.id,'random outcome log');
      if(type==='messages'&&outcome.message===id)add('actions',a.id,'random outcome intertitle');
    }
  }
  for(const event of doc.scheduledEvents||[])if(type==='actions'&&event.action===id)add('messages',event.message,'scheduled event choice');
  for(const [source,link] of Object.entries(doc.messageLinks||{})) {
    if(type==='messages'&&link.next===id)add('messages',source,'continues here');
    if(type==='logs'&&link.log===id)add('messages',source,'records this log');
  }
  return links;
}
export function moveCard(doc,s,offset) {
  const array=['intro','actions'].includes(s.type),items=array?doc[s.type]:Object.entries(doc[s.type]);
  const index=items.findIndex(item=>(array?item.id:item[0])===s.id),target=index+offset;
  if(index<0||target<0||target>=items.length)return false;
  [items[index],items[target]]=[items[target],items[index]];
  if(!array)doc[s.type]=Object.fromEntries(items);
  return true;
}
export function duplicateCard(doc,s,newId) {
  const id=newId(s.type==='actions'?'choice':s.type==='intro'?'card':s.type==='messages'?'intertitle':'log');
  if(['intro','actions'].includes(s.type)) {
    const index=doc[s.type].findIndex(n=>n.id===s.id),copy=structuredClone(doc[s.type][index]);copy.id=id;
    if(s.type==='actions')for(const field of ['message','firstGainMessage','log'])if(copy[field]) {
      const type=field==='log'?'logs':'messages',source=copy[field],target=newId(field==='log'?'log':'intertitle');
      doc[type][target]=doc[type][source];copy[field]=target;
      if(doc.textLayouts?.[type]?.[source])doc.textLayouts[type][target]=structuredClone(doc.textLayouts[type][source]);
      if(type==='messages'&&doc.messageLinks?.[source])doc.messageLinks[target]=structuredClone(doc.messageLinks[source]);
    }
    if(s.type==='actions')for(const outcome of copy.outcomes||[])for(const field of ['message','log'])if(outcome[field]) {
      const type=field==='log'?'logs':'messages',source=outcome[field],target=newId(field==='log'?'log':'intertitle');
      doc[type][target]=doc[type][source];outcome[field]=target;
      if(doc.textLayouts?.[type]?.[source])doc.textLayouts[type][target]=structuredClone(doc.textLayouts[type][source]);
      if(type==='messages'&&doc.messageLinks?.[source])doc.messageLinks[target]=structuredClone(doc.messageLinks[source]);
    }
    doc[s.type].splice(index+1,0,copy);
  } else {
    doc[s.type]=Object.fromEntries(Object.entries(doc[s.type]).flatMap(([key,value])=>key===s.id?[[key,value],[id,value]]:[[key,value]]));
    if(s.type==='messages'&&doc.messageLinks?.[s.id])doc.messageLinks[id]=structuredClone(doc.messageLinks[s.id]);
  }
  if(doc.textLayouts?.[s.type]?.[s.id])doc.textLayouts[s.type][id]=structuredClone(doc.textLayouts[s.type][s.id]);
  return {type:s.type,id};
}
export function removalReason(doc,s) {
  const rules=doc.storyRules;
  if(rules?.openingFlow&&(s.type==='messages'&&s.id===rules.openingFlow.hungerMessage||s.type==='actions'&&[...rules.openingFlow.homeActions,'try-sleep','breakfast','pace','sleep','hardware-store','cook','groceries','go-hole'].includes(s.id)))return 'This card is linked to the opening. Its writing may be blank; disable the choice to remove it from play.';
  if(rules&&(s.type==='actions'&&[rules.personAfter,...rules.meals,...rules.libraryChoices,'sleep','go-hole','hole-look','hole-say','hole-feed','smoke-joint','visit-library'].includes(s.id)||s.type==='messages'&&[rules.personMessage,'body-hungry','body-still-hungry'].includes(s.id)||s.type==='logs'&&rules.libraryPrompt===s.id))return 'This card is linked to a story rule. Its writing may be blank; disable the choice to remove it from play.';
  if(s.type==='messages'&&doc.scheduledEvents?.some(e=>e.message===s.id))return 'This intertitle starts a scheduled passage. Edit its text and story hour here; keep its starting card.';
  if(s.type==='actions'&&doc.scheduledEvents?.some(e=>e.action===s.id))return 'This choice opens a scheduled passage. Choose another event card on its starting intertitle before removing it.';
  if(s.type==='messages'&&doc.firstPurchaseMessage===s.id)return 'This intertitle starts the shared first-purchase sequence. Choose another first purchase intertitle from a purchase card’s Links before removing it.';
  if(s.type==='messages'&&Object.values(doc.choiceWarnings||{}).includes(s.id))return 'This intertitle is used by the rapture warnings. You can edit its text here.';
  if(['ui','statLabels'].includes(s.type)||s.type==='logs'&&s.id==='opening')return 'This is a required game label or opening log.';
  if(s.type==='intro'&&doc.intro.length===1)return 'Keep at least one intro card.';
  if(incomingLinks(doc,s).some(link=>link.type!==s.type||link.id!==s.id))return 'Unlink the cards listed below before removing this one.';
  return '';
}
export function removeCard(doc,s) {
  const reason=removalReason(doc,s);if(reason)throw new Error(reason);
  if(['intro','actions'].includes(s.type))doc[s.type]=doc[s.type].filter(n=>n.id!==s.id);
  else delete doc[s.type][s.id];
  if(s.type==='messages'&&doc.messageLinks)delete doc.messageLinks[s.id];
  if(doc.textLayouts?.[s.type])delete doc.textLayouts[s.type][s.id];
}
