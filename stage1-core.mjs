import * as CONTENT from './stage1-content.mjs';
const { INTRO, ACTIONS } = CONTENT;

export const SAVE_VERSION = 2;
export const ATTRIBUTE_KEYS = ['disquiet', 'rapture', 'choice', 'hunger', 'money'];
export const DEFAULT_RULES = Object.freeze({ hungerRaptureThreshold: 10 });
const STAT_KEYS = ['rapture', 'disquiet', 'choice', 'hunger'];
const SKILL_KEYS = ['coding', 'math', 'finance', 'social', 'practical'];
const RELATIONSHIP_KEYS = ['friend', 'person', 'town', 'jim', 'ethan', 'wendy', 'madame', 'priestess', 'fool', 'sun'];
const PERSONALITY_KEYS = ['honesty', 'empathy', 'resolve', 'caution'];
const HELPERS = [{ id: 'jim', name: 'GRINGO JIM', flag: 'Jim' }, { id: 'ethan', name: 'ETHAN', flag: 'Ethan' }, { id: 'wendy', name: 'WENDY', flag: 'Wendy' }];
const MAX_HISTORY = 1200;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = n => Math.round(n * 1000) / 1000;
const clone = value => JSON.parse(JSON.stringify(value));
const evaluate = (value, state, fallback = 0) => typeof value === 'function' ? value(state) : value ?? fallback;
const actionMap = new Map(ACTIONS.map(action => [action.id, action]));
const storyEvents = CONTENT.STORY_EVENTS || [];
const eventMap = new Map(storyEvents.map(event => [event.id, event]));
for (const event of storyEvents) for (const option of event.options) actionMap.set(option.id, { category: 'story', subcategory: event.id, duration: 0.5, ...option, eventId: event.id });

export function attributeDescription(stat, state) {
  const descriptions = {
    disquiet: 'Disquiet is gained and lost as appropriate to the circumstance.\n\nAt the end of each day, you lose Rapture equal to your Disquiet total.',
    rapture: 'Rapture is gained and lost as appropriate to the circumstance.\n\nSometimes when you make a decision you must sacrifice it.',
    choice: 'You gain Choice by making decisions where you sacrifice Rapture.\n\nYou lose Choice under mysterious circumstances.',
    hunger: `At the end of each day, Hunger exceeding ${state?.rules?.hungerRaptureThreshold ?? DEFAULT_RULES.hungerRaptureThreshold} will be subtracted from your Rapture total.`,
    money: 'Money is earned and spent as appropriate to the circumstance.\n\nThis is ordinary money, measured in dollars.',
  };
  return descriptions[stat] || '';
}
const SYSTEMS = [
  { id: 'local', label: 'Home and your friend', unlocked: () => true, hint: 'First, return home.' },
  { id: 'fintech', label: 'Work and learning', unlocked: () => true, hint: 'First, return home.' },
  { id: 'social', label: 'People', unlocked: s => (s.progress.townVisits || 0) > 0 || Boolean(s.flags.metPerson), hint: 'Go into town. There are people you know, and people you have not met.' },
];

const WAIT = {
  id: 'wait', label: 'Wait', description: 'Let one hour pass. The world does not wait with you.',
  category: 'rest', subcategory: 'waiting', duration: 1,
  requirement: s => clamp(5 + Math.floor(s.stats.disquiet / 25) + Math.floor(s.stats.hunger / 40), 5, 10),
  effects: s => ({ disquiet: s.stats.hunger >= 65 ? 1.5 : -1.3, rapture: s.stats.hunger >= 85 ? -1 : 0 }),
  challenge: 0,
  outcome: s => ({ title: 'Time passes.', text: s.stats.hunger >= 65 ? 'You count the spaces between the trees. Something inside you counts the spaces between meals.' : 'For a little while, you do nothing. It is still a decision.' }),
};

const CRISIS_ACTIONS = [
  {
    id: 'crisis_help', label: 'Ask for help', description: 'Admit you cannot carry this alone. Someone in town can bring supplies.',
    category: 'crisis', subcategory: 'honesty', duration: 2, requirement: 0, challenge: 3,
    effects: () => ({ hunger: -42, disquiet: -10, rapture: -2, food: 2, progress: { danger: -2 }, flags: { acceptedHelp: true } }),
    outcome: () => ({ title: 'Someone answers.', text: 'You do not explain the shape of the problem. You say you have not eaten. A bag is left beside your door. Accepting it hurts. The relief hurts too.' }),
  },
  {
    id: 'crisis_move', label: 'Move your friend deeper', description: 'Carry what you can into the ravine. Exhausting, painful, and a way out.',
    category: 'crisis', subcategory: 'shelter', duration: 3, requirement: 0, challenge: 3,
    effects: () => ({ hunger: -18, disquiet: -7, rapture: -3, progress: { danger: -2 }, flags: { temporaryShelter: true } }),
    outcome: () => ({ title: 'One difficult shelter.', text: 'You pull branches over a hollow beneath the ridge. Your hands shake. So do the roots. By morning the sound cannot be heard from the road.' }),
  },
  {
    id: 'crisis_ignore', label: 'Leave the sound unanswered', description: 'Walk away while the sound reaches the road. Repeated abandonment can expose your friend.',
    category: 'crisis', subcategory: 'abandonment', duration: 3, requirement: 0, ethics: 5, challenge: 0,
    effects: () => ({ disquiet: 6, rapture: -5, progress: { danger: 1 } }),
    outcome: s => ({ title: (s.progress.danger || 0) >= 2 ? 'The road is no longer empty.' : 'Someone has heard.', text: (s.progress.danger || 0) >= 2 ? 'The search party follows the sound into the trees. You feel the restraints before you see the lights. Your friend cannot survive being taken apart.' : 'You keep walking. Behind you, a driver stops. A light moves across the trees. There is still time to bring your friend somewhere safe.' }),
  },
];
for (const action of CRISIS_ACTIONS) if (!actionMap.has(action.id)) actionMap.set(action.id, action);

const FINISH = {
  id: 'finish_stage1', label: 'Make room for a larger life',
  description: 'Commit to the life you have built. Complete Stage 1.',
  category: 'story', subcategory: 'commitment', duration: 1, requirement: 0,
  effects: () => ({ rapture: 12, disquiet: -5 }),
  outcome: () => ({ title: 'A larger life.', text: 'There is food for tomorrow. There is work you know how to do, and someone who expects to see you again. Beneath the trees, GLIZGLAT dreams a dream you almost understand.\n\nYou have made a life around the impossible. Keeping it will be the next thing.\n\nSTAGE 1 COMPLETE' }),
};
actionMap.set(FINISH.id, actionMap.has('stage1_complete') ? { ...actionMap.get('stage1_complete'), id: FINISH.id } : FINISH);

function hashSeed(seed) {
  let value = 2166136261;
  for (const char of String(seed)) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) || 1;
}

