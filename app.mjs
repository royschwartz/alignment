import { createGame, choose, getView, serializeGame, restoreGame, inspectSystem, gameDate, ATTRIBUTE_KEYS, attributeDescription } from './stage1-core.mjs';
import { INTRO } from './stage1-content.mjs';
import { EFFECTS, SPEEDS, TARGETS, composeFrame, makeTarget, monochrome } from './effects.mjs';
import { StackAudio } from './audio.mjs';

// The original HyperCard pixel renderer and compositor, with a deliberately
// small surface: a line of story, or a log, three systems, and four decisions.
const $ = id => document.getElementById(id);
const canvas = $('card'), context = canvas.getContext('2d', { willReadFrequently: true });
const audio = new StackAudio(), icons = {}, artwork = {};
const SAVE_KEY = 'alignment.stage1.v1', UI_KEY = 'alignment.stage1.cards.v2';
const MIGRATION_BACKUP_KEY = 'alignment.stage1.v1.backup-before-stage1-rewrite';
let state, view, screen='main', sceneIndex=0, sceneSource='intro', sceneIntroIndex=0, logIndex=0, readPage=0, systemId='local', systemPage=0, navigation=[], choiceShown=false, introRefusal=false;
let width, height, currentPixels, currentLayout, busy=false, animationId=0, demoId=0, pulse=true, saveFailed=false, toastTimer, migrationBackupPending=null;
let storage;
try { storage=window.localStorage; } catch { storage={getItem:()=>null,setItem:()=>{throw Error('Storage unavailable');}}; }
let prefs;
try { prefs=JSON.parse(storage.getItem('alignment.preferences'))||{}; } catch {prefs={};}
prefs={sound:prefs.sound!==false,reduceMotion:prefs.reduceMotion===true||matchMedia('(prefers-reduced-motion: reduce)').matches,largeText:prefs.largeText===true,transition:EFFECTS.includes(prefs.transition)&&prefs.transition!=='flash'?prefs.transition:'authored',speed:SPEEDS[prefs.speed]?prefs.speed:'normal'};
audio.enabled=prefs.sound;
const names={rapture:'Rapture',disquiet:'Disquiet',choice:'Choice',hunger:'Hunger',money:'$$$',food:'Food','skills.coding':'Coding','skills.math':'Math','skills.finance':'Finance','skills.social':'Social','skills.practical':'Practical','relationships.person':'PERSON','relationships.friend':'Your friend','relationships.town':'Town','relationships.jim':'Gringo Jim','relationships.ethan':'Ethan','relationships.wendy':'Wendy','relationships.madame':'MADAME','relationships.priestess':'PRIESTESS','relationships.fool':'FOOL','relationships.sun':'SUN'};
const shortNames={rapture:'R',disquiet:'D',choice:'C',hunger:'H',money:'$',food:'Food'};
const attributes=ATTRIBUTE_KEYS;
const fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
const statFmt=n=>n>0&&n<.1?'<0.1':fmt(Math.floor(n*10+1e-8)/10);
const attributeValue=stat=>stat==='money'?state.money:state.stats[stat];
const attributeFmt=stat=>stat==='money'?attributeValue(stat).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):statFmt(attributeValue(stat));
const signed=n=>`${n>0?'+':n<0?'−':''}${fmt(Math.abs(n))}`;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const titleCase=value=>value.toLowerCase();
const clockText=hours=>{const d=gameDate(hours);return `${d.date} · ${String(d.hour).padStart(2,'0')}:${String(d.minute).padStart(2,'0')}`;};
const position=()=>({screen,sceneIndex,sceneSource,sceneIntroIndex,introRefusal,logIndex,readPage,systemId,systemPage});
function restorePosition(p){screen=p.screen;sceneIndex=p.sceneIndex||0;sceneSource=p.sceneSource||'outcome';sceneIntroIndex=Math.min(p.sceneIntroIndex||0,INTRO.length-1);introRefusal=p.introRefusal===true;logIndex=p.logIndex||0;readPage=p.readPage||0;systemId=p.systemId||'local';systemPage=p.systemPage||0;}
function pushScreen(next){navigation.push(position());screen=next;readPage=0;}
function persist(){try{if(migrationBackupPending!==null){storage.setItem(MIGRATION_BACKUP_KEY,migrationBackupPending);migrationBackupPending=null;}storage.setItem(SAVE_KEY,serializeGame(state));storage.setItem(UI_KEY,JSON.stringify({...position(),navigation,choiceShown,seed:state.seed,turn:state.turn,phase:state.phase,introIndex:state.introIndex}));saveFailed=false;}catch{saveFailed=true;}$('save-status').textContent=saveFailed?'Save unavailable':'Saved on this device';}
function savePrefs(){try{storage.setItem('alignment.preferences',JSON.stringify(prefs));}catch{}document.documentElement.classList.toggle('reduce-motion',prefs.reduceMotion);}
function toast(message){$('toast').textContent=prose(message);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,4200);}

