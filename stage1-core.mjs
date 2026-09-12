import * as CONTENT from './stage1-content.mjs';
const { INTRO, ACTIONS } = CONTENT;

export const SAVE_VERSION = 1;
const STAT_KEYS = ['rapture', 'disquiet', 'choice', 'hunger'];
const SKILL_KEYS = ['coding', 'finance', 'social', 'practical'];
const RELATIONSHIP_KEYS = ['friend', 'person', 'town'];
const MAX_HISTORY = 1200;
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = n => Math.round(n * 1000) / 1000;
const clone = value => JSON.parse(JSON.stringify(value));
const evaluate = (value, state, fallback = 0) => typeof value === 'function' ? value(state) : value ?? fallback;
const actionMap = new Map(ACTIONS.map(action => [action.id, action]));
const SYSTEMS = [
  { id: 'local', label: 'Your friend', unlocked: s => (s.progress.feeds || 0) >= 1, hint: 'First, bring your friend something to eat.' },
  { id: 'fintech', label: 'Fintech', unlocked: s => Boolean(s.flags.course), hint: 'A course could turn what you are learning into work.' },
  { id: 'social', label: 'People', unlocked: s => Boolean(s.flags.metPerson), hint: 'There is someone in town you have not met yet.' },
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
actionMap.set(FINISH.id, FINISH);

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
  return 1.7 + Math.min(1.4, 1.4 * Math.max(0, hours) / 160);
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
  const start = state.hours;
  const end = start + duration;
  const integral = x => x <= 160 ? 1.7 * x + 1.4 * x * x / 320 : 1.7 * 160 + 1.4 * 80 + 3.1 * (x - 160);
  return integral(end) - integral(start);
}

