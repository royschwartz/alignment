import { SCRIPT_ID, INTRO, ACTIONS, LOGS, MESSAGES } from './author-legacy-data.mjs';

export const SAVE_KEY = 'alignment.human-authored.v1';
export const SAVE_VERSION = 2;
const nodes = new Map(INTRO.map((node, index) => [node.id, { ...node, index }]));
// Retain the prototype's Rapture/Hunger values; Roy specified a $900 starting balance.
export const BASELINE = Object.freeze({ rapture: 36, hunger: 16, disquiet: 2, money: 900 });
// Provisional tuning, separate from Roy's writing. Durations are game minutes.
export const TASK_MINUTES = Object.freeze({ dinner: 15, dishes: 30, groceries: 60, cook: 60 });
export const TIME_RATES = Object.freeze({ hungerPerHour: .9, rapturePerHour: 3, disquietPerHour: 1 / 24, hungerDrainPerHour: 1 / 24 });
const round = number => Math.round(number * 1e6) / 1e6;
export function advanceTaskTime(values, minutes, rates = TIME_RATES) {
  if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Invalid task duration');
  const hours = minutes / 60, growth = rates.hungerPerHour * hours;
  // Integrate the growing hunger over the task rather than charging its final level for every hour.
  const loss = hours * (rates.rapturePerHour + values.disquiet * rates.disquietPerHour +
    (values.hunger + growth / 2) * rates.hungerDrainPerHour);
  // Hunger grows continuously during the task; resolve its Rapture cost in whole points.
  return { ...values, hunger: round(values.hunger + growth), rapture: Math.max(0, values.rapture - Math.round(loss)) };
}
export const createGame = () => ({
  version: SAVE_VERSION, script: SCRIPT_ID, phase: 'intro', node: 'wake', trail: [],
  timedFrom: 0, elapsedMinutes: 0,
  completed: [], stats: {}, logs: [], message: null
});
export const currentNode = state => nodes.get(state.node);
export const visibleActions = state => ACTIONS.filter(action =>
  (!action.requires || state.completed.includes(action.requires)) &&
  // Replace the dinner slot as its grocery/cooking trail advances.
  (action.id !== 'dinner' || !state.completed.includes('dinner')) &&
  (action.id !== 'groceries' || !state.completed.includes('groceries'))
);
export const availableActions = state => state.phase === 'playing' && !state.message
  ? visibleActions(state).filter(action => (action.message || action.log) && !state.completed.includes(action.id)) : [];

export const hasGainedRapture = state => state.completed.some(id => ACTIONS.find(action => action.id === id)?.raptureGain > 0);
function messageFor(action, completed) {
  return action?.firstGainMessage && !hasGainedRapture({ completed }) ? action.firstGainMessage : action?.message || null;
}
function statsFor(completed, timedFrom = 0) {
  let values = { ...BASELINE }, elapsedMinutes = 0;
  const revealed = new Set();
  for (const [index, id] of completed.entries()) {
    if (index >= timedFrom) {
      const minutes = TASK_MINUTES[id];
      values = advanceTaskTime(values, minutes); elapsedMinutes += minutes;
    }
    if (id === 'dinner') revealed.add('hunger');
    if (id === 'dishes') {
      if (index < timedFrom) values.rapture = Math.max(0, values.rapture - 2);
      revealed.add('rapture');
    }
    if (id === 'groceries') { values.money -= 50; revealed.add('money'); }
    const gain = ACTIONS.find(action => action.id === id).raptureGain || 0;
    if (gain > 0) { values.rapture = round(values.rapture + gain); revealed.add('rapture'); }
  }
  return { stats: Object.fromEntries([...revealed].map(id => [id, values[id]])), elapsedMinutes };
}