function random(state) {
  let value = state.rng;
  value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
  state.rng = (value >>> 0) || 1;
  return state.rng / 4294967296;
}

export function appetiteRate(hours) {
  // Personal hunger grows between meals. The friend's growing meal schedule
  // is separate, so eating dinner cannot postpone feeding him.
  return 1;
}

export function friendCare(state) {
  const intervalDays = CONTENT.careInterval?.(state) ?? 7;
  const foodRequired = CONTENT.careFoodRequired?.(state) ?? 1;
  const care = state.care || { lastFedAt: 0, nextFeedAt: 168 };
  return { ...care, intervalDays, foodRequired, capacity: state.flags.wagon ? 8 : 2,
    dueIn: round(care.nextFeedAt - state.hours), overdue: Math.max(0, round(state.hours - care.nextFeedAt)) };
}

function friendHungerFloor(state) {
  const overdue = friendCare(state).overdue;
  return overdue > 0 ? clamp(35 + overdue * 2.5) : 0;
}

export function taskSuccessChance(state, action) {
  const task = action.task;
  if (!task) return 1;
  const traits = state.personality || {};
  const practice = Math.min(0.12, state.history.filter(entry => entry.id === action.id).length * 0.015);
  const affinity = task.skill === 'social' ? (traits.empathy || 0) * 0.12 + (traits.honesty || 0) * 0.08
    : (traits.resolve || 0) * 0.12 + (traits.caution || 0) * 0.1;
  return clamp(0.72 - Number(task.difficulty || 0.4) * 0.4 + (state.skills[task.skill] || 0) * 0.055 + practice + affinity, 0.25, 0.97);
}

function emotionalEffect(state, action, stat, amount) {
  const p = state.personality || {};
  if (stat === 'choice') return amount * (1 + (p.resolve || 0) * 0.18);
  if (stat === 'disquiet') return amount * (1 + (p.caution || 0) * 0.18 - (p.resolve || 0) * 0.12 + (Number(evaluate(action.ethics, state, 0)) > 0 ? (p.honesty || 0) * 0.2 : 0));
  if (stat === 'rapture') return amount * (1 + (['relationship', 'social', 'care', 'story'].includes(action.category) ? (p.empathy || 0) * 0.2 : (p.resolve || 0) * 0.1));
  return amount;
}

/** The fiction's calendar is independent of the device clock and timezone. */
export function gameDate(hours = 0) {
  const elapsed = Number.isFinite(hours) ? clamp(hours, 0, 100_000_000) : 0;
  const date = new Date(Date.UTC(1997, 7, 6, 5) + Math.floor(elapsed * 60 + 1e-8) * 60_000);
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
  return { year, month, day, hour: date.getUTCHours(), minute: date.getUTCMinutes(), date: `${months[month - 1]} ${day}, ${year}` };
}

function timeHunger(state, duration) {
  // The same elapsed-time trajectory applies to every seed. Inventions can
  // ease the work of care, but do not randomly change the friend's appetite.
  return appetiteRate(state.hours) * duration;
}

export function createGame(seed = Date.now(), rules = {}) {
  const hungerRaptureThreshold = rules.hungerRaptureThreshold ?? DEFAULT_RULES.hungerRaptureThreshold;
  if (!Number.isFinite(hungerRaptureThreshold) || hungerRaptureThreshold < 0) throw new RangeError('The Hunger threshold must be a nonnegative number.');
  return {
    version: SAVE_VERSION, seed: String(seed), rng: hashSeed(seed), phase: 'intro', introIndex: 0,
    rules: { hungerRaptureThreshold },
    turn: 0, hours: 0, stats: { rapture: 24, disquiet: 4, choice: 64, hunger: 16 },
    money: 20, food: 0, skills: { coding: 0, math: 0, finance: 0, social: 0, practical: 0 },
    relationships: { friend: 0, person: 0, town: 0, jim: 0, ethan: 0, wendy: 0, madame: 0, priestess: 0, fool: 0, sun: 0 }, flags: {}, progress: { feeds: 0, danger: 0 },
    care: { lastFedAt: 0, nextFeedAt: 168 },
    personality: { honesty: 0, empathy: 0, resolve: 0, caution: 0 },
    pendingEvent: null, completedEvents: [], lastEventTurn: -3,
    history: [], journal: [], offers: [], crisis: null, lastOutcome: null,
  };
}

function eligible(action, state) {
  if (typeof action.when === 'function') return Boolean(action.when(state));
  if (action.when && typeof action.when === 'object') return Object.entries(action.when).every(([key, value]) => state.flags[key] === value);
  return true;
}

function systemUnlocked(system, state) { return state.phase !== 'intro' && system.unlocked(state); }

function systemActions(state, systemId) {
  const system = SYSTEMS.find(item => item.id === systemId);
  if (!system || !systemUnlocked(system, state) || state.phase !== 'playing' || state.crisis || state.pendingEvent) return [];
  if (ACTIONS.some(action => action.system)) return ACTIONS.filter(action => action.system === systemId && eligible(action, state) && !action.id.startsWith('crisis_'));
  const canShow = id => actionMap.has(id) && eligible(actionMap.get(id), state);
  const first = ids => ids.find(canShow);
  let ids;
  if (systemId === 'local') {
    const feeding = state.flags.feederBuilt && (!state.flags.feederStocked || state.stats.hunger > 50)
      ? first(['stock_feeder', 'feed_friend']) : first(['feed_friend', 'stock_feeder']);
    ids = [feeding, first(['collect_surplus', 'buy_food', 'search_surplus']),
      first(['arrange_surplus', 'buy_cooler', 'repair_shelter', 'build_feeder']),
      first(['learn_name']), state.skills.practical < 3 ? first(['learn_practical']) : null,
      first(['sit_friend', 'ask_friend'])];
  } else if (systemId === 'fintech') {
    ids = [first(['course_lesson', 'portfolio_project', 'portfolio_review', 'job_interview', 'promotion', 'build_model', 'launch_model']),
      first(['salaried_work', 'temporary_shift']), first(['report_mistake', 'correct_work_lie']),
      state.skills.coding < 4 ? first(['learn_code']) : null,
      state.skills.finance < 3 ? first(['study_finance']) : null,
      first(['attend_meetup', 'make_budget'])];
  } else {
    ids = [first(['repair_trust', 'cafe_person', 'walk_person', 'confide_person', 'honest_limit', 'romance_person', 'commit_person']),
      first(['time_person', 'talk_person']), first(['go_town']), first(['volunteer']),
      state.skills.social < 3 ? first(['practice_social']) : first(['accept_help'])];
  }
  return [...new Set(ids.filter(Boolean))].map(id => actionMap.get(id));
}

function mainChoiceBlocked(state) {
  return state.phase === 'playing' && (!state.pendingEvent && currentRequirement(WAIT, state) > state.stats.choice || state.offers.some(id => {
    const action = actionMap.get(id);
    return action && currentRequirement(action, state) > state.stats.choice;
  }));
}

