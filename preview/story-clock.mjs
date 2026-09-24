export const DEFAULT_START_HOUR=13;
export function storyTime(elapsedMinutes=0,startHour=DEFAULT_START_HOUR) {
  const start=Number(startHour),elapsed=Number(elapsedMinutes);
  const hour=Math.floor(((Number.isInteger(start)&&start>=0&&start<24?start:DEFAULT_START_HOUR)*60+
    (Number.isFinite(elapsed)&&elapsed>=0?elapsed:0))/60)%24;
  return `${hour%12||12} ${hour<12?'am':'pm'}`;
}
export const logDateTime=(ui,elapsedMinutes)=>[ui.logDate?.trim(),storyTime(elapsedMinutes,ui.logStartHour)].filter(Boolean).join(' · ');

// Persistent clock: task time, including minutes and multi-hour/day events.
// The manuscript supplies the calendar date; never use the computer's date.
export function gameClock(ui,elapsedMinutes=0) {
  const start=Number(ui.logStartHour??DEFAULT_START_HOUR);
  const total=(Number.isInteger(start)&&start>=0&&start<24?start:DEFAULT_START_HOUR)*60+Math.max(0,Number(elapsedMinutes)||0);
  const hour=Math.floor(total/60)%24,minute=Math.floor(total)%60,days=Math.floor(total/1440);
  let date=ui.logDate?.trim()||'';
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const match=/^(\w+) (\d+)(?:st|nd|rd|th)$/.exec(date);
  if(days&&match&&months.includes(match[1])){
    const value=new Date(Date.UTC(1997,months.indexOf(match[1]),Number(match[2])+days)),n=value.getUTCDate();
    const suffix=n%100>=11&&n%100<=13?'th':({1:'st',2:'nd',3:'rd'}[n%10]||'th');
    date=`${months[value.getUTCMonth()]} ${n}${suffix}`;
  }
  return {date,time:`${hour%12||12}:${String(minute).padStart(2,'0')} ${hour<12?'AM':'PM'}`};
}
