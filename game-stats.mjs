export const STAT_KEYS = Object.freeze(['rapture','hunger','disquiet','money','choice']);
// Hunger changes never appear in logs; its eventual header number shows the trend.
// The other four stats follow Roy's log rule, including unrevealed ones.
export const LOG_STAT_KEYS = Object.freeze(['rapture','money','disquiet','choice']);
export const STAT_ICONS = Object.freeze({rapture:'heart',hunger:'food',money:'coin',disquiet:'friend',choice:'compass'});
export const STAT_LABELS_DEFAULT = Object.freeze(Object.fromEntries(STAT_KEYS.map(key=>[key,key])));
export const HEADER_STAT_ORDER = Object.freeze(['rapture','money','disquiet','choice','hunger']);
// Raised attributes reserve the clock's right-hand space. Very narrow screens
// keep the row just below the clock so all five fixed slots still fit.
export const headerStatX = (stat,width) => 14+(width-(width>=320?112:48))/HEADER_STAT_ORDER.length*(HEADER_STAT_ORDER.indexOf(stat)+.5);
export function headerStatLayout(width){
  const iconY=width>=320?64:88;
  return {iconY,labelY:iconY+38,totalY:iconY+55,changeY:iconY+80,transferY:iconY+66,dividerY:iconY+108,dividerInset:22};
}
export const signedChange = amount => `${amount>0?'+':''}${Number(amount.toFixed(6))}`;