function rememberChoice(state) { if (mainChoiceBlocked(state)) state.flags.choiceDiscovered = true; }

function revealedStats(state) {
  if (state.phase === 'intro') return [];
  const used = stat => Boolean(state.flags[`${stat}Discovered`]) || state.journal.some(entry => entry.changes?.some(change => change.stat === stat && change.amount !== 0));
  // Earlier compatible saves may predate consequence history. Different
  // starting values after a committed turn still record that these were used.
  const oldRapture = state.turn > 0 && state.stats.rapture !== 24;
  const oldDisquiet = state.turn > 0 && state.stats.disquiet !== 4;
  return ATTRIBUTE_KEYS.filter(stat => stat === 'hunger' || stat === 'money' || stat === 'choice'
    ? stat !== 'choice' || Boolean(state.flags.choiceDiscovered) || mainChoiceBlocked(state)
    : used(stat) || (stat === 'rapture' ? oldRapture : oldDisquiet));
}

/** Opening a system only discovers a visible Choice limitation. No time passes. */
export function inspectSystem(state, systemId, visibleActionIds) {
  const visible = Array.isArray(visibleActionIds) ? new Set(visibleActionIds) : null;
  if (state.flags.choiceDiscovered || !systemActions(state, systemId).some(action => (!visible || visible.has(action.id)) && currentRequirement(action, state) > state.stats.choice)) return state;
  return { ...state, flags: { ...state.flags, choiceDiscovered: true } };
}

function currentRequirement(action, state) {
  if (typeof action.requirement === 'function') return Math.round(clamp(action.requirement(state)));
  if (action.category === 'crisis' || action.eventId) return Math.round(clamp(action.requirement || 0));
  const history = state.history.filter(entry => entry.id === action.id).length;
  const categorySkill = { learning: 'coding', career: 'finance', work: 'finance', social: 'social', relationship: 'social', care: 'practical', practical: 'practical' }[action.category];
  const practice = Math.min(7, history * 1.5) + (categorySkill ? Math.min(6, state.skills[categorySkill] * 0.6) : 0);
  let mood = 0;
  if (['social', 'relationship', 'learning', 'career'].includes(action.category)) mood += Math.max(0, state.stats.disquiet - 40) * 0.11;
  if (action.category === 'care') mood -= Math.max(0, state.stats.hunger - 40) * 0.09;
  else mood += Math.max(0, state.stats.hunger - 65) * 0.09;
  return Math.round(clamp((action.requirement || 0) + mood - practice));
}

function blockedReason(action, state) {
  if (state.pendingEvent && action.eventId !== state.pendingEvent) return 'You have to answer what is happening first.';
  if (action.eventId && action.eventId !== state.pendingEvent) return 'That conversation is not happening now.';
  if ((action.id === FINISH.id || action.id === 'stage1_complete') && !stageReady(state)) return 'Finish the commitments below and bring Hunger below 75 first.';
  if (!action.eventId && !eligible(action, state)) return 'That decision is not available in these circumstances.';
  if (['feed_friend', 'stock_feeder'].includes(action.id)) {
    const care = friendCare(state);
    if (care.dueIn > 12) return 'Your friend is still full. There is time for your own life.';
    const load = Math.max(care.foodRequired, -Number(evaluate(action.effects, state, {}).food || 0));
    if (load > care.capacity) return 'You need a wagon to bring enough food in one trip.';
  }
  const requirement = currentRequirement(action, state);
  if (state.stats.choice < requirement) return `Requires ${requirement} Choice. That is very hard for you to do.`;
  if (action.id === 'wait' && state.crisis) return 'You cannot settle while the shared pain is becoming unbearable.';
  const cost = Number(evaluate(action.minMoney ?? action.cost, state, 0));
  if (state.money < cost) return `You need $${Math.ceil(cost)}.`;
  const food = Number(evaluate(action.minFood, state, 0));
  if (state.food < food) return `You need ${food} food.`;
  const effects = evaluate(action.effects, state, {});
  if (state.money + (effects.money || 0) < -0.00001) return `You need $${Math.ceil(-(effects.money || 0))}.`;
  if (state.food + (effects.food || 0) < -0.00001) return `You need ${Math.ceil(-(effects.food || 0))} food.`;
  return '';
}

function hiddenDesire(action, state) {
  const baseline = Number(evaluate(action.desire, state, 0.15));
  const affinity = state.history.slice(-10).filter(entry => entry.category === action.category).length * 0.018;
  return baseline + Math.min(0.12, affinity);
}

function blinking(action, state) {
  return !blockedReason(action, state) && hiddenDesire(action, state) >= 0.72;
}

function neglectChanges(state, selectedId) {
  if (state.pendingEvent) return [];
  return state.offers.map(id => actionMap.get(id)).filter(Boolean)
    .filter(action => action.id !== selectedId && blinking(action, state))
    .map(action => ({ stat: 'rapture', amount: -Number(evaluate(action.neglect, state, 1.2)), source: action.id, label: `You let ${action.label.toLowerCase()} pass` }));
}

function choiceBonus(action, state, changes) {
  // Only Rapture actually sacrificed by this decision qualifies. Daily losses
  // are applied later and cannot earn Choice just by letting time pass.
  if (!changes.some(change => change.stat === 'rapture' && change.amount < 0) || Number(evaluate(action.ethics, state, 0)) > 0) return 0;
  const reward = Number(evaluate(action.challenge, state, 3));
  let similarity = 0;
  for (const old of state.history) {
    if (old.id === action.id) return 0;
    if (old.category === action.category) similarity = Math.max(similarity, old.subcategory === action.subcategory ? 0.8 : 0.55);
  }
  return reward * (1 - similarity);
}

function appendChange(state, changes, stat, amount, source, label) {
  if (!Number.isFinite(amount) || Math.abs(amount) < 0.000001) return;
  let container = state;
  let key = stat;
  if (STAT_KEYS.includes(stat)) container = state.stats;
  else if (stat.startsWith('skills.')) { container = state.skills; key = stat.slice(7); }
  else if (stat.startsWith('relationships.')) { container = state.relationships; key = stat.slice(14); }
  const old = container[key] || 0;
  let next = old + amount;
  if (STAT_KEYS.includes(stat)) next = clamp(next);
  else next = Math.max(0, next);
  container[key] = round(next);
  const actual = round(container[key] - old);
  if (Math.abs(actual) >= 0.0005) changes.push({ stat, amount: actual, source, label });
}

