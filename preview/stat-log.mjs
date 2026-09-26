import {LOG_STAT_KEYS,signedChange,STAT_ICONS} from './game-stats.mjs';
import {firstNightLogAppendices} from './first-night.mjs';
export const LOG_ICON_SIZE=16,LOG_ICON_GAP=4;

// Use completed receipts, never the current option's effects: editing a choice must
// not rewrite what a previous choice actually cost. Time drain stays in the receipt
// and balance calculation, but never appears as a rapture loss in the log.
export function eventChanges(event) {
  const changes=event.changes??Object.entries(event.delta).map(([stat,amount])=>({stat,amount}));
  // Before sources were stored, time entries came first: rapture drain, then hunger
  // growth, then direct effects. This preserves the new presentation for existing saves.
  const oldTimePrefix=event.minutes>0&&event.changes&&changes.every(c=>c.source===undefined)&&
    changes[0]?.stat==='rapture'&&changes[0].amount<0&&changes[1]?.stat==='hunger'&&changes[1].amount>0;
  return changes.filter(({stat,amount,source},index)=>LOG_STAT_KEYS.includes(stat)&&amount!==0&&
    !(stat==='rapture'&&(source==='time'||oldTimePrefix&&index===0||!event.changes&&event.minutes>0)))
    .map(({stat,amount,need})=>need?{stat,amount,need}:{stat,amount});
}
const appendixRefs=(state,event,rules)=>{
  const refs=firstNightLogAppendices(state,event,rules);
  return refs.length?{appendices:[...new Set(refs)]}:{};
};
export function logEntries(state,rules) {
  if(state.phase==='intro')return [];
  const entries=['opening',...state.origin.logs.filter(id=>id!=='opening')].map(id=>({id,changes:[]}));
  // Display lab: rapture taken by withdrawn need cards rides on the turn's last line,
  // drawn with a chain, so the notepad bar shows it with the card you chose instead.
  for(const event of state.events) {
    const all=eventChanges(event),changes=all.filter(c=>!c.need),withdrawn=all.filter(c=>c.need).map(({stat,amount})=>({stat,amount}));
    const start=entries.length;
    const appendix=appendixRefs(state,event,rules);
    if(event.log||changes.length||event.inventory||appendix.appendices?.length)entries.push({id:event.log,changes,...appendix,...(event.inventory?{inventory:event.inventory}:{}),...(event.logInventory?{logInventory:event.logInventory}:{})});
    for(const card of (event.cards||[]).slice(0,event.seen||0))if(card.log)entries.push({id:card.log,changes:[]});
    if(withdrawn.length){if(entries.length>start)entries.at(-1).withdrawn=withdrawn;else entries.push({id:null,changes:[],withdrawn});}
  }
  return entries;
}
// The status describes the latest turn, which can end with a linked story log
// (sunset, for example). Its prose can change without discarding that turn's
// signed amounts. History keeps each change on its original action entry.
export function statusEntry(state,rules) {
  const event=state.events.at(-1);
  if(state.phase==='intro'||!event)return logEntries(state,rules).at(-1)||{id:null,changes:[]};
  // A quiet turn intentionally clears the previous description. Keep the last
  // linked log reference even when Roy has cleared that log's text.
  const linked=(event.cards||[]).slice(0,event.seen||0).filter(card=>card.log).at(-1);
  const entry={id:linked?.log??event.log??null,changes:[]};
  const changes=eventChanges(event);
  return {...entry,...appendixRefs(state,event,rules),...(event.inventory?{inventory:event.inventory}:{}),...(!linked&&event.logInventory?{logInventory:event.logInventory}:{}),changes:changes.filter(change=>!change.need),
    withdrawn:changes.filter(change=>change.need).map(({stat,amount})=>({stat,amount}))};
}
export function entryText(entry,logs,ui={}) {
  const phrase=logs[entry.id]||'';
  const text=entry.logInventory&&Object.hasOwn(entry.inventory||{},entry.logInventory)?phrase.replace(/\bx\b/gi,String(entry.inventory[entry.logInventory])):phrase;
  const appendices=[...new Set(entry.appendices||[])].filter(id=>id!==entry.id).map(id=>logs[id]||'');
  const remaining=Object.entries(entry.inventory||{}).filter(([key])=>key!==entry.logInventory).map(([key,value])=>(ui[`${key}Remaining`]||'').replace(/\bX\b/g,String(value))).filter(Boolean).join('\n');
  return [text,...appendices,remaining].filter(text=>text.trim()).join('\n\n');
}
export const changeLabel=({stat,amount})=>stat==='money'?`${amount>0?'+':'-'}$${Number(Math.abs(amount).toFixed(6))}`:signedChange(amount);
export const changesText = (changes,labels={}) => changes.map(change=>change.stat==='money'?changeLabel(change):`${changeLabel(change)} ${labels[change.stat]||change.stat}`).join('  ');
export function changeRows(changes,maxWidth,measure) {
  const rows=[];let tokens=[],width=0;
  for(const change of changes) {
    const label=changeLabel(change),icon=change.stat==='money'?null:STAT_ICONS[change.stat],w=measure(label)+(icon?LOG_ICON_GAP+LOG_ICON_SIZE:0);
    if(tokens.length&&width+16+w>maxWidth){rows.push({tokens,width});tokens=[];width=0;}
    if(tokens.length)width+=16;
    tokens.push({...change,label,icon,x:width});width+=w;
  }
  if(tokens.length)rows.push({tokens,width});return rows;
}
export function logPages(rows,height) {
  const pages=[];let page=[],used=0;
  for(const row of rows) {
    if(page.length&&used+row.height>height){pages.push(page);page=[];used=0;}
    if(!page.length&&row.entry===null)continue;
    page.push(row);used+=row.height;
  }
  if(page.length)pages.push(page);return pages.length?pages:[[]];
}