const prose=value=>String(value??'').toLowerCase().replace(/\bunquiet\b/g,'UNQUIET');
function text(ctx,str,x,y,size=14,bold=false,align='left',preserveCase=false,italic=false){ctx.font=`${italic?'italic ':''}${bold?'bold ':''}${size}px monospace`;ctx.textBaseline='top';ctx.textAlign=align;ctx.fillStyle='#000';ctx.fillText(preserveCase?str:prose(str),Math.round(x),Math.round(y));}
function box(ctx,x,y,w,h,filled=false){ctx.fillStyle=filled?'#000':'#fff';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#000';ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);}
function line(ctx,x1,y1,x2,y2){ctx.fillStyle='#000';ctx.fillRect(x1,y1,Math.max(1,x2-x1),Math.max(1,y2-y1));}
function icon(ctx,name,x,y,scale=1){if(icons[name]){ctx.imageSmoothingEnabled=false;ctx.drawImage(icons[name],Math.round(x),Math.round(y),32*scale,32*scale);}}
function drawArtwork(ctx,name,x,y,w,h){
  const image=artwork[name];if(!image||w<=0||h<=0)return;
  const scale=Math.min(1,w/image.naturalWidth,h/image.naturalHeight),iw=Math.floor(image.naturalWidth*scale),ih=Math.floor(image.naturalHeight*scale);
  const bounds={name,x:Math.round(x+(w-iw)/2),y:Math.round(y+(h-ih)/2),w:iw,h:ih};
  ctx.imageSmoothingEnabled=false;ctx.drawImage(image,bounds.x,bounds.y,iw,ih);return bounds;
}
function control(layout,label,x,y,w,h,action,extra={}){layout.buttons.push({label,x,y,w,h,action,...extra});}
function button(ctx,layout,label,x,y,w,h,action,primary=false){box(ctx,x,y,w,h);if(primary){ctx.strokeStyle='#000';ctx.strokeRect(x+3.5,y+3.5,w-7,h-7);}text(ctx,label,x+w/2,y+(h-14)/2,13,true,'center',true);control(layout,label,x,y,w,h,action);}
function quietButton(ctx,layout,label,x,y,w,h,action,aria=label){text(ctx,label,x+w/2,y+(h-14)/2,13,false,'center');control(layout,aria,x,y,w,h,action);}
function wrapText(ctx,str,maxWidth,size=13,bold=false){ctx.font=`${bold?'bold ':''}${size}px monospace`;const rows=[];for(const paragraph of String(str).split('\n')){let row='';if(!paragraph.trim()){rows.push('');continue;}for(const word of paragraph.split(/\s+/)){const next=row?row+' '+word:word;if(ctx.measureText(next).width>maxWidth&&row){rows.push(row);row=word;}else row=next;}if(row)rows.push(row);}return rows;}
function shortLine(ctx,str,maxWidth,size=12){ctx.font=`${size}px monospace`;let out=String(str);while(ctx.measureText(out).width>maxWidth&&out.length)out=out.slice(0,-1);return out.length<String(str).length?out.slice(0,-1)+'…':out;}
function dither(ctx,x,y,w,h){ctx.fillStyle='#fff';for(let yy=Math.ceil(y);yy<y+h;yy++)for(let xx=Math.ceil(x)+(yy%2);xx<x+w;xx+=2)ctx.fillRect(xx,yy,1,1);}
function changeSummary(changes){if(!changes?.length)return '';const sums=new Map();for(const c of changes)if(names[c.stat]&&(!attributes.includes(c.stat)||view.revealedStats.includes(c.stat)))sums.set(c.stat,(sums.get(c.stat)||0)+c.amount);return [...sums].filter(([,n])=>Math.abs(n)>=.05).map(([stat,n])=>`${signed(n)} ${names[stat]}`).join(' · ');}
function sceneData(){
  const entry=state.journal[Math.max(0,state.journal.length-1-logIndex)];
  const source=sceneSource==='intro'?INTRO[Math.min(sceneIntroIndex,INTRO.length-1)]:sceneSource==='entry'?entry:state.lastOutcome;
  if(sceneSource==='intro'&&introRefusal&&source.refusal)return {title:source.title,lines:[source.refusal,source.prompt],kinds:['line','prompt'],art:source.art};
  if(sceneSource==='intro'&&source.feedingSound)return {title:source.title,lines:[source.text,'',source.afterFeeding,source.titleText],kinds:['line','feeding','line','title'],art:source.art};
  const lines=String(source?.text||view.text).split(/\n+/).filter(Boolean).flatMap(paragraph=>paragraph.trim().startsWith('*')?[paragraph]:paragraph.split(/(?<=[.!?])\s+(?=[A-Z“])/).filter(Boolean));
  const kinds=lines.map(line=>line.trim().startsWith('**')?'sound':'line');
  if(sceneSource==='intro'&&source.prompt){lines.push(source.prompt);kinds.push('prompt');}
  return {title:source?.title||view.title,lines:lines.length?lines:['...'],kinds,art:source?.art,artFromLine:source?.artFromLine||0};
}
function drawStats(ctx,layout){
  text(ctx,view.calendar.date,10,7,11);
  const sw=(width-48)/attributes.length;
  attributes.forEach((stat,i)=>{if(!view.revealedStats.includes(stat))return;const x=8+i*sw;
    const amount=attributeFmt(stat),size=Math.min(12,(sw-4)/(amount.length*.61));
    text(ctx,names[stat],x,29,width<350?9:10);text(ctx,amount,x,44,size);
    layout.statTargets[stat]={x:x+10,y:45};layout.statRects[stat]={x:Math.floor(x),y:25,w:Math.ceil(sw-2),h:36};
    control(layout,`${stat==='money'?'Money in dollars':names[stat]} ${amount}. about ${names[stat]}`,x,24,sw-2,40,'attribute:'+stat);
  });
  quietButton(ctx,layout,'· ·',width-38,0,38,64,'settings','settings');
  line(ctx,0,64,width,65);
}
function drawScene(ctx,layout){
  const data=sceneData();sceneIndex=Math.max(0,Math.min(sceneIndex,data.lines.length-1));
  const current=data.lines[sceneIndex],kind=data.kinds?.[sceneIndex]||'line',emphasis=current.startsWith('*')&&!current.startsWith('**'),font=kind==='title'?(width<350?15:17):prefs.largeText?19:16;
  const art=kind!=='feeding'&&kind!=='title'&&sceneIndex>=(data.artFromLine||0)?data.art:null,beside=art&&width>height;
  const prompt=kind==='prompt',bold=prompt||kind==='sound'||kind==='title',rows=wrapText(ctx,current.replaceAll('*',''),beside?Math.floor(width*.48)-52:width-52,font,bold),leading=font+9;
  const y=art?(beside?Math.max(86,Math.floor(65+(height-140-rows.length*leading)/2)):92):Math.max(86,Math.floor(65+(height-160)*.43-rows.length*leading/2));
  if(art){
    const top=beside?86:y+rows.length*leading+18,left=beside?Math.floor(width*.48):26;
    layout.art=drawArtwork(ctx,art,left,top,width-left-26,height-89-top);
  }
  if(kind!=='feeding')rows.forEach((row,i)=>text(ctx,row,kind==='title'?width/2:26,y+i*leading,font,bold,kind==='title'?'center':'left',true,emphasis));
  layout.text=kind==='feeding'?'[sound of feeding, like a garbage disposal]':current.replaceAll('*','');layout.cardTitle=data.title;layout.scene={index:sceneIndex,count:data.lines.length,lines:data.lines,source:sceneSource,kind,text:layout.text,bold,italic:emphasis,prompt:prompt?current:null,refusal:introRefusal};
  const final=sceneIndex===data.lines.length-1;
  if(!final){control(layout,'read the next line',1,66,width-2,height-139,'next-line');if(kind!=='feeding')quietButton(ctx,layout,'→',width-65,height-65,48,48,'next-line','read the next line');}
  else if(sceneSource==='intro'&&prompt){
    const bw=Math.min(100,Math.floor((width-110)/2));button(ctx,layout,'Yes',width-bw*2-32,height-67,bw,46,'continue',true);button(ctx,layout,'No',width-bw-18,height-67,bw,46,'decline',true);
  }else if(sceneSource==='intro'){
    const label=kind==='title'?'Begin':INTRO[sceneIntroIndex].button,bw=Math.min(width-86,Math.max(164,label.length*8+20));
    button(ctx,layout,shortLine(ctx,label,bw-16,13),width-bw-18,height-67,bw,46,'continue',true);
  }else if(sceneSource==='outcome'&&state.phase==='dream')button(ctx,layout,'Sleep',width-160,height-67,142,46,'sleep',true);
  else if(sceneSource==='outcome'&&state.phase==='complete')button(ctx,layout,'BEGIN STAGE 2',width-202,height-67,184,46,'begin_stage2',true);
  else button(ctx,layout,sceneSource==='entry'?'back to log':state.phase==='playing'?'return':'close',width-160,height-67,142,46,'close-scene');
  if(kind!=='feeding'&&(sceneIndex>0||introRefusal||sceneSource!=='intro'||sceneIntroIndex>0))quietButton(ctx,layout,'←',12,height-65,48,48,'back','previous line or back');
  if(sceneSource==='intro'&&sceneIntroIndex===0&&sceneIndex===0&&!introRefusal)text(ctx,'tap to read',26,height-49,10);
}
function unlockCue(entry){const cues={local:'The tree icon now opens your friend’s clearing.',fintech:'The computer icon now opens your work.',social:'The people icon now opens your relationships.'};return (entry?.unlockedSystems||[]).map(id=>cues[id]).filter(Boolean).join(' ');}
function latestMessage(){return [unlockCue(state.lastOutcome),String(state.lastOutcome?.text||view.text||'').replaceAll('*','').replace(/\s+/g,' ').trim()].filter(Boolean).join(' ');}
const logHeight=()=>height<500?40:60;
function drawLogStrip(ctx,layout){
  const all=wrapText(ctx,height<500&&view.crisis?crisisWarning():latestMessage(),width-50,12),rows=all.slice(0,2);if(all.length>2)rows[1]=shortLine(ctx,rows[1],width-60,12)+'…';rows.forEach((row,i)=>text(ctx,shortLine(ctx,row,width-50,12),14,73+i*17,12,false,'left',true));
  text(ctx,'+',width-24,79,15);line(ctx,0,65+logHeight(),width,66+logHeight());
  control(layout,`Open log. ${latestMessage()}`,1,66,width-2,logHeight()-1,'open-log');
}
function drawSystems(ctx,layout){
  const spacing=70,start=width/2-spacing-22;
  for(const [i,system] of view.systems.entries()){
    const x=Math.round(start+i*spacing),y=80+logHeight();
    icon(ctx,{local:'tree',fintech:'computer',social:'people'}[system.id],x+6,y+4);
    if(!system.unlocked){dither(ctx,x+6,y+4,32,32);box(ctx,x+31,y+29,10,9);ctx.strokeStyle='#000';ctx.strokeRect(x+33.5,y+25.5,5,5);}
    control(layout,`${system.label}${system.unlocked?'':'. Not available yet'}`,x,y-2,48,48,'system:'+system.id,{available:system.unlocked});
  }
}
function drawOffer(ctx,layout,offer,x,y,w,h,wait=false){
  box(ctx,x,y,w,h);
  if(offer.thorny&&view.revealedStats.includes('rapture'))for(let yy=y+8;yy<y+h-8;yy+=13){ctx.fillStyle='#000';ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+5,yy+3);ctx.lineTo(x,yy+7);ctx.fill();}
  if(offer.blinking&&view.revealedStats.includes('rapture')&&(pulse||prefs.reduceMotion)){ctx.strokeStyle='#000';ctx.strokeRect(x+3.5,y+3.5,w-7,h-7);}
  const font=prefs.largeText?15:13,rows=wrapText(ctx,wait?'...':offer.label,w-23,font,true),choiceVisible=view.revealedStats.includes('choice');
  const maxRows=Math.max(2,Math.floor((h-(choiceVisible?31:16))/(font+4))),shown=rows.slice(0,maxRows);
  if(rows.length>maxRows)shown[maxRows-1]=shortLine(ctx,shown[maxRows-1]+'…',w-23,font);
  const y0=y+Math.max(12,(h-shown.length*(font+4)-(choiceVisible?16:0))/2);
  shown.forEach((row,i)=>text(ctx,row,x+w/2,y0+i*(font+4),wait?23:font,true,'center',true));
  if(choiceVisible)text(ctx,offer.available?`${offer.requirement} Choice`:offer.requirement>state.stats.choice?`Needs ${offer.requirement} Choice`:shortLine(ctx,offer.lockedReason.replace('You need','Needs').replace(/\.$/,''),w-14,width<350?9:10),x+w/2,y+h-19,width<350?9:10,!offer.available,'center');
  if(!offer.available)dither(ctx,x+2,y+2,w-4,h-4);
  const detail=`${offer.label}. ${offer.description} ${fmt(offer.duration)} hours.${choiceVisible?` Requires ${offer.requirement} Choice.`:''}${offer.available?'':' Unavailable.'}`;
  control(layout,detail,x,y,w,h,offer.id,{available:offer.available,offerId:offer.id});
}
function crisisWarning(){return /will kill you both/i.test(view.offers.find(o=>o.id==='crisis_leave')?.description||'')?'Leaving now will kill you both.':'Your friend’s pain is yours. You need help.';}
function storyReading(ctx,event){
  const font=prefs.largeText?17:14,leading=font+8,rows=wrapText(ctx,event.text.replaceAll('*',''),width-48,font);
  const capacity=Math.max(3,Math.floor((height-216)/leading));
  return {font,leading,rows,capacity,narrativePages:Math.max(1,Math.ceil(rows.length/capacity))};
}
function drawStoryEvent(ctx,layout){
  const event=view.storyEvent,{font,leading,rows,capacity,narrativePages}=storyReading(ctx,event);
  readPage=Math.max(0,Math.min(readPage,narrativePages));
  text(ctx,shortLine(ctx,event.title,width-(readPage===narrativePages?96:48),14),24,readPage===narrativePages?78:87,14,true,'left',true);
  if(readPage<narrativePages){
    const pageRows=rows.slice(readPage*capacity,(readPage+1)*capacity);
    pageRows.forEach((row,i)=>text(ctx,row,24,128+i*leading,font,false,'left',true));
    button(ctx,layout,readPage===narrativePages-1?'Respond':'Continue',width-162,height-68,142,46,'read-next',true);
    layout.text=`${event.title}\n\n${pageRows.join('\n')}`;
  }else{
    const options=event.options||view.offers,gap=10,bh=Math.max(68,Math.min(86,Math.floor((height-124-gap*(options.length-1))/options.length))),start=height-24-options.length*bh-gap*(options.length-1);
    options.forEach((offer,i)=>drawOffer(ctx,layout,offer,20,start+i*(bh+gap),width-40,bh));
    layout.text=event.title+'\n\n'+options.map(o=>o.label).join('\n');
  }
  if(readPage>0&&readPage<narrativePages)quietButton(ctx,layout,'←',12,height-68,48,46,'read-previous','Previous page');
  else if(readPage===narrativePages)quietButton(ctx,layout,'←',width-56,65,44,44,'read-previous','Read the event again');
  layout.cardTitle=event.title;layout.page=readPage;layout.pageCount=narrativePages+1;
  layout.storyEvent={id:event.id,page:readPage,narrativePages,responding:readPage===narrativePages};
}
function drawMain(ctx,layout){
  if(view.storyEvent){drawStoryEvent(ctx,layout);return;}
  drawLogStrip(ctx,layout);drawSystems(ctx,layout);layout.text=latestMessage();
  const margin=18,gap=14,bw=Math.floor((width-margin*2-gap)/2),bh=Math.max(72,Math.min(108,Math.floor(height*.145))),bottom=height-23,startY=bottom-bh*2-gap;
  if(state.phase==='playing'){
    const offers=[...view.offers,view.wait].filter(Boolean);offers.forEach((offer,i)=>drawOffer(ctx,layout,offer,margin+(i%2)*(bw+gap),startY+Math.floor(i/2)*(bh+gap),bw,bh,offer.id==='wait'));
    if(view.crisis&&height>=500){const message=crisisWarning();const rows=wrapText(ctx,message,width-40,12,true);rows.forEach((row,i)=>text(ctx,row,20,startY-rows.length*16-20+i*16,12,true));}
    else if(!view.crisis&&height>=500&&view.revealedStats.includes('choice')&&view.offers.some(o=>!o.available&&o.requirement>state.stats.choice)){const rows=wrapText(ctx,'You want to. You cannot make yourself.',width-40,12);rows.forEach((row,i)=>text(ctx,row,20,startY-rows.length*16-20+i*16,12));}
  }else{
    const heading={dream:'A life together',complete:'Stage 1 complete',stage2:'Stage 2'}[state.phase]||'The same silence';
    text(ctx,heading,width/2,startY+15,15,true,'center');
    button(ctx,layout,state.phase==='stage2'?'Read the opening':'Read the ending',margin,startY+60,width-margin*2,46,'read-ending');
    quietButton(ctx,layout,'Begin again',width/2-75,Math.min(height-63,startY+124),150,44,'restart');
  }
}
function header(ctx,layout,label,offset=0){quietButton(ctx,layout,'←',10,73+offset,44,44,'back','Back');text(ctx,label,66,87+offset,14,false);line(ctx,12,124+offset,width-12,125+offset);}
function drawReading(ctx,layout,title,passages){
  header(ctx,layout,title);const font=prefs.largeText?16:13,leading=font+7,lines=wrapText(ctx,passages.replaceAll('*',''),width-40,font),capacity=Math.max(3,Math.floor((height-205)/leading));
  const count=Math.max(1,Math.ceil(lines.length/capacity));readPage=Math.max(0,Math.min(readPage,count-1));
  lines.slice(readPage*capacity,(readPage+1)*capacity).forEach((row,i)=>text(ctx,row,20,144+i*leading,font,false,'left',true));
  if(readPage>0)quietButton(ctx,layout,'← page',14,height-60,92,44,'read-previous');
  if(readPage<count-1)quietButton(ctx,layout,'page →',width-106,height-60,92,44,'read-next');
  layout.text=lines.slice(readPage*capacity,(readPage+1)*capacity).join('\n');layout.page=readPage;layout.pageCount=count;
}
function drawLog(ctx,layout){
  logIndex=Math.max(0,Math.min(logIndex,state.journal.length-1));const entry=state.journal[state.journal.length-1-logIndex];
  const value=entry?`${entry.title}\n${clockText(entry.hours)}\n\n${entry.text}\n\n${unlockCue(entry)}\n\n${changeSummary(entry.changes)}`:'A sound comes from the woods.';
  drawReading(ctx,layout,'Log',value);
  if(logIndex<state.journal.length-1)quietButton(ctx,layout,'‹',width-100,73,44,44,'log-older','Older message');
  if(logIndex>0)quietButton(ctx,layout,'›',width-53,73,44,44,'log-newer','Newer message');
}
function currentReadingPages(ctx,value){const font=prefs.largeText?16:13,capacity=Math.max(3,Math.floor((height-205)/(font+7)));return Math.max(1,Math.ceil(wrapText(ctx,value.replaceAll('*',''),width-40,font).length/capacity));}
function drawSystem(ctx,layout){
  const system=view.systems.find(s=>s.id===systemId);if(!system?.unlocked){screen='main';drawMain(ctx,layout);return;}
  drawLogStrip(ctx,layout);header(ctx,layout,system.label,logHeight());const font=prefs.largeText?15:12;
  const prose=system.text,rows=wrapText(ctx,prose,width-40,font);
  const bh=height<500?64:74,perPage=height<500?2:height<650?4:6,gap=10,bw=Math.floor((width-50)/2),actionHeight=Math.ceil(perPage/2)*(bh+gap)-gap,actionY=height-actionHeight-63;
  const maxRows=Math.max(2,Math.floor((actionY-156-logHeight())/(font+6))); if(rows.length>maxRows)rows[maxRows-1]=shortLine(ctx,rows[maxRows-1],width-50,font)+'…';
  rows.slice(0,maxRows).forEach((row,i)=>text(ctx,shortLine(ctx,row,width-40,font),20,143+logHeight()+i*(font+6),font));
  const total=Math.max(1,Math.ceil(system.actions.length/perPage));systemPage=Math.min(systemPage,total-1);
  system.actions.slice(systemPage*perPage,(systemPage+1)*perPage).forEach((o,i)=>drawOffer(ctx,layout,o,20+(i%2)*(bw+10),actionY+Math.floor(i/2)*(bh+gap),bw,bh));
  if(systemPage>0)quietButton(ctx,layout,'←',14,height-56,48,44,'system-previous','Previous actions');
  if(systemPage<total-1)quietButton(ctx,layout,'More →',width-106,height-56,92,44,'system-next','More actions');
  text(ctx,`$${fmt(state.money)} · ${fmt(state.food)} food`,width/2,height-41,11,false,'center');
  layout.text=system.label+'. '+prose;layout.page=systemPage;layout.pageCount=total;
}
function inspectVisibleSystem(){if(screen!=='system')return;const system=getView(state).systems.find(s=>s.id===systemId),perPage=height<500?2:height<650?4:6;const max=Math.max(0,Math.ceil((system?.actions.length||0)/perPage)-1);systemPage=Math.min(systemPage,max);state=inspectSystem(state,systemId,system?.actions.slice(systemPage*perPage,(systemPage+1)*perPage).map(o=>o.id)||[]);}
function drawGame(){
  inspectVisibleSystem();view=getView(state);
  if(view.storyEvent&&screen==='system'){screen='main';readPage=0;}
  const ctx=document.createElement('canvas').getContext('2d',{willReadFrequently:true});ctx.canvas.width=width;ctx.canvas.height=height;box(ctx,0,0,width,height);
  const pageSize=height<500?2:height<650?4:6,eventNarrative=screen==='main'&&view.storyEvent&&readPage<storyReading(ctx,view.storyEvent).narrativePages;
  const visibleOptions=screen==='main'&&!eventNarrative?[...view.offers,view.wait].filter(Boolean):screen==='system'?(view.systems.find(s=>s.id===systemId)?.actions||[]).slice(systemPage*pageSize,(systemPage+1)*pageSize):[];
  if(visibleOptions.some(o=>!o.available&&o.requirement>state.stats.choice))choiceShown=true;view.revealedStats=view.revealedStats.filter(stat=>stat!=='choice'||choiceShown);
  const layout={buttons:[],page:0,pageCount:1,statTargets:{},statRects:{},revealedStats:[...view.revealedStats],cardTitle:'Alignment',text:'',scene:null};
  const activeScene=screen==='scene'?sceneData():null;if(activeScene)sceneIndex=Math.max(0,Math.min(sceneIndex,activeScene.lines.length-1));
  const sceneKind=activeScene?.kinds?.[sceneIndex];
  if(sceneKind!=='feeding'&&sceneKind!=='title')drawStats(ctx,layout);
  if(screen==='scene')drawScene(ctx,layout);else if(screen==='log')drawLog(ctx,layout);else if(screen==='system')drawSystem(ctx,layout);else if(screen==='progress')drawReading(ctx,layout,'Your life',view.milestones.map(m=>`${m.done?'[x]':'[ ]'} ${m.label}\n${m.detail}`).join('\n\n'));else drawMain(ctx,layout);
  return {pixels:monochrome(ctx,width,height),layout};
}
function paint(pixels,ctx=context,w=width,h=height){ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels.buffer,pixels.byteOffset,pixels.byteLength),w,h),0,0);}
function allOffers(){return [...view.offers,view.wait,...view.systems.flatMap(s=>s.actions)].filter(Boolean);}
function installControls(layout,focusAction){
  $('controls').replaceChildren();
  for(const b of layout.buttons){const el=document.createElement('button');el.textContent=prose(b.label);el.setAttribute('aria-label',prose(b.label));el.dataset.action=b.action;el.setAttribute('aria-disabled',String(b.available===false));
    if(b.action==='settings')el.id='settings-button';if(b.action==='continue')el.id='continue-intro';
    Object.assign(el.style,{left:`${b.x}px`,top:`${b.y}px`,width:`${b.w}px`,height:`${Math.min(b.h,height-b.y)}px`});
    let timer,held=false;
    if(b.offerId){el.onpointerdown=()=>{held=false;timer=setTimeout(()=>{held=true;inspectOffer(b.offerId);},550);};el.onpointerup=el.onpointercancel=el.onpointerleave=()=>clearTimeout(timer);el.oncontextmenu=e=>{e.preventDefault();held=true;inspectOffer(b.offerId);};}
    el.onclick=()=>{if(held){held=false;return;}activate(b.action);};$('controls').append(el);if(focusAction===b.action)el.focus({preventScroll:true});
  }
  const narration=layout.text+' '+view.calendar.date+'. '+view.revealedStats.map(stat=>`${stat==='money'?'money in dollars':prose(names[stat])} ${attributeFmt(stat)}`).join('. ');
  if($('narration').textContent!==narration)$('narration').textContent=narration;
}
function redraw(focusAction){const result=drawGame();currentPixels=result.pixels;currentLayout=result.layout;paint(currentPixels);installControls(currentLayout,focusAction);}
function resize(){animationId++;busy=false;const aw=document.documentElement.clientWidth,ah=innerHeight,landscape=aw>ah&&aw>600;width=Math.floor(Math.min(landscape?700:480,aw-(aw>540?24:0)));height=Math.floor(Math.max(360,Math.min(840,ah-(aw>540?24:0))));canvas.width=width;canvas.height=height;$('stack').style.width=`${width}px`;$('stack').style.height=`${height}px`;redraw();persist();}
function animate(from,to,effect,duration,onFrame,isCurrent){if(prefs.reduceMotion||effect==='plain'){onFrame(to);return Promise.resolve();}const w=width,h=height;return new Promise(resolve=>{let start,previous=-Infinity;const output=new Uint32Array(to.length);const tick=now=>{if(!isCurrent()||w!==width||h!==height){resolve();return;}start??=now;const p=Math.min(1,(now-start)/duration);if(now-previous>=1000/30||p===1){onFrame(composeFrame(from,to,w,h,p,effect,output));previous=now;}if(p===1)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});}
function effectFor(action){if(action==='next-line'||action==='continue'||action==='close-scene')return 'dissolve';if(action==='back')return 'wipe right';if(action==='open-log'||action.startsWith('system:'))return 'push left';if(/feed/.test(action))return 'dissolve';if(/work|study|code|course|portfolio|model/.test(action))return 'venetian blinds';if(action==='wait')return 'checkerboard';return 'dissolve';}

async function animateNumbers(changes,from,oldLayout,action,id){if(prefs.reduceMotion||!changes.length)return;const entries=changes.filter(c=>oldLayout.statTargets[c.stat]&&Math.abs(c.amount)>=.1).slice(0,8);if(!entries.length)return;const w=width,h=height,scratch=document.createElement('canvas');scratch.width=w;scratch.height=h;const ctx=scratch.getContext('2d',{willReadFrequently:true});await new Promise(resolve=>{let start;const tick=now=>{if(id!==animationId||w!==width||h!==height){resolve();return;}start??=now;const p=Math.min(1,(now-start)/440);paint(from,ctx,w,h);entries.forEach((c,i)=>{const source=oldLayout.buttons.find(b=>b.action===c.source)||oldLayout.buttons.find(b=>b.action===action),target=oldLayout.statTargets[c.stat];if(!source)return;let a={x:source.x+source.w/2-20,y:source.y+12+(i%2)*14},b=target;if(c.amount<0)[a,b]=[b,a];const q=p*p*(3-2*p),x=Math.round(a.x+(b.x-a.x)*q),y=Math.round(a.y+(b.y-a.y)*q),label=`${signed(c.amount)} ${shortNames[c.stat]}`;box(ctx,x-3,y-2,label.length*8+6,19);text(ctx,label,x,y,12,true);});paint(monochrome(ctx,w,h));if(p>=1)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});}
function backPosition(){
  if(screen==='scene'&&sceneSource==='intro'&&introRefusal&&sceneIndex===0){introRefusal=false;sceneIndex=sceneData().lines.length-1;return;}
  if(screen==='scene'&&sceneIndex>0){sceneIndex--;return;}
  if(screen==='scene'&&sceneSource==='intro'&&sceneIntroIndex>0){sceneIntroIndex--;sceneIndex=sceneData().lines.length-1;return;}
  if(screen==='log'&&readPage>0){readPage--;return;}
  if(screen==='system'&&systemPage>0){systemPage--;return;}
  if(navigation.length)restorePosition(navigation.pop());else screen='main';
}
function enterOutcome(){navigation=[{...position(),screen:screen==='system'&&!state.crisis&&state.phase==='playing'?'system':'main'}];sceneSource='outcome';sceneIndex=0;screen='scene';}
async function change(action){
  if(busy)return;const from=currentPixels,oldLayout=currentLayout,id=++animationId;busy=true;$('controls').querySelectorAll('button').forEach(b=>b.disabled=true);let changes=[];
  if(action==='next-line'){sceneIndex++;if(sceneSource==='intro'&&sceneData().kinds[sceneIndex]==='feeding')audio.feed();}
  else if(action==='back')backPosition();
  else if(action==='decline'){
    if(sceneIntroIndex===state.introIndex){const refused=choose(state,'decline');if(!refused.ok){busy=false;redraw();return;}state=refused.state;changes=refused.changes||[];}
    const returnToLine=INTRO[sceneIntroIndex].returnToLine;introRefusal=!Number.isInteger(returnToLine);sceneIndex=introRefusal?0:returnToLine;
  }
  else if(action==='close-scene'){if(navigation.length)restorePosition(navigation.pop());else screen='main';}
  else if(action==='open-log'){pushScreen('log');logIndex=0;}
  else if(action==='log-older'){logIndex++;readPage=0;}
  else if(action==='log-newer'){logIndex--;readPage=0;}
  else if(action==='read-next')readPage++;
  else if(action==='read-previous')readPage--;
  else if(action==='system-next')systemPage++;
  else if(action==='system-previous')systemPage--;
  else if(action==='progress')pushScreen('progress');
  else if(action.startsWith('system:')){pushScreen('system');systemId=action.slice(7);systemPage=0;inspectVisibleSystem();}
  else if(action==='read-ending'){pushScreen('scene');sceneSource='outcome';sceneIndex=0;}
  else if(action==='continue'&&sceneIntroIndex<state.introIndex){sceneIntroIndex++;sceneIndex=0;introRefusal=false;if(sceneIntroIndex>=INTRO.length)screen='main';}
  else{
    const result=choose(state,action);if(!result.ok){busy=false;redraw(action);toast(result.error);return;}state=result.state;changes=result.changes;readPage=0;
    if(action==='continue'){sceneIndex=0;introRefusal=false;sceneIntroIndex=state.introIndex;screen=state.phase==='intro'?'scene':'main';}
    else if(result.outcome?.presentation==='scene'||state.phase!=='playing')enterOutcome();
    else if(state.crisis){screen='main';navigation=[];}
  }
  persist();
  try{
    await animateNumbers(changes,from,oldLayout,action,id);if(id!==animationId)return;
    const result=drawGame();currentLayout=result.layout;const newcomers=result.layout.revealedStats.filter(stat=>!oldLayout.revealedStats.includes(stat));
    let target=result.pixels;
    if(newcomers.length&&!prefs.reduceMotion){target=result.pixels.slice();for(const stat of newcomers){const r=result.layout.statRects[stat];for(let y=r.y;y<r.y+r.h;y++)target.fill(0xffffffff,y*width+r.x,y*width+r.x+r.w);}}
    const effect=prefs.transition==='authored'?effectFor(action):prefs.transition;
    await animate(from,target,effect,SPEEDS[prefs.speed],p=>paint(p),()=>id===animationId);
    for(const stat of newcomers){if(id!==animationId)return;const next=target.slice(),r=result.layout.statRects[stat];for(let y=r.y;y<r.y+r.h;y++)next.set(result.pixels.subarray(y*width+r.x,y*width+r.x+r.w),y*width+r.x);
      await animate(target,next,'dissolve',700,p=>paint(p),()=>id===animationId);target=next;}
    if(id===animationId){currentPixels=result.pixels;paint(currentPixels);}
  }finally{if(id===animationId){busy=false;installControls(currentLayout);persist();}}
}
function effectRows(changes){const visible=changes?.filter(c=>names[c.stat]&&Math.abs(c.amount)>=.001&&(!attributes.includes(c.stat)||view.revealedStats.includes(c.stat)))||[];return visible.map(c=>`<div class="effect-row"><b>${esc(signed(c.amount))} ${esc(names[c.stat])}</b><small>${esc(c.label||'')}</small></div>`).join('');}
function inspectOffer(id){if(busy)return;const offer=allOffers().find(o=>o.id===id);if(!offer)return;$('offer-title').textContent=offer.label;$('offer-description').textContent=prose(offer.description);const learnedChoice=view.revealedStats.includes('choice');$('offer-requirement').textContent=`${fmt(offer.duration)} hours${learnedChoice?` · Requires ${offer.requirement} Choice`:''}.${!offer.available?' '+offer.lockedReason:''}`;
  $('offer-effects').innerHTML=(offer.uncertain?'<p>The outcome is uncertain.</p>':'')+(offer.blinking&&view.revealedStats.includes('rapture')?'<p>This is calling to you. Letting it pass costs Rapture.</p>':'')+effectRows(offer.preview);$('offer-choose').disabled=!offer.available;$('offer-choose').onclick=()=>{$('offer-dialog').close();activate(id);};$('offer-dialog').showModal();}
function explainAttribute(stat){if(!view.revealedStats.includes(stat))return;
  $('attribute-title').textContent=`${prose(names[stat])} · ${attributeFmt(stat)}`;$('attribute-text').textContent=prose(attributeDescription(stat,state));$('attribute-dialog').showModal();}
function activate(action){
  if(busy)return;audio.unlock();
  if(action==='settings'){$('settings').showModal();return;}
  if(action==='effects'){openEffects();return;}
  if(action==='restart'){$('restart-dialog').showModal();return;}
  if(action.startsWith('attribute:')){explainAttribute(action.slice(10));return;}
  if(action.startsWith('system:')){const system=view.systems.find(s=>s.id===action.slice(7));if(!system?.unlocked){toast('Not yet. There is no system to tend.');return;}}
  const offer=allOffers().find(o=>o.id===action);if(offer&&!offer.available){inspectOffer(action);return;}
  audio.beep();if(action.includes('feed'))audio.feed();
  change(action).catch(error=>{console.error(error);resize();toast('Unable to change this card. '+error.message);});
}

function drawIllustration(ctx, s, x, y, w, h) {
  box(ctx, x, y, w, h);
  const cx = x + w / 2;
  if (s.location === 'outside') {
    for (let i = 0; i < 5; i++) icon(ctx, i % 2 ? 'tree-small' : 'tree', cx - 104 + i * 43, y + h - 52 - (i % 2) * 8);
    icon(ctx, 'sun', cx + 65, y + 7);
  } else if (s.location === 'hole') {
    icon(ctx, 'tree', x + 8, y + h - 44); icon(ctx, 'tree-small', x + w - 42, y + h - 42);
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(cx, y + h / 2 + 4, Math.min(75, w / 3), Math.min(29, h / 2 - 5), 0, 0, Math.PI * 2); ctx.fill();
  } else if (s.location === 'home') {
    icon(ctx, 'home', cx - 32, y + h / 2 - 32, 2); icon(ctx, 'tree-small', cx - 104, y + h - 42); icon(ctx, 'sun', cx + 68, y + 10);
  } else {
    for (let i = 0; i < 4; i++) icon(ctx, i % 2 ? 'food' : 'bread', cx - 84 + i * 44, y + h / 2 - 12);
    line(ctx, x + 16, y + h - 18, x + w - 16, y + h - 17);
    for (let i = 0; i < 3; i++) line(ctx, x + 24 + i * (w - 48) / 3, y + 10, x + 24 + i * (w - 48) / 3 + 34, y + 12);
  }
}

function demoCard(alternate){const c=document.createElement('canvas');c.width=288;c.height=152;const ctx=c.getContext('2d',{willReadFrequently:true});box(ctx,0,0,288,152);text(ctx,alternate?'THE HOLE':'OUTSIDE',144,10,14,true,'center');drawIllustration(ctx,{location:alternate?'hole':'outside'},8,34,272,106);return monochrome(ctx,288,152);}
let demoAlternate=false;
function openEffects(){$('effects-dialog').showModal();paint(demoCard(demoAlternate),$('effect-preview').getContext('2d'),288,152);}
async function playDemo(){const id=++demoId,effect=$('demo-effect').value,target=$('demo-target').value,ctx=$('effect-preview').getContext('2d'),from=demoCard(demoAlternate),to=makeTarget(from,demoCard(!demoAlternate),288,target);$('play-effect').disabled=$('next-effect').disabled=true;$('demo-status').textContent=`${titleCase(effect)} · ${$('demo-speed').value} · to ${target}`;audio.unlock();audio.beep();const duration=SPEEDS[$('demo-speed').value],output=new Uint32Array(from.length);let start;
  await new Promise(resolve=>{const tick=now=>{if(demoId!==id||!$('effects-dialog').open){resolve();return;}start??=now;const p=prefs.reduceMotion?1:Math.min(1,(now-start)/duration);paint(composeFrame(from,to,288,152,p,effect,output),ctx,288,152);if(p>=1)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});if(demoId===id){demoAlternate=!demoAlternate;$('play-effect').disabled=$('next-effect').disabled=false;}}
function setupDialogs(){
  for(const effect of EFFECTS){$('demo-effect').add(new Option(titleCase(effect),effect));if(effect!=='flash')$('transition').add(new Option(titleCase(effect),effect));}
  $('demo-effect').value='dissolve';for(const speed of Object.keys(SPEEDS)){$('speed').add(new Option(titleCase(speed),speed));$('demo-speed').add(new Option(titleCase(speed),speed));}for(const target of TARGETS)$('demo-target').add(new Option(titleCase(target),target));
  $('sound').checked=prefs.sound;$('motion').checked=prefs.reduceMotion;$('large-text').checked=prefs.largeText;$('transition').value=prefs.transition;$('speed').value=$('demo-speed').value=prefs.speed;
  $('sound').onchange=e=>{prefs.sound=e.target.checked;audio.enabled=prefs.sound;if(!prefs.sound)audio.stop();else audio.unlock();savePrefs();};
  $('motion').onchange=e=>{prefs.reduceMotion=e.target.checked;savePrefs();redraw();};$('large-text').onchange=e=>{prefs.largeText=e.target.checked;readPage=0;savePrefs();redraw();};
  $('transition').onchange=e=>{prefs.transition=e.target.value;savePrefs();};$('speed').onchange=e=>{prefs.speed=e.target.value;$('demo-speed').value=prefs.speed;savePrefs();};
  $('show-effects').onclick=openEffects;
  $('show-guide').onclick=()=>{$('learned-guide').innerHTML=view.revealedStats.map(stat=>`<p><b>${names[stat]}</b> is now visible. Tap it at the top of the screen to learn what it means.</p>`).join('')+(state.phase==='playing'?'<p>Hold a decision to read it before choosing. The three small icons open parts of your life as you build them. A faded icon is not available yet.</p>':'');$('guide').showModal();};
  $('show-progress').onclick=()=>{$('settings').close();activate('progress');};
  $('play-effect').onclick=playDemo;$('next-effect').onclick=()=>{$('demo-effect').selectedIndex=($('demo-effect').selectedIndex+1)%EFFECTS.length;playDemo();};$('effects-dialog').addEventListener('close',()=>{demoId++;$('play-effect').disabled=$('next-effect').disabled=false;});
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('restart').onclick=()=>$('restart-dialog').showModal();
  $('confirm-restart').onclick=()=>{animationId++;busy=false;state=createGame();choiceShown=false;introRefusal=false;screen='scene';sceneSource='intro';sceneIndex=sceneIntroIndex=logIndex=readPage=systemPage=0;navigation=[];persist();document.querySelectorAll('dialog[open]').forEach(d=>d.close());redraw();};
  window.alignmentBack=()=>{const open=[...document.querySelectorAll('dialog[open]')].at(-1);if(open){open.close();return true;}if(busy){animationId++;busy=false;redraw();persist();return true;}if(screen==='main'||(screen==='scene'&&sceneSource==='intro'&&sceneIntroIndex===0&&sceneIndex===0&&!introRefusal))return false;activate('back');return true;};
  addEventListener('keydown',event=>{if(!document.querySelector('dialog[open]')&&screen==='scene'&&currentLayout.scene?.kind==='prompt'&&['y','n'].includes(event.key.toLowerCase())){event.preventDefault();activate(event.key.toLowerCase()==='y'?'continue':'decline');return;}if(event.key==='Escape'&&!document.querySelector('dialog[open]')&&window.alignmentBack())event.preventDefault();if(!document.querySelector('dialog[open]')&&screen==='scene'&&(event.key==='ArrowRight'||event.key===' ')){event.preventDefault();const next=currentLayout.buttons.find(b=>['next-line','continue','close-scene','sleep','begin_stage2'].includes(b.action));if(next)activate(next.action);}if(event.key==='ArrowLeft'&&!document.querySelector('dialog[open]')){event.preventDefault();window.alignmentBack();}});
}
try{
  const savedGame=storage.getItem(SAVE_KEY);
  try{if(JSON.parse(savedGame)?.version===1&&storage.getItem(MIGRATION_BACKUP_KEY)===null)migrationBackupPending=savedGame;}catch{}
  state=restoreGame(savedGame)||createGame();screen=state.phase==='intro'?'scene':'main';sceneSource='intro';sceneIntroIndex=state.introIndex;
  try{const ui=JSON.parse(storage.getItem(UI_KEY));const validPosition=p=>p&&['main','scene','log','system','progress'].includes(p.screen)&&['intro','outcome','entry'].includes(p.sceneSource)&&['local','fintech','social'].includes(p.systemId)&&['sceneIndex','sceneIntroIndex','logIndex','readPage','systemPage'].every(k=>Number.isInteger(p[k])&&p[k]>=0&&p[k]<10000);
    if(ui&&ui.seed===state.seed&&ui.turn===state.turn&&ui.phase===state.phase&&ui.introIndex===state.introIndex&&validPosition(ui)){restorePosition(ui);choiceShown=ui.choiceShown===true;navigation=Array.isArray(ui.navigation)?ui.navigation.filter(validPosition).slice(-12):[];}
  }catch{}
  const assetNames=['tree','tree-small','sun','home','food','bread','computer','book','coin','tools','people','town','heart','compass','friend','coffee','briefcase','chart'];
  const loadImage=(target,name,src)=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{target[name]=img;resolve();};img.onerror=()=>reject(Error('Missing image: '+src));img.src=src;});
  await Promise.all(assetNames.map(name=>loadImage(icons,name,'icons/'+name+'.png')));
  setupDialogs();savePrefs();resize();$('boot').remove();addEventListener('resize',resize);
  const pause=()=>{persist();audio.stop();if(busy){animationId++;busy=false;redraw();}};
  addEventListener('pagehide',pause);addEventListener('alignmentpause',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  setInterval(()=>{if(!busy&&!document.hidden&&!prefs.reduceMotion&&screen!=='scene'&&state.phase==='playing'&&!document.querySelector('dialog[open]')){pulse=!pulse;const result=drawGame();currentPixels=result.pixels;paint(currentPixels);}},750);
  window.alignmentSnapshot=()=>({state:JSON.parse(JSON.stringify(state)),view:{...getView(state),revealedStats:[...view.revealedStats]},calendar:view.calendar,screen,scene:currentLayout.scene,storyEvent:currentLayout.storyEvent||null,art:currentLayout.art||null,systemId,systemPage,logIndex,page:currentLayout.page,pageCount:currentLayout.pageCount,tab:screen==='main'?'decisions':screen,busy,renderer:'original-hypercard-canvas',effects:EFFECTS.length,revealedStats:[...view.revealedStats],saveFailed,width,height,controls:currentLayout.buttons.map(b=>({action:b.action,label:b.label,available:b.available,x:b.x,y:b.y,w:b.w,h:b.h})),currentTransition:prefs.transition});
}catch(error){$('boot').textContent='Unable to open the stack. '+error.message;console.error(error);}