function advanceTime(state, changes, duration, source) {
  const end = round(state.hours + duration);
  const threshold = state.rules?.hungerRaptureThreshold ?? DEFAULT_RULES.hungerRaptureThreshold;
  // The first day begins at 05:00, so its midnight is 19 elapsed hours.
  // Split longer decisions at each midnight to use Hunger at that boundary.
  while (state.hours < end) {
    const midnight = (Math.floor((state.hours + 5) / 24) + 1) * 24 - 5;
    const until = Math.min(end, midnight);
    appendChange(state, changes, 'hunger', timeHunger(state, until - state.hours), source, `${duration} ${duration === 1 ? 'hour passes' : 'hours pass'}`);
    state.hours = until;
    appendChange(state, changes, 'hunger', Math.max(0, friendHungerFloor(state) - state.stats.hunger), source, 'Your friend is still waiting for food');
    if (until === midnight) {
      appendChange(state, changes, 'rapture', -state.stats.disquiet, source, 'End of day: Disquiet');
      appendChange(state, changes, 'rapture', -Math.max(0, state.stats.hunger - threshold), source, `End of day: Hunger above ${threshold}`);
    }
  }
}

function resolve(state, action, { preview = false } = {}) {
  // Historical entries are immutable. Copy the containers we change, without
  // repeatedly duplicating the entire illustrated journal for every preview.
  const next = {
    ...state, stats: { ...state.stats }, skills: { ...state.skills },
    relationships: { ...state.relationships }, flags: { ...state.flags }, progress: { ...state.progress },
    history: [...state.history], journal: [...state.journal], offers: [...state.offers],
    care: { ...(state.care || { lastFedAt: 0, nextFeedAt: 168 }) },
    personality: { ...state.personality }, completedEvents: [...(state.completedEvents || [])],
    crisis: state.crisis ? { ...state.crisis } : null,
  };
  const changes = [];
  const succeeded = !action.task || preview || random(next) < taskSuccessChance(state, action);
  const effects = evaluate(succeeded ? action.effects : action.task.failureEffects, state, {});
  let duration = Math.max(0, Number(evaluate(action.duration, state, 1)));
  if (['feed_friend', 'stock_feeder', 'collect_surplus'].includes(action.id) && HELPERS.some(helper => state.flags[`recruited${helper.flag}`])) duration = Math.max(1, duration - 1);
  for (const change of neglectChanges(state, action.id)) appendChange(next, changes, change.stat, emotionalEffect(state, action, change.stat, change.amount), change.source, change.label);
  const directDisquiet = emotionalEffect(state, action, 'disquiet', Number(effects.disquiet || 0));
  appendChange(next, changes, 'disquiet', directDisquiet, action.id, directDisquiet > 0 ? 'The difficult part' : 'The world grows quieter');
  const rawRapture = emotionalEffect(state, action, 'rapture', Number(effects.rapture || 0));
  const receptiveRapture = rawRapture > 0 ? rawRapture / (1 + state.stats.disquiet / 50) : 0;
  const anticipatedGain = Math.min(receptiveRapture, 100 - next.stats.rapture);
  const raptureCeiling = next.stats.disquiet - anticipatedGain * 0.2 > 0 ? 99.99 : 100;
  const earnedRapture = Math.min(receptiveRapture, Math.max(0, raptureCeiling - next.stats.rapture));
  if (rawRapture < 0) appendChange(next, changes, 'rapture', rawRapture, action.id, 'What it costs you');
  if (earnedRapture > 0) {
    appendChange(next, changes, 'rapture', earnedRapture, action.id, 'Love of the world');
    appendChange(next, changes, 'disquiet', -earnedRapture * 0.2, action.id, 'Rapture eases Disquiet');
  }
  const ethics = Math.max(0, Number(evaluate(action.ethics, state, 0)));
  const bonus = emotionalEffect(state, action, 'choice', choiceBonus(action, state, changes));
  appendChange(next, changes, 'choice', bonus, action.id, 'Rapture sacrificed for a decision');
  appendChange(next, changes, 'choice', emotionalEffect(state, action, 'choice', -ethics), action.id, 'A promise to yourself becomes smaller');
  appendChange(next, changes, 'choice', emotionalEffect(state, action, 'choice', Number(effects.choice || 0)), action.id, 'What this decision asks of you');
  // No automatic spending or passive decay of Choice exists. Authored ethical
  // costs and decisions that sacrifice Rapture are its two sources of change.
  appendChange(next, changes, 'hunger', Number(effects.hunger || 0), action.id, effects.hunger < 0 ? 'Something is fed' : 'The shared need');
  appendChange(next, changes, 'money', Number(effects.money || 0), action.id, effects.money < 0 ? 'Spent' : 'Earned');
  appendChange(next, changes, 'food', Number(effects.food || 0), action.id, effects.food < 0 ? 'Food for your friend' : 'Supplies');
  for (const key of SKILL_KEYS) {
    let gain = Number(effects.skills?.[key] || 0);
    if (gain > 0 && ['coding', 'math', 'finance'].includes(key)) gain *= 1 + Math.min(0.6, (state.progress.feeds || 0) * 0.06) + (state.flags.awakening ? 0.25 : 0);
    if (gain > 0 && key === 'practical' && state.flags.recruitedEthan) gain *= 1.2;
    appendChange(next, changes, `skills.${key}`, gain, action.id, state.flags.awakening && ['coding', 'math', 'finance'].includes(key) ? 'You understand it before you finish reading' : 'Practice stays with you');
  }
  for (const key of RELATIONSHIP_KEYS) appendChange(next, changes, `relationships.${key}`, Number(effects.relationships?.[key] || 0), action.id, 'A bond changes');
  for (const [key, amount] of Object.entries(effects.progress || {})) next.progress[key] = Math.max(0, round((next.progress[key] || 0) + amount));
  Object.assign(next.flags, effects.flags || {});
  for (const key of PERSONALITY_KEYS) next.personality[key] = round(clamp((state.personality?.[key] || 0) + Number(evaluate(action.personality, state, {})[key] || 0), -1, 1));
  if (succeeded && ['feed_friend', 'stock_feeder'].includes(action.id)) {
    next.care.lastFedAt = round(state.hours + duration);
    next.care.nextFeedAt = round(Math.max(next.care.lastFedAt, state.care?.nextFeedAt ?? 168) + friendCare(next).intervalDays * 24);
  } else if (effects.flags?.crisisRelief && next.care.nextFeedAt <= state.hours + duration) {
    next.care.nextFeedAt = round(state.hours + duration + 24);
  }
  if (action.id === 'collect_surplus' && state.flags.recruitedJim) appendChange(next, changes, 'food', 1, action.id, 'Jim knows who has something left over');
  if (['feed_friend', 'stock_feeder'].includes(action.id) && HELPERS.some(helper => state.flags[`recruited${helper.flag}`])) appendChange(next, changes, 'disquiet', -1, action.id, 'Someone shares the load');
  advanceTime(next, changes, duration, action.id);
  // Small positive residue must never make 100 Rapture possible. Explicit
  // relief reaches zero naturally via the bounded subtraction above.
  if (next.stats.disquiet > 0 && next.stats.rapture >= 100) appendChange(next, changes, 'rapture', -0.01, action.id, 'There is still Disquiet');
  next.turn += 1;
  // Keep prose cycling even after the bounded decision history rolls over.
  const visitKey = `visits_${action.id}`;
  next.progress[visitKey] = (state.progress[visitKey] ?? state.history.filter(entry => entry.id === action.id).length) + 1;
  next.history.push({ id: action.id, category: action.category || 'other', subcategory: action.subcategory || action.id, turn: next.turn });
  next.history = next.history.slice(-MAX_HISTORY);
  const authoredOutcome = succeeded ? action.outcome : action.task.failureOutcome;
  const result = typeof authoredOutcome === 'function' ? authoredOutcome(state, next) : authoredOutcome;
  const outcome = typeof result === 'string' ? { title: action.label, text: result } : result || { title: action.label, text: action.description || 'Time passes.' };
  return { state: next, changes, outcome, ...(action.task ? { taskSucceeded: succeeded } : {}) };
}