export function createGame(seed = Date.now()) {
  return {
    version: SAVE_VERSION, seed: String(seed), rng: hashSeed(seed), phase: 'intro', introIndex: 0,
    turn: 0, hours: 0, stats: { rapture: 14, disquiet: 38, choice: 64, hunger: 24 },
    money: 20, food: 0, skills: { coding: 0, finance: 0, social: 0, practical: 0 },
    relationships: { friend: 0, person: 0, town: 0 }, flags: {}, progress: { feeds: 0, danger: 0 },
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
  if (!system || !systemUnlocked(system, state) || state.phase !== 'playing' || state.crisis) return [];
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
  return state.phase === 'playing' && (currentRequirement(WAIT, state) > state.stats.choice || state.offers.some(id => {
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
  const oldRapture = state.turn > 0 && state.stats.rapture !== 14;
  const oldDisquiet = state.turn > 0 && state.stats.disquiet !== 38;
  return STAT_KEYS.filter(stat => stat === 'hunger' || stat === 'choice'
    ? stat === 'hunger' || Boolean(state.flags.choiceDiscovered) || mainChoiceBlocked(state)
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
  if (action.category === 'crisis') return Math.round(clamp(action.requirement || 0));
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
  if ((action.id === FINISH.id || action.id === 'stage1_complete') && !stageReady(state)) return 'Finish the commitments below and bring Hunger below 75 first.';
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
  return state.offers.map(id => actionMap.get(id)).filter(Boolean)
    .filter(action => action.id !== selectedId && blinking(action, state))
    .map(action => ({ stat: 'rapture', amount: -Number(evaluate(action.neglect, state, 1.2)), source: action.id, label: `You let ${action.label.toLowerCase()} pass` }));
}

function choiceBonus(action, state, effects) {
  if (!(effects.disquiet > 0) || Number(evaluate(action.ethics, state, 0)) > 0) return 0;
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

function resolve(state, action) {
  // Historical entries are immutable. Copy the containers we change, without
  // repeatedly duplicating the entire illustrated journal for every preview.
  const next = {
    ...state, stats: { ...state.stats }, skills: { ...state.skills },
    relationships: { ...state.relationships }, flags: { ...state.flags }, progress: { ...state.progress },
    history: [...state.history], journal: [...state.journal], offers: [...state.offers],
    crisis: state.crisis ? { ...state.crisis } : null,
  };
  const changes = [];
  const effects = evaluate(action.effects, state, {});
  const duration = Math.max(0, Number(evaluate(action.duration, state, 1)));
  for (const change of neglectChanges(state, action.id)) appendChange(next, changes, change.stat, change.amount, change.source, change.label);
  const directDisquiet = Number(effects.disquiet || 0);
  appendChange(next, changes, 'disquiet', directDisquiet, action.id, directDisquiet > 0 ? 'The difficult part' : 'The world grows quieter');
  const rawRapture = Number(effects.rapture || 0);
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
  const bonus = choiceBonus(action, state, effects);
  appendChange(next, changes, 'choice', bonus, action.id, 'A different difficult decision');
  appendChange(next, changes, 'choice', -ethics, action.id, 'A promise to yourself becomes smaller');
  // No automatic spending or passive decay of Choice exists. Authored ethical
  // costs and unfamiliar discomfort are its two sources of change.
  appendChange(next, changes, 'hunger', Number(effects.hunger || 0), action.id, effects.hunger < 0 ? 'Something is fed' : 'The shared need');
  appendChange(next, changes, 'money', Number(effects.money || 0), action.id, effects.money < 0 ? 'Spent' : 'Earned');
  appendChange(next, changes, 'food', Number(effects.food || 0), action.id, effects.food < 0 ? 'Food for your friend' : 'Supplies');
  for (const key of SKILL_KEYS) appendChange(next, changes, `skills.${key}`, Number(effects.skills?.[key] || 0), action.id, 'Practice stays with you');
  for (const key of RELATIONSHIP_KEYS) appendChange(next, changes, `relationships.${key}`, Number(effects.relationships?.[key] || 0), action.id, 'A bond changes');
  for (const [key, amount] of Object.entries(effects.progress || {})) next.progress[key] = Math.max(0, round((next.progress[key] || 0) + amount));
  Object.assign(next.flags, effects.flags || {});
  appendChange(next, changes, 'hunger', timeHunger(state, duration), action.id, `${duration} ${duration === 1 ? 'hour passes' : 'hours pass'}`);
  // Small positive residue must never make 100 Rapture possible. Explicit
  // relief reaches zero naturally via the bounded subtraction above.
  if (next.stats.disquiet > 0 && next.stats.rapture >= 100) appendChange(next, changes, 'rapture', -0.01, action.id, 'There is still Disquiet');
  next.hours = round(next.hours + duration);
  next.turn += 1;
  next.history.push({ id: action.id, category: action.category || 'other', subcategory: action.subcategory || action.id, turn: next.turn });
  next.history = next.history.slice(-MAX_HISTORY);
  const result = typeof action.outcome === 'function' ? action.outcome(state, next) : action.outcome;
  const outcome = typeof result === 'string' ? { title: action.label, text: result } : result || { title: action.label, text: action.description || 'Time passes.' };
  return { state: next, changes, outcome };
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
  if (state.crisis) { state.offers = crisisActions(state).map(action => action.id); rememberChoice(state); return; }
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
  const preview = lockedReason ? [] : resolve(state, action).changes;
  const harmful = !lockedReason && (Number(evaluate(action.effects, state, {}).rapture || 0) < 0 || neglectChanges(state, action.id).length > 0);
  return {
    id: action.id, label: action.label, description: String(evaluate(action.description, state, '')), category: action.category || 'other',
    duration: Number(evaluate(action.duration, state, 1)), requirement: currentRequirement(action, state),
    available: !lockedReason, lockedReason, blinking: blinking(action, state),
    thorny: harmful || preview.some(change => change.stat === 'rapture' && change.amount < 0),
    preview, finish: action.id === FINISH.id || action.id === 'stage1_complete',
  };
}

function systemsView(state) {
  const short = number => Number(number.toFixed(1)).toString();
  return SYSTEMS.map(system => {
    const unlocked = systemUnlocked(system, state);
    let text = '', hint = system.hint;
    if (unlocked) {
      hint = state.crisis ? 'The shared pain needs your attention first.' : 'Looking costs no time. Choosing something here does.';
      if (system.id === 'local') text = `${state.food} food portions. ${state.progress.feeds || 0} meals shared.\n${state.flags.feederBuilt ? 'A working feeder beneath the shed.' : state.flags.shelter ? 'Your friend has more room beneath the shed.' : 'Your friend is waiting in the woods.'}`;
      else if (system.id === 'fintech') text = `${state.flags.modelLaunched ? 'A model of your own is helping its first client.' : state.flags.promoted ? 'A system you are responsible for.' : state.flags.employed ? 'A job at the payments company.' : 'An evening course and something to work toward.'}\nCoding ${short(state.skills.coding)}. Finance ${short(state.skills.finance)}.`;
      else text = `${state.flags.relationship ? 'There is a place beside PERSON now.' : state.flags.romance ? 'Something you have both chosen.' : 'PERSON is becoming part of your life.'}\n${state.relationships.town > 2 ? 'There are people in town who know you.' : 'The town is beginning to feel familiar.'}`;
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
  return {
    phase: state.phase, intro: state.phase === 'intro' ? intro : null,
    title: state.phase === 'intro' ? intro?.title : last?.title || 'The first morning',
    text: state.phase === 'intro' ? intro?.text : last?.text || 'You leave the woods with an emptiness that is no longer entirely yours. There is food to find. There is a life to begin.',
    mood, chapter: state.flags.promoted && state.flags.relationship ? 'A larger life' : state.flags.employed ? 'An ordinary life, almost' : state.flags.metPerson ? 'Other people' : 'The first days',
    offers: state.phase === 'playing' ? state.offers.map(id => actionMap.get(id)).filter(Boolean).map(action => offerView(action, state)) : [],
    wait: state.phase === 'playing' ? offerView(WAIT, state) : null,
    systems: systemsView(state), revealedStats: revealedStats(state),
    presentation: state.phase === 'intro' ? 'scene' : state.lastOutcome?.presentation || last?.presentation || 'log',
    milestones: milestones(state), ready: stageReady(state),
    day: Math.floor(state.hours / 24) + 1, hour: Math.floor(state.hours % 24), calendar: gameDate(state.hours),
    crisis: state.crisis ? { ...state.crisis, warning: 'You feel your friend’s pain as your own. Stay and care for him, or ask for help. Repeated abandonment will leave both of you weaker and can kill you both.' } : null,
    ending: state.ending || null,
  };
}

export function choose(state, actionId) {
  if (state.phase === 'intro') {
    if (actionId === 'decline' && (state.introIndex === 0 || state.introIndex === 1)) {
      const text = INTRO[state.introIndex].refusal || (state.introIndex === 0 ? 'you feel yourself immersed in the UNQUIET' : '*i am hungry*');
      return { state, ok: true, changes: [], outcome: { title: '', text, presentation: 'scene' } };
    }
    if (actionId !== 'continue') return { state, ok: false, error: 'Continue the opening first.', changes: [], outcome: null };
    const next = clone(state);
    const scene = INTRO[state.introIndex];
    next.introIndex += 1;
    if (next.introIndex >= INTRO.length) {
      next.phase = 'playing'; next.introIndex = INTRO.length;
      next.journal.push({ turn: 0, hours: 0, title: 'The first morning', text: 'You leave the woods. You are already hungry.\n\nThere is food to find. There is a life to begin.', presentation: 'scene' });
      next.lastOutcome = { title: 'The first morning', text: 'You leave the woods. You are already hungry.\n\nThere is food to find. There is a life to begin.', presentation: 'scene' };
      selectOffers(next);
    }
    return { state: next, ok: true, changes: [], outcome: { title: scene.title, text: scene.text, presentation: 'scene' } };
  }
  if (state.phase !== 'playing') return { state, ok: false, error: 'This chapter has ended.', changes: [], outcome: null };
  const throughSystem = SYSTEMS.some(system => systemActions(state, system.id).some(action => action.id === actionId));
  if (actionId !== WAIT.id && !state.offers.includes(actionId) && !throughSystem) return { state, ok: false, error: 'That decision is not available here yet.', changes: [], outcome: null };
  const action = actionId === WAIT.id ? WAIT : actionMap.get(actionId);
  if (!action) return { state, ok: false, error: 'Unknown decision.', changes: [], outcome: null };
  const error = blockedReason(action, state);
  if (error) return { state, ok: false, error, changes: [], outcome: null };
  const result = resolve(state, action);
  const next = result.state;
  if (mainChoiceBlocked(state)) next.flags.choiceDiscovered = true;
  for (const stat of ['rapture', 'disquiet']) if (result.changes.some(change => change.stat === stat && change.amount !== 0)) next.flags[`${stat}Discovered`] = true;
  updateCrisis(next, actionId);
  if (next.phase === 'failed' && actionId === 'crisis_ignore') result.outcome = { title: 'The same silence.', text: 'They follow the sound. They take your friend from the woods.\n\nYou feel a place inside him close. You try to tell him he is not alone, but there is no longer a difference between the pain in him and the pain in you.\n\nWhen GLIZGLAT goes silent, so do you.\n\nYour fates were joined from the first morning.' };
  else if (actionId === FINISH.id || actionId === 'stage1_complete') { next.phase = 'complete'; next.ending = 'stage-one'; next.offers = []; }
  const newSystems = SYSTEMS.filter(system => !systemUnlocked(system, state) && systemUnlocked(system, next)).map(system => system.id);
  const majorFlags = ['nameRevealed', 'employed', 'promoted', 'feederBuilt', 'romance', 'relationship', 'modelLaunched', 'stage1Complete'];
  const major = majorFlags.some(flag => !state.flags[flag] && next.flags[flag]) || !(state.progress.feeds || 0) && (next.progress.feeds || 0) > 0;
  const crisisOnset = !state.crisis && Boolean(next.crisis);
  const fatalWarning = (state.progress.danger || 0) < 3 && (next.progress.danger || 0) >= 3 && next.phase === 'playing';
  result.outcome = { ...result.outcome, presentation: result.outcome.presentation === 'scene' || major || crisisOnset || fatalWarning || next.phase === 'failed' ? 'scene' : 'log', unlockedSystems: newSystems };
  if (crisisOnset) result.outcome.text += '\n\nThe shared pain is becoming unbearable. Your friend needs care, and you need help. You cannot simply wait it out.';
  if (fatalWarning) result.outcome.text += '\n\nHe is failing. You can feel your body failing with his. Walking away again will kill you both.';
  next.lastOutcome = { ...result.outcome };
  next.journal.push({ turn: next.turn, hours: next.hours, title: result.outcome.title, text: result.outcome.text, presentation: result.outcome.presentation, unlockedSystems: newSystems, actionId, changes: clone(result.changes) });
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
  if (!['intro', 'playing', 'complete', 'failed'].includes(value.phase)) return false;
  if (typeof value.seed !== 'string' || !Number.isInteger(value.rng) || value.rng <= 0 || value.rng > 4294967295) return false;
  if (!Number.isInteger(value.turn) || value.turn < 0 || !Number.isFinite(value.hours) || value.hours < 0) return false;
  if (!Number.isInteger(value.introIndex) || value.introIndex < 0 || value.introIndex > INTRO.length || (value.phase === 'intro' && value.introIndex >= INTRO.length)) return false;
  for (const [group, keys] of [['stats', STAT_KEYS], ['skills', SKILL_KEYS], ['relationships', RELATIONSHIP_KEYS]]) {
    if (!plainObject(value[group]) || !keys.every(key => Number.isFinite(value[group][key]) && value[group][key] >= 0 && (group !== 'stats' || value[group][key] <= 100))) return false;
  }
  if (value.stats.disquiet > 0 && value.stats.rapture >= 100) return false;
  if (!Number.isFinite(value.money) || value.money < 0 || !Number.isFinite(value.food) || value.food < 0) return false;
  if (!plainObject(value.flags) || !Object.values(value.flags).every(flag => typeof flag === 'boolean') || !plainObject(value.progress) || !Object.values(value.progress).every(n => typeof n === 'number' && n >= 0)) return false;
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
    const value = JSON.parse(text);
    return validateSave(value) ? value : null;
  } catch { return null; }
}
