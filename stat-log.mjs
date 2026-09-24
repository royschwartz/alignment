import {LOG_STAT_KEYS,signedChange,STAT_ICONS} from './game-stats.mjs';
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
export function logEntries(state) {
  if(state.phase==='intro')return [];
  const entries=['opening',...state.origin.logs.filter(id=>id!=='opening')].map(id=>({id,changes:[]}));
  // Display lab: rapture taken by withdrawn need cards rides on the turn's last line,
  // drawn with a chain, so the notepad bar shows it with the card you chose instead.
  for(const event of state.events) {
    const all=eventChanges(event),changes=all.filter(c=>!c.need),withdrawn=all.filter(c=>c.need).map(({stat,amount})=>({stat,amount}));
    const start=entries.length;
    if(event.log||changes.length)entries.push({id:event.log,changes});
    for(const card of (event.cards||[]).slice(0,event.seen||0))if(card.log)entries.push({id:card.log,changes:[]});
    if(withdrawn.length){if(entries.length>start)entries.at(-1).withdrawn=withdrawn;else entries.push({id:null,changes:[],withdrawn});}
  }
  return entries;
}
// The status describes the latest turn, which can end with a linked story log
// (sunset, for example). Its prose can change without discarding that turn's
// signed amounts. History keeps each change on its original action entry.
export function statusEntry(state) {
  const entry=logEntries(state).at(-1)||{id:null,changes:[]};
  const event=state.events.at(-1);
  if(state.phase==='intro'||!event)return entry;
  const changes=eventChanges(event);
  return {...entry,changes:changes.filter(change=>!change.need),
    withdrawn:changes.filter(change=>change.need).map(({stat,amount})=>({stat,amount}))};
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