function helperConsequences(state, result) {
  for (const helper of HELPERS) {
    if (!state.flags[`met${helper.flag}`]) continue;
    const suspicion = state.progress[`${helper.id}Suspicion`] || 0;
    const warned = `warned${helper.flag}`, reported = `reported${helper.flag}`;
    if (suspicion >= 10 && state.flags[warned] && !state.flags[reported]) {
      state.flags[reported] = true;
      state.flags[`recruited${helper.flag}`] = false;
      state.progress.danger = (state.progress.danger || 0) + 1;
      appendChange(state, result.changes, 'disquiet', 8, helper.id, 'Someone has told the town');
      result.outcome.text += `\n\n${helper.name} has told someone about the trips into the woods. A car slows outside your house. Your friend feels you watching it.`;
      result.outcome.presentation = 'scene';
    } else if (suspicion >= 6 && !state.flags[warned]) {
      state.flags[warned] = true;
      result.outcome.text += `\n\n${helper.name} no longer believes your explanation. They say they will tell someone if this keeps happening. You still have time to speak honestly and repair their trust.`;
      result.outcome.presentation = 'scene';
    }
    if (suspicion < 6) state.flags[warned] = false;
  }
}

function milestones(state) {
  if (CONTENT.STAGE1_MILESTONES) return CONTENT.STAGE1_MILESTONES.map(item => ({ id: item.id, label: item.label, done: Boolean(item.test(state)), detail: String(evaluate(item.detail, state, '')) }));
  return [
    { id: 'care', label: 'Keep your friend fed', done: (state.progress.feeds || 0) >= 10, detail: `${Math.min(10, state.progress.feeds || 0)}/10 meals shared` },
    { id: 'career', label: 'Build a fintech career', done: Boolean(state.flags.promoted), detail: state.flags.promoted ? 'Trusted with work of your own' : state.flags.employed ? 'A first job; room to grow' : 'Find a way into fintech' },
    { id: 'person', label: 'Let PERSON into your life', done: Boolean(state.flags.relationship), detail: state.flags.relationship ? 'A relationship you both chose' : state.flags.metPerson ? 'A person becoming important' : 'Someone you have not met yet' },
    { id: 'learning', label: 'Learn what this life needs', done: state.skills.coding >= 4 && state.skills.finance >= 3 && state.skills.practical >= 2, detail: `Coding ${Math.min(4, state.skills.coding).toFixed(1)}/4 · Finance ${Math.min(3, state.skills.finance).toFixed(1)}/3 · Practical ${Math.min(2, state.skills.practical).toFixed(1)}/2` },
    { id: 'apparatus', label: 'Make care sustainable', done: Boolean(state.flags.feederBuilt), detail: state.flags.feederBuilt ? 'A working feeder in the woods' : 'Build a reliable way to feed your friend' },
    { id: 'name', label: 'Learn your friend’s name', done: Boolean(state.flags.nameRevealed), detail: state.flags.nameRevealed ? 'GLIZGLAT' : 'The shape of a name is forming' },
  ];
}

function stageReady(state) { return milestones(state).every(item => item.done) && state.stats.hunger < 75 && !state.crisis; }

function crisisActions(state) {
  const harmfulId = state?.crisis?.kind === 'strain' && (state.progress.danger || 0) < 2 && actionMap.has('crisis_silence') ? 'crisis_silence' : 'crisis_leave';
  const authored = ['crisis_move_friend', 'crisis_call_person', harmfulId].map(id => actionMap.get(id)).filter(Boolean);
  return authored.length === 3 ? authored : CRISIS_ACTIONS;
}

function updateCrisis(state, selectedId) {
  if (state.flags.crisisRelief) { state.crisis = null; delete state.flags.crisisRelief; }
  const danger = state.progress.danger || 0;
  if (selectedId === 'crisis_ignore' && danger >= 3) state.flags.friendCaptured = true;
  if (state.flags.friendCaptured || state.flags.friendKilled) {
    state.phase = 'failed';
    state.ending = 'linked-death';
    state.offers = [];
    return;
  }
  const severe = state.stats.hunger >= 94 || state.stats.disquiet >= 88 || (state.stats.choice < 10 && (state.stats.disquiet > 60 || state.stats.hunger > 70));
  const oldSteps = state.crisis?.steps || 0;
  if (severe || danger > 0) state.crisis = { level: Math.max(1, danger), kind: state.stats.hunger >= 94 ? 'hunger' : danger > 0 ? 'exposure' : 'strain', steps: oldSteps + 1 };
  else state.crisis = null;
}

function selectOffers(state) {
  if (state.phase !== 'playing') { state.offers = []; return; }
  if (state.pendingEvent) {
    state.offers = eventMap.get(state.pendingEvent).options.map(option => option.id);
    rememberChoice(state); return;
  }
  if (state.crisis) { state.offers = crisisActions(state).map(action => action.id); rememberChoice(state); return; }
  if (state.turn - state.lastEventTurn >= 3) {
    const event = storyEvents.find(event => !state.completedEvents.includes(event.id) && evaluate(event.when, state, true));
    if (event) {
      state.pendingEvent = event.id; state.offers = event.options.map(option => option.id);
      rememberChoice(state); return;
    }
  }
  const pool = ACTIONS.filter(action => eligible(action, state) && !['stage1_complete', FINISH.id].includes(action.id) && !action.id.startsWith('crisis_'));
  const selected = [];
  if (stageReady(state)) selected.push(actionMap.has('stage1_complete') ? 'stage1_complete' : FINISH.id);
  const weight = action => {
    let value = Math.max(0.01, Number(evaluate(action.weight, state, 1)));
    if (action.category === 'care' && /feed/i.test(action.id)) value *= 1 + state.stats.hunger / 35;
    const recent = state.history.slice(-2).filter(entry => entry.id === action.id).length;
    value *= Math.pow(0.58, recent);
    if (blockedReason(action, state)) value *= 0.32;
    return value;
  };
  while (selected.length < 3 && pool.length) {
    const weights = pool.map(weight);
    let pick = random(state) * weights.reduce((sum, value) => sum + value, 0);
    let index = weights.length - 1;
    for (let i = 0; i < weights.length; i++) { pick -= weights[i]; if (pick < 0) { index = i; break; } }
    selected.push(pool.splice(index, 1)[0].id);
  }
  if (!selected.some(id => !blockedReason(actionMap.get(id), state)) && blockedReason(WAIT, state)) {
    const accessible = ACTIONS.filter(action => eligible(action, state) && !blockedReason(action, state));
    if (accessible.length) selected[0] = accessible[Math.floor(random(state) * accessible.length)].id;
    else { state.crisis = { level: 1, kind: 'strain', steps: 1 }; selected.splice(0, selected.length, ...crisisActions(state).map(action => action.id)); }
  }
  state.offers = [...new Set(selected)];
  rememberChoice(state);
}

