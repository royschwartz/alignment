// Read Roy's current document on every load, then add only the opt-in preview.
// This module has no save route and cannot change the source document/history.
import {validateDocument} from './author-schema.mjs';
import {STAT_LABELS_DEFAULT} from './game-stats.mjs';
import {HUNGER_DEFAULTS} from './hunger-indicator.mjs';
import {extendStoryDocument} from './first-nights.mjs';
const source=new URL('./author-document.json',import.meta.url);
const raw=typeof window==='undefined'
  ?JSON.parse(await(await import('node:fs/promises')).readFile(source,'utf8'))
  :await(await fetch(source,{cache:'no-store'})).json();
export let DOCUMENT,SCRIPT_ID,INTRO,ACTIONS,LOGS,MESSAGES,STAT_LABELS,UI,MESSAGE_LINKS,CHOICE_WARNINGS,REQUIRE_ACTION_LOGS,TEXT_LAYOUTS,FIRST_PURCHASE_MESSAGE,HUNGER_INDICATOR,INITIAL_VALUES,SCHEDULED_EVENTS;
export function applyDocument(doc) {
  DOCUMENT=structuredClone(validateDocument(extendStoryDocument(doc)));
  ({script:SCRIPT_ID,intro:INTRO,actions:ACTIONS,logs:LOGS,messages:MESSAGES,statLabels:STAT_LABELS,ui:UI}=DOCUMENT);
  STAT_LABELS={...STAT_LABELS_DEFAULT,...STAT_LABELS};
  MESSAGE_LINKS=DOCUMENT.messageLinks||{};CHOICE_WARNINGS=DOCUMENT.choiceWarnings||null;
  FIRST_PURCHASE_MESSAGE=DOCUMENT.firstPurchaseMessage||null;
  HUNGER_INDICATOR={...HUNGER_DEFAULTS,...DOCUMENT.hungerIndicator};
  INITIAL_VALUES=DOCUMENT.startingValues||{};SCHEDULED_EVENTS=DOCUMENT.scheduledEvents||[];
  REQUIRE_ACTION_LOGS=DOCUMENT.requireActionLogs===true;TEXT_LAYOUTS=DOCUMENT.textLayouts||{};
}
export const getDocument=()=>structuredClone(DOCUMENT);
applyDocument(raw.document||raw);
