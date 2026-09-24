export const DEFAULT_START_HOUR=13;
export function storyTime(elapsedMinutes=0,startHour=DEFAULT_START_HOUR) {
  const start=Number(startHour),elapsed=Number(elapsedMinutes);
  const hour=Math.floor(((Number.isInteger(start)&&start>=0&&start<24?start:DEFAULT_START_HOUR)*60+
    (Number.isFinite(elapsed)&&elapsed>=0?elapsed:0))/60)%24;
  return `${hour%12||12} ${hour<12?'am':'pm'}`;
}
export const logDateTime=(ui,elapsedMinutes)=>[ui.logDate?.trim(),storyTime(elapsedMinutes,ui.logStartHour)].filter(Boolean).join(' · ');