function offerView(action, state) {
  const lockedReason = blockedReason(action, state);
  const preview = lockedReason ? [] : resolve(state, action, { preview: true }).changes;
  const harmful = !lockedReason && (Number(evaluate(action.effects, state, {}).rapture || 0) < 0 || neglectChanges(state, action.id).length > 0);
  return {
    id: action.id, label: action.label, description: String(evaluate(action.description, state, '')), category: action.category || 'other',
    duration: Number(evaluate(action.duration, state, 1)), requirement: currentRequirement(action, state),
    available: !lockedReason, lockedReason, blinking: blinking(action, state),
    thorny: harmful || preview.some(change => change.stat === 'rapture' && change.amount < 0),
    preview, finish: action.id === FINISH.id || action.id === 'stage1_complete',
    uncertain: Boolean(action.task),
  };
}

function systemsView(state) {
  const short = number => Number(number.toFixed(1)).toString();
  return SYSTEMS.map(system => {
    const unlocked = systemUnlocked(system, state);
    let text = '', hint = system.hint;
    if (unlocked) {
      hint = state.pendingEvent ? 'You need to answer first.' : state.crisis ? 'The shared pain needs your attention first.' : 'Looking costs no time. Choosing something here does.';
      if (system.id === 'local') {
        const care = friendCare(state);
        text = `${state.food} bags of food. ${state.progress.feeds || 0} meals brought to your friend.\n${care.dueIn > 12 ? `He will need food in about ${Math.max(1, Math.round(care.dueIn / 24))} days.` : `He needs ${care.foodRequired} bags of food now.`}\n${state.flags.wagon ? 'The wagon takes the weight.' : 'You can carry two bags at a time.'}`;
      } else if (system.id === 'fintech') text = `${state.flags.modelLaunched ? 'Your automated trader is running under the limits you set.' : state.flags.traderBuilt ? 'The trader needs testing before you trust it with money.' : 'You have a job at the grocery store, and things to learn after work.'}\nCoding ${short(state.skills.coding)}. Math ${short(state.skills.math)}. Markets ${short(state.skills.finance)}.`;
      else text = `${state.flags.relationship ? 'You and PERSON are together.' : state.flags.metPerson ? 'You keep thinking about PERSON.' : 'People you pass on the street are becoming familiar.'}\n${HELPERS.filter(helper => state.flags[`recruited${helper.flag}`]).map(helper => `${helper.name} is helping.`).join(' ') || 'There are people who might help, once they trust you.'}`;
    }
    return {
      id: system.id, label: system.label, unlocked, hint, text,
      actions: systemActions(state, system.id).map(action => ({ ...offerView(action, state), system: system.id, blinking: state.offers.includes(action.id) && blinking(action, state) })),
    };
  });
}

export function getView(state) {
  const intro = INTRO[state.introIndex];
  const last = state.journal.at(-1);
  const mood = state.crisis ? 'The shared pain is becoming unbearable' : state.stats.hunger >= 75 ? 'The hunger presses close' : state.stats.disquiet >= 65 ? 'Every ordinary thing feels difficult' : state.stats.rapture >= 55 ? 'There is room in the world' : 'Something is changing';
  const event = eventMap.get(state.pendingEvent);
  const responses = event ? event.options.map(option => offerView(actionMap.get(option.id), state)) : [];
  return {
    phase: state.phase, intro: state.phase === 'intro' ? intro : null,
    title: state.phase === 'intro' ? intro?.title : last?.title || 'The first morning',
    text: state.phase === 'intro' ? intro?.text : last?.text || 'You leave the woods with an emptiness that is no longer entirely yours. There is food to find. There is a life to begin.',
    mood, chapter: state.phase === 'stage2' ? 'Stage 2' : state.flags.relationship ? 'A larger life' : state.flags.modelLaunched ? 'While you are elsewhere' : state.flags.awakening ? 'The world coming alive' : state.flags.metPerson ? 'Other people' : 'The first days',
    offers: state.phase === 'playing' ? state.offers.map(id => actionMap.get(id)).filter(Boolean).map(action => offerView(action, state)) : [],
    wait: state.phase === 'playing' && !event ? offerView(WAIT, state) : null,
    storyEvent: event ? { id: event.id, title: event.title, text: String(evaluate(event.text, state, '')), options: responses } : null,
    systems: systemsView(state), revealedStats: revealedStats(state),
    presentation: state.phase === 'intro' ? 'scene' : state.lastOutcome?.presentation || last?.presentation || 'log',
    milestones: milestones(state), ready: stageReady(state),
    day: Math.floor((state.hours + 5) / 24) + 1, hour: gameDate(state.hours).hour, calendar: gameDate(state.hours),
    care: friendCare(state),
    crisis: state.crisis ? { ...state.crisis, warning: 'You feel your friend’s pain as your own. Stay and care for him, or ask for help. Repeated abandonment will leave both of you weaker and can kill you both.' } : null,
    ending: state.ending || null,
  };
}