export function choose(state, action) {
  const next = structuredClone(state);
  if (state.phase === 'intro') {
    const node = currentNode(state);
    if (action === 'skip-intro' || (action === 'begin' && node.begin)) {
      next.phase = 'playing'; next.message = null; next.logs = ['opening']; next.trail = [];
      return next;
    }
    if (action === 'back' && next.trail.length) { next.node = next.trail.pop(); return next; }
    let target;
    if (node.yes) target = action === 'yes' ? node.yes : action === 'no' ? node.no : null;
    else if (action === 'next' && !node.begin) target = node.next || INTRO[node.index + 1]?.id;
    if (!target) return state;
    next.trail.push(state.node); next.trail = next.trail.slice(-128); next.node = target;
    return next;
  }
  if (action === 'dismiss-message') { next.message = null; return next; }
  const selected = availableActions(state).find(item => item.id === action);
  if (!selected) return state;
  next.message = messageFor(selected, state.completed); next.completed.push(action);
  Object.assign(next, statsFor(next.completed, next.timedFrom));
  if (selected.log) next.logs.push(selected.log);
  // Log only the entry explicitly supplied for an action.
  return next;
}

export function restoreGame(raw) {
  try {
    const value = JSON.parse(raw);
    if (!value || ![1, SAVE_VERSION].includes(value.version) || value.script !== SCRIPT_ID ||
        !['intro', 'playing'].includes(value.phase) || !nodes.has(value.node) ||
        !Array.isArray(value.trail) || value.trail.length > 128 || value.trail.some(id => !nodes.has(id)) ||
        !Array.isArray(value.completed) || new Set(value.completed).size !== value.completed.length ||
        value.completed.some((id, index) => !ACTIONS.some(action => action.id === id &&
          (action.message || action.log) && (!action.requires || value.completed.slice(0, index).includes(action.requires)))) ||
        !Array.isArray(value.logs) || !value.stats || typeof value.stats !== 'object' || Array.isArray(value.stats) ||
        (value.message !== null && !Object.hasOwn(MESSAGES, value.message))) return null;
    // Existing playthroughs keep their balances; time costs apply only to subsequent tasks.
    const timedFrom = value.version === 1 ? value.completed.length : value.timedFrom;
    if (!Number.isInteger(timedFrom) || timedFrom < 0 || timedFrom > value.completed.length) return null;
    const { stats: expectedStats, elapsedMinutes } = statsFor(value.completed, timedFrom);
    if (value.version === SAVE_VERSION && value.elapsedMinutes !== elapsedMinutes) return null;
    const lastAction = ACTIONS.find(action => action.id === value.completed.at(-1));
    const expectedMessage = messageFor(lastAction, value.completed.slice(0, -1));
    if (value.message !== null && value.message !== expectedMessage &&
        !(value.version === 1 && value.message === lastAction?.message)) return null;
    // Preserve any preview saved between the expense-only UI and Roy's $900 balance instruction.
    const legacyMoneyDelta = value.version === 1 && value.completed.includes('groceries') && value.stats.money === -50;
    if (Object.keys(value.stats).length !== Object.keys(expectedStats).length ||
        Object.entries(expectedStats).some(([key, amount]) => value.stats[key] !== amount && !(key === 'money' && legacyMoneyDelta))) return null;
    if (value.phase === 'intro' && (value.logs.length || value.completed.length || value.message)) return null;
    const expectedLogs = value.phase === 'intro' ? [] : ['opening', ...value.completed.flatMap(id => {
      const action = ACTIONS.find(item => item.id === id); return action.log ? [action.log] : [];
    })];
    const legacyLogs = expectedLogs.filter(id => id !== 'dishes');
    if (JSON.stringify(value.logs) !== JSON.stringify(expectedLogs) &&
        !(value.version === 1 && JSON.stringify(value.logs) === JSON.stringify(legacyLogs))) return null;
    // Reconstruct only known fields; arbitrary stored prose can never reach the renderer.
    return { version: SAVE_VERSION, script: SCRIPT_ID, phase: value.phase, node: value.node, timedFrom, elapsedMinutes,
      trail: [...value.trail], completed: [...value.completed], stats: expectedStats,
      logs: expectedLogs, message: value.message === null ? null : expectedMessage };
  } catch { return null; }
}
export function serializeGame(state) {
  const raw = JSON.stringify(state);
  if (!restoreGame(raw)) throw new Error('Invalid game state');
  return raw;
}