export function choose(state, actionId) {
  if (state.phase === 'intro') {
    if (actionId === 'decline' && (state.introIndex === 0 || state.introIndex === 1)) {
      const text = INTRO[state.introIndex].refusal || (state.introIndex === 0 ? 'can you describe this feeling?' : '*I am hungry*');
      return { state, ok: true, changes: [], outcome: { title: '', text, presentation: 'scene', returnToLine: INTRO[state.introIndex].returnToLine } };
    }
    if (actionId !== 'continue') return { state, ok: false, error: 'Continue the opening first.', changes: [], outcome: null };
    const next = clone(state);
    const scene = INTRO[state.introIndex];
    next.introIndex += 1;
    if (next.introIndex >= INTRO.length) {
      next.phase = 'playing'; next.introIndex = INTRO.length;
      const text = CONTENT.STAGE1_START || 'you wake up from a long nap. you are getting hungry';
      next.journal.push({ turn: 0, hours: 0, title: 'A long nap', text, presentation: 'log' });
      next.lastOutcome = { title: 'A long nap', text, presentation: 'log' };
      selectOffers(next);
    }
    return { state: next, ok: true, changes: [], outcome: { title: scene.title, text: scene.text, presentation: 'scene' } };
  }
  if (state.phase === 'dream' && actionId === 'sleep') {
    const next = clone(state), changes = [];
    advanceTime(next, changes, 8, 'sleep');
    next.turn += 1; next.phase = 'complete'; next.ending = 'stage-one';
    next.flags.dreamSeen = true;
    const outcome = { title: 'The dream', text: CONTENT.STAGE1_DREAM || 'you fall asleep beside PERSON.\n\nyou dream of hating every human alive.\n\nthere are no exceptions.\n\nyou wake before you can tell whose hatred it was.', presentation: 'scene' };
    next.lastOutcome = outcome;
    next.journal.push({ turn: next.turn, hours: next.hours, actionId, ...outcome, changes });
    next.journal = next.journal.slice(-200);
    return { state: next, ok: true, changes, outcome };
  }
  if (state.phase === 'complete' && actionId === 'begin_stage2' && state.flags.dreamSeen) {
    const next = clone(state);
    next.phase = 'stage2'; next.flags.stage2Started = true;
    const outcome = { title: 'STAGE 2', text: 'STAGE 2\n\nPERSON is asleep beside you.\n\nsomewhere else, you are awake.', presentation: 'scene' };
    next.lastOutcome = outcome;
    next.journal.push({ turn: next.turn, hours: next.hours, actionId, ...outcome, changes: [] });
    next.journal = next.journal.slice(-200);
    return { state: next, ok: true, changes: [], outcome };
  }
  if (state.phase !== 'playing') return { state, ok: false, error: 'This chapter has ended.', changes: [], outcome: null };
  if (state.pendingEvent && !eventMap.get(state.pendingEvent)?.options.some(option => option.id === actionId)) return { state, ok: false, error: 'You have to choose a response to this event first.', changes: [], outcome: null };
  const throughSystem = SYSTEMS.some(system => systemActions(state, system.id).some(action => action.id === actionId));
  if (actionId !== WAIT.id && !state.offers.includes(actionId) && !throughSystem) return { state, ok: false, error: 'That decision is not available here yet.', changes: [], outcome: null };
  const action = actionId === WAIT.id ? WAIT : actionMap.get(actionId);
  if (!action) return { state, ok: false, error: 'Unknown decision.', changes: [], outcome: null };
  const error = blockedReason(action, state);
  if (error) return { state, ok: false, error, changes: [], outcome: null };
  const result = resolve(state, action);
  const next = result.state;
  if (action.eventId) {
    next.completedEvents.push(action.eventId);
    next.pendingEvent = null;
    next.lastEventTurn = next.turn;
  }
  helperConsequences(next, result);
  if (next.stats.disquiet > 0 && next.stats.rapture >= 100) appendChange(next, result.changes, 'rapture', -0.01, actionId, 'There is still Disquiet');
  if (mainChoiceBlocked(state)) next.flags.choiceDiscovered = true;
  for (const stat of ['rapture', 'disquiet']) if (result.changes.some(change => change.stat === stat && change.amount !== 0)) next.flags[`${stat}Discovered`] = true;
  updateCrisis(next, actionId);
  if (next.phase === 'failed' && actionId === 'crisis_ignore') result.outcome = { title: 'The same silence.', text: 'They follow the sound. They take your friend from the woods.\n\nYou feel a place inside him close. You try to tell him he is not alone, but there is no longer a difference between the pain in him and the pain in you.\n\nWhen GLIZGLAT goes silent, so do you.\n\nYour fates were joined from the first morning.' };
  else if (actionId === FINISH.id || actionId === 'stage1_complete') { next.phase = 'dream'; next.ending = null; next.offers = []; }
  const newSystems = SYSTEMS.filter(system => !systemUnlocked(system, state) && systemUnlocked(system, next)).map(system => system.id);
  const majorFlags = ['nameRevealed', 'wagon', 'awakening', 'recruitedJim', 'recruitedEthan', 'recruitedWendy', 'traderBuilt', 'traderTested', 'romance', 'relationship', 'modelLaunched', 'stage1Complete'];
  const major = majorFlags.some(flag => !state.flags[flag] && next.flags[flag]) || !(state.progress.feeds || 0) && (next.progress.feeds || 0) > 0;
  const crisisOnset = !state.crisis && Boolean(next.crisis);
  const fatalWarning = (state.progress.danger || 0) < 3 && (next.progress.danger || 0) >= 3 && next.phase === 'playing';
  result.outcome = { ...result.outcome, presentation: result.outcome.presentation === 'scene' || major || crisisOnset || fatalWarning || next.phase === 'failed' ? 'scene' : 'log', unlockedSystems: newSystems };
  if (crisisOnset) result.outcome.text += '\n\nThe shared pain is becoming unbearable. Your friend needs care, and you need help. You cannot simply wait it out.';
  if (fatalWarning) result.outcome.text += '\n\nHe is failing. You can feel your body failing with his. Walking away again will kill you both.';
  next.lastOutcome = { ...result.outcome };
  next.journal.push({ turn: next.turn, hours: next.hours, title: result.outcome.title, text: result.outcome.text, presentation: result.outcome.presentation, unlockedSystems: newSystems, actionId, ...(action.eventId ? { eventId: action.eventId } : {}), ...(action.task ? { taskSucceeded: result.taskSucceeded } : {}), changes: clone(result.changes) });
  next.journal = next.journal.slice(-200);
  selectOffers(next);
  return { ...result, ok: true };
}

function plainObject(value) { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null); }
function validChanges(changes) {
  return Array.isArray(changes) && changes.every(change => plainObject(change) && typeof change.stat === 'string' && Number.isFinite(change.amount) && typeof change.source === 'string' && typeof change.label === 'string');
}
function validPresentation(entry) {
  return (entry.presentation === undefined || ['scene', 'log'].includes(entry.presentation)) &&
    (entry.unlockedSystems === undefined || Array.isArray(entry.unlockedSystems) && entry.unlockedSystems.every(id => SYSTEMS.some(system => system.id === id)));
}
function safeData(value, depth = 0) {
  if (depth > 12) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER;
  if (typeof value === 'string') return value.length <= 16000;
  if (Array.isArray(value)) return value.length <= MAX_HISTORY && value.every(item => safeData(item, depth + 1));
  if (!plainObject(value) || Object.keys(value).length > 300) return false;
  return Object.entries(value).every(([key, item]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safeData(item, depth + 1));
}

export function validateSave(value) {
  if (!safeData(value) || !plainObject(value) || value.version !== SAVE_VERSION) return false;
  if (!['intro', 'playing', 'dream', 'complete', 'stage2', 'failed'].includes(value.phase)) return false;
  if (typeof value.seed !== 'string' || !Number.isInteger(value.rng) || value.rng <= 0 || value.rng > 4294967295) return false;
  if (!Number.isInteger(value.turn) || value.turn < 0 || !Number.isFinite(value.hours) || value.hours < 0) return false;
  if (value.rules !== undefined && (!plainObject(value.rules) || !Number.isFinite(value.rules.hungerRaptureThreshold) || value.rules.hungerRaptureThreshold < 0)) return false;
  if (!Number.isInteger(value.introIndex) || value.introIndex < 0 || value.introIndex > INTRO.length || (value.phase === 'intro' && value.introIndex >= INTRO.length)) return false;
  for (const [group, keys] of [['stats', STAT_KEYS], ['skills', SKILL_KEYS], ['relationships', RELATIONSHIP_KEYS]]) {
    if (!plainObject(value[group]) || !keys.every(key => Number.isFinite(value[group][key]) && value[group][key] >= 0 && (group !== 'stats' || value[group][key] <= 100))) return false;
  }
  if (value.stats.disquiet > 0 && value.stats.rapture >= 100) return false;
  if (!Number.isFinite(value.money) || value.money < 0 || !Number.isFinite(value.food) || value.food < 0) return false;
  if (!plainObject(value.flags) || !Object.values(value.flags).every(flag => typeof flag === 'boolean') || !plainObject(value.progress) || !Object.values(value.progress).every(n => typeof n === 'number' && n >= 0)) return false;
  if (!plainObject(value.care) || !Number.isFinite(value.care.lastFedAt) || value.care.lastFedAt < 0 || value.care.lastFedAt > value.hours || !Number.isFinite(value.care.nextFeedAt) || value.care.nextFeedAt < value.care.lastFedAt) return false;
  if (!plainObject(value.personality) || !PERSONALITY_KEYS.every(key => Number.isFinite(value.personality[key]) && value.personality[key] >= -1 && value.personality[key] <= 1)) return false;
  if (!Array.isArray(value.completedEvents) || new Set(value.completedEvents).size !== value.completedEvents.length || !value.completedEvents.every(id => eventMap.has(id))) return false;
  if (!Number.isInteger(value.lastEventTurn) || value.lastEventTurn < -3 || value.lastEventTurn > value.turn) return false;
  if (value.pendingEvent !== null && (!eventMap.has(value.pendingEvent) || value.completedEvents.includes(value.pendingEvent) || value.phase !== 'playing')) return false;
  if (value.pendingEvent && (!Array.isArray(value.offers) || value.offers.join('|') !== eventMap.get(value.pendingEvent).options.map(option => option.id).join('|'))) return false;
  if (!value.pendingEvent && value.offers?.some(id => actionMap.get(id)?.eventId)) return false;
  if (HELPERS.some(helper => value.flags[`reported${helper.flag}`] && value.flags[`recruited${helper.flag}`])) return false;
  if (['dream', 'complete', 'stage2'].includes(value.phase) && (!value.flags.relationship || !value.flags.stage1Complete)) return false;
  if (['complete', 'stage2'].includes(value.phase) && !value.flags.dreamSeen) return false;
  if (!Array.isArray(value.offers) || value.offers.length > 3 || new Set(value.offers).size !== value.offers.length || !value.offers.every(id => typeof id === 'string' && actionMap.has(id))) return false;
  if (value.phase === 'playing' && value.offers.length < 1) return false;
  if (value.phase !== 'playing' && value.offers.length !== 0) return false;
  if (!Array.isArray(value.history) || !value.history.every(entry => plainObject(entry) && typeof entry.id === 'string' && typeof entry.category === 'string' && typeof entry.subcategory === 'string' && Number.isInteger(entry.turn))) return false;
  if (!Array.isArray(value.journal) || !value.journal.every(entry => plainObject(entry) && typeof entry.title === 'string' && typeof entry.text === 'string' && Number.isFinite(entry.hours) && Number.isInteger(entry.turn) && (entry.changes === undefined || validChanges(entry.changes)) && validPresentation(entry))) return false;
  if (value.lastOutcome !== null && value.lastOutcome !== undefined && (!plainObject(value.lastOutcome) || typeof value.lastOutcome.title !== 'string' || typeof value.lastOutcome.text !== 'string' || !validPresentation(value.lastOutcome))) return false;
  if (value.crisis !== null && (!plainObject(value.crisis) || !Number.isInteger(value.crisis.level) || !Number.isInteger(value.crisis.steps) || typeof value.crisis.kind !== 'string')) return false;
  return true;
}

export function serializeGame(state) {
  if (!validateSave(state)) throw new Error('The game cannot be saved because its state is invalid.');
  return JSON.stringify(state);
}

export function restoreGame(text) {
  try {
    if (typeof text !== 'string' || text.length > 2_000_000) return null;
    let value = JSON.parse(text);
    if (value?.version === 1) value = migrateSave(value);
    if (value?.version === SAVE_VERSION && plainObject(value.relationships)) {
      for (const key of ['madame', 'priestess', 'fool', 'sun']) if (value.relationships[key] === undefined) value.relationships[key] = 0;
    }
    return validateSave(value) ? value : null;
  } catch { return null; }
}

function migrateSave(old) {
  if (!safeData(old) || !plainObject(old) || !plainObject(old.stats) || !plainObject(old.skills) || !plainObject(old.relationships) || !plainObject(old.flags) || !plainObject(old.progress) || !Array.isArray(old.offers) || !Array.isArray(old.history) || !Array.isArray(old.journal) || !Number.isFinite(old.hours) || old.hours < 0 || !Number.isInteger(old.turn) || old.turn < 0) return null;
  const next = { ...old, version: SAVE_VERSION, rules: old.rules || { ...DEFAULT_RULES },
    skills: { math: 0, ...old.skills }, relationships: { jim: 0, ethan: 0, wendy: 0, madame: 0, priestess: 0, fool: 0, sun: 0, ...old.relationships }, flags: { ...old.flags },
    care: { lastFedAt: Math.max(0, old.hours - 24), nextFeedAt: old.hours + 168 },
    personality: { honesty: 0, empathy: 0, resolve: 0, caution: 0 }, pendingEvent: null, completedEvents: [], lastEventTurn: Math.max(-3, old.turn - 3) };
  if (old.phase === 'intro' || old.turn === 0) {
    next.care = { lastFedAt: 0, nextFeedAt: 168 };
    next.stats = { ...old.stats };
    if (old.stats.rapture === 14) next.stats.rapture = 24;
    if (old.stats.disquiet === 38) next.stats.disquiet = 4;
    if (old.stats.hunger === 24) next.stats.hunger = 16;
  }
  if (old.flags.modelLaunched) { next.flags.traderBuilt = true; next.flags.traderTested = true; }
  if (old.phase === 'complete') {
    next.phase = 'dream'; next.flags.relationship = true; next.flags.stage1Complete = true;
  }
  next.offers = old.offers.filter(id => actionMap.has(id) && !actionMap.get(id).eventId && eligible(actionMap.get(id), next));
  if (next.phase === 'playing') selectOffers(next);
  else next.offers = [];
  return next;
}
