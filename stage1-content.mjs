/*
 * Alignment — Stage 1 implementation fiction.
 * The opening follows the author's latest explicit wording and presentation.
 * New scenes and concrete progression are implementation prose, not amendments
 * to the author's source record. Balance remains an implementation choice.
 */

import { TOWN_ACTIONS, TOWN_EVENTS } from './stage1-town.mjs';
import { ACTION_VIGNETTES } from './stage1-vignettes.mjs';
import { EVENT_PROSE, EXTRA_STORY_EVENTS } from './stage1-event-prose.mjs';

const f = (s, key) => Boolean(s.flags?.[key]);
const p = (s, key) => Number(s.progress?.[key] || 0);
const skill = (s, key) => Number(s.skills?.[key] || 0);
const bond = (s, key) => Number(s.relationships?.[key] || 0);
const scene = (title, text, presentation) => ({ title, text, ...(presentation ? { presentation } : {}) });
// Cycle per activity, so a repeated three-turn routine cannot repeat one passage forever.
const visits = (s, id) => s.progress?.[`visits_${id}`] ?? (s.history || []).filter(entry => entry.id === id).length;
const vary = (s, options, id) => options[visits(s, id) % options.length];
const ordinary = s => !s.crisis;
const available = predicate => s => ordinary(s) && predicate(s);
const ready = s => STAGE1_MILESTONES.every(m => m.test(s));

/** Feeding frequency starts weekly and becomes daily as the friend grows. */
export const careInterval = s => p(s, 'feeds') < 2 ? 7 : p(s, 'feeds') < 4 ? 4 : p(s, 'feeds') < 7 ? 2 : 1;
export const careFoodRequired = s => p(s, 'feeds') < 2 ? 1 : p(s, 'feeds') < 4 ? 2 : p(s, 'feeds') < 7 ? 3 : 4;
export const STAGE1_START = 'you wake up from a long nap. you are getting hungry';

export const INTRO = [
  {
    title: 'too early',
    text: 'you woke up too early\n\nstepping outside you were immersed in the UNQUIET\n\ncan you describe this feeling?\n\ncan emptiness be felt?\n\nyes it can\n\n*my heart is yelling*\n\n**from somewhere in the woods came a small sound**',
    prompt: 'Investigate? (Y/N)',
    refusal: 'can you describe this feeling?',
    returnToLine: 2,
    button: 'Yes'
  },
  {
    title: 'there is no path',
    text: 'you wander into the woods. the sun is rising. there is no path\n\n*i want to hold something, so tightly it hurts*\n\nyou arrive at a hole that wasn’t there before\n\nyou have a feeling there is something in the hole\n\n*i am hungry*\n\nwait, aren’t these your own thoughts?\n\nyou have a half-eaten granola bar',
    prompt: 'Throw it in the hole? (Y/N)',
    refusal: '*I am hungry*',
    button: 'Yes'
  },
  {
    title: 'thank you',
    text: '*thank you*',
    feedingSound: 'SOUND OF FEEDING—LIKE GARBAGE DISPOSAL',
    afterFeeding: '*can I have some more?*',
    titleText: '… A L I G N M E N T …',
    button: 'Continue'
  },
  {
    title: 'something is different',
    text: 'on the way back you feel an ache all over your body\n\nyou are very sick\n\nas you walk you feel as if you are not walking\n\nsomewhere else, your body stiffens\n\nsomewhere else, your body shifts\n\nyou start to feel better\n\nwhen you get home, everything is as it was\n\nunpaid bills on the landing, broken appliances, the eternal odor\n\nbut something is different?\n\na new life is about to begin\n\nyou fall asleep in your outdoor clothes\n\n*can I have some more?*',
    button: 'BEGIN STAGE 1'
  }
];

export const STAGE1_MILESTONES = [
  {
    id: 'care', label: 'Keep up with your friend’s growing appetite',
    test: s => f(s, 'wagon') && f(s, 'surplusDeal') && p(s, 'feeds') >= 8,
    detail: s => !f(s, 'wagon') ? 'Save $48 for a wagon before a meal grows too heavy to carry.'
      : !f(s, 'surplusDeal') ? 'Get to know the market and arrange regular food collections.'
      : `${Math.min(8, p(s, 'feeds'))}/8 meals delivered · ${careFoodRequired(s)} bags per meal · feeding every ${careInterval(s)} ${careInterval(s) === 1 ? 'day' : 'days'}`
  },
  {
    id: 'career', label: 'Build an automated trader and earn more',
    test: s => f(s, 'budgetSorted') && f(s, 'traderBuilt') && f(s, 'traderTested') && f(s, 'modelLaunched'),
    detail: s => !f(s, 'budgetSorted') ? 'Sort out the bills and make a budget for yourself and your friend.'
      : skill(s, 'coding') < 6 || skill(s, 'math') < 5 || skill(s, 'finance') < 5 ? 'Develop Coding 6, Math 5, and Markets 5 before building your trader.'
      : !f(s, 'traderBuilt') ? `${p(s, 'model')}/3 sessions building the automated trader`
      : !f(s, 'traderTested') ? 'Run the trader against unseen data and practice orders.'
      : !f(s, 'modelLaunched') ? 'Save $100 of ordinary money to start your automated trader.'
      : 'The bills are organized. Your trader is running.'
  },
  {
    id: 'community', label: 'Make friends and find someone you can rely on',
    test: s => bond(s, 'town') >= 5 && ['Jim', 'Ethan', 'Wendy'].some(name => f(s, `recruited${name}`)),
    detail: s => !['Jim', 'Ethan', 'Wendy'].some(name => f(s, `recruited${name}`)) ? 'Get to know GRINGO JIM, ETHAN, or WENDY. Earn enough trust to ask for help.'
      : `Town connection ${Math.min(5, bond(s, 'town'))}/5 · Someone has agreed to help`
  },
  {
    id: 'learning', label: 'Follow the strange way the world is opening',
    test: s => skill(s, 'coding') >= 6 && skill(s, 'math') >= 5 && skill(s, 'finance') >= 5 && skill(s, 'social') >= 3 && skill(s, 'practical') >= 3 && f(s, 'awakening'),
    detail: s => !f(s, 'awakening') ? 'Keep feeding your friend, learning, and noticing what is changing. Follow the feeling when it comes.'
      : `Coding ${Math.min(6, skill(s, 'coding')).toFixed(1)}/6 · Math ${Math.min(5, skill(s, 'math')).toFixed(1)}/5 · Markets ${Math.min(5, skill(s, 'finance')).toFixed(1)}/5 · Social ${Math.min(3, skill(s, 'social')).toFixed(1)}/3 · Practical ${Math.min(3, skill(s, 'practical')).toFixed(1)}/3`
  },
  {
    id: 'relationship', label: 'Build a real connection with PERSON',
    test: s => f(s, 'metPerson') && f(s, 'cafe') && f(s, 'walk') && f(s, 'confided') && f(s, 'honestWithPerson') && f(s, 'personConfrontationResolved') && bond(s, 'person') >= 11 && p(s, 'lies') === 0,
    detail: s => !f(s, 'metPerson') ? 'Go into town. Say hello to PERSON.'
      : p(s, 'lies') > 0 ? 'Correct the lie between you before asking for more trust.'
      : !f(s, 'cafe') ? 'Talk a little, then invite PERSON for coffee.'
      : !f(s, 'walk') ? 'Make time for a walk together.'
      : !f(s, 'confided') ? 'Tell PERSON something true about how you have been.'
      : !f(s, 'honestWithPerson') ? 'Be honest about your absences and what you cannot yet explain.'
      : bond(s, 'person') < 11 ? 'Spend time together. Trust grows through ordinary evenings.'
      : 'You are close. Finish the other commitments before asking to be together.'
  }
];

export const ACTIONS = [
    {
    id: 'buy_food', system: 'local', label: 'Buy groceries', category: 'care', subcategory: 'supplies', duration: 1,
    description: 'Three bags of food. The shop is still open.', requirement: 6,
    when: available(s => s.money >= 18), weight: s => s.food < 2 ? 12 : 2,
    desire: s => s.stats.hunger > 48 && s.food < 2 ? 0.82 : 0.32,
    effects: () => ({ money: -18, food: 3 }),
    outcome: s => scene("The grocery store", vary(s, ["Beneath the fluorescent lights, everything looks edible. You buy three bags of food.", "The cashier asks whether you are having people over. You say something like that.", "You compare the prices, then the weights. For a moment you can smell the food through its packaging."], "buy_food"))
  },
  {
    id: 'feed_friend', system: 'local', label: 'Feed your friend', category: 'care', subcategory: 'feeding', duration: 3,
    description: s => `Bring ${careFoodRequired(s)} ${careFoodRequired(s) === 1 ? 'bag' : 'bags'} to the woods. ${careFoodRequired(s) > 2 ? 'You need the wagon for this much food.' : 'You can still carry this yourself.'}`, requirement: 4,
    when: available(s => s.food >= careFoodRequired(s) && (careFoodRequired(s) <= 2 || f(s, 'wagon')) && s.hours >= (s.care?.nextFeedAt ?? 168) - 12),
    weight: 28, desire: 0.96, neglect: 1.8,
    effects: s => ({ food: -careFoodRequired(s), hunger: -8, rapture: 9, relationships: { friend: 1 }, progress: { feeds: 1 } }),
    outcome: s => scene('Your friend', p(s, 'feeds') === 0 ? 'A week ago, half a granola bar was enough.\n\nYou lower the bag into the dark.\n\n**the feeding begins**\n\n*thank you*\n\nYou feel a relief that has nothing to do with your own stomach.' : vary(s, ['You wait for your hands to clear the opening. The bag disappears.\n\n*can I have some more?*', 'The meal is larger. The silence after it is shorter. You count the days since the last visit.', 'The wagon wheels leave tracks in the mud. Something beneath the ground follows their rhythm.'], 'feed_friend'), p(s, 'feeds') === 0 ? 'scene' : undefined)
  },
    {
    id: 'ask_friend', system: 'local', label: 'Ask your friend a question', category: 'care', subcategory: 'understanding', duration: 1,
    description: 'There are things you would like to know.', requirement: 24,
    when: available(s => p(s, 'feeds') >= 1), weight: 4, desire: 0.45,
    effects: () => ({ disquiet: 2, relationships: { friend: 1 }, progress: { questions: 1 } }),
    outcome: s => scene("A question", vary(s, ["“Where did you come from?” *I don’t know.* You receive an impression of distance without direction.", "“What are you?” *I don’t know.* Then the question comes back to you.", "“Does it hurt?” He cannot answer, but an ache fills your jaw. You move the stone pressing against him; the ache stops."], "ask_friend"))
  },
    {
    id: 'sit_friend', system: 'local', label: 'Stay a little longer', category: 'care', subcategory: 'company', duration: 2,
    description: 'You do not have to bring something every time.', requirement: 16,
    when: available(s => p(s, 'feeds') >= 2 && s.stats.hunger < 65), weight: 3, desire: 0.61,
    effects: () => ({ rapture: 5, relationships: { friend: 1 } }),
    outcome: s => scene("Company", vary(s, ["You tell him about the unpaid bills. He listens with the same attention he gives to the birds.", "A bird lands beside you. For a moment you see it without knowing what a bird is.", "You think about leaving and feel a small hurt. You stay another hour."], "sit_friend"))
  },
    {
    id: 'search_surplus', system: 'local', label: 'Ask for surplus food', category: 'town', subcategory: 'asking', duration: 3,
    description: 'The market throws away things that are still good. Asking is harder than looking.', requirement: 25,
    when: available(() => true), weight: s => s.money < 18 || s.food < 1 ? 12 : 2, desire: s => s.stats.hunger > 55 ? 0.8 : 0.34,
    effects: () => ({ food: 2, disquiet: 3, skills: { social: 0.5 }, relationships: { town: 1 } }),
    outcome: s => scene("At the back door", vary(s, ["You have to ask twice before the market worker can hear you. She brings out the bread they were going to throw away.", "Bruised fruit and a split sack of oats. Nobody asks who they are for.", "The worker remembers you. You help her carry the empty crates inside before taking the food."], "search_surplus"))
  },
    {
    id: 'arrange_surplus', system: 'local', label: 'Arrange a regular collection', category: 'care', subcategory: 'logistics', duration: 3,
    description: 'A deposit and a promise to collect on time. Food that can be counted on.', requirement: 32,
    when: available(s => !f(s, 'surplusDeal') && bond(s, 'town') >= 2 && skill(s, 'practical') >= 1 && s.money >= 35), weight: 7, desire: 0.67,
    effects: () => ({ money: -35, disquiet: 3, skills: { practical: 0.5 }, flags: { surplusDeal: true } }),
    outcome: s => scene("An arrangement", "You pay the deposit and agree to return the crates. The manager writes your name on the collection list. You can start buying surplus food in bulk.")
  },
    {
    id: 'collect_surplus', system: 'local', label: 'Collect the food crates', category: 'care', subcategory: 'supplies', duration: 2,
    description: 'Six bags’ worth, packed together. Your arrangement is paying off.', requirement: 8,
    when: available(s => f(s, 'surplusDeal') && f(s, 'wagon') && s.money >= 18), weight: s => s.food < 3 ? 13 : 2, desire: s => s.food < 2 && s.stats.hunger > 45 ? 0.9 : 0.42,
    effects: () => ({ money: -18, food: 6 }),
    outcome: s => scene("The collection", vary(s, ["Your name is already on the crate. You return the empties and take the food.", "“You’re reliable,” the manager says. You have arrived when you said you would.", "You know the weight of the crate before lifting it. You check the label anyway."], "collect_surplus"))
  },
    {
    id: 'buy_cooler', system: 'local', label: 'Buy a secondhand cooler', category: 'care', subcategory: 'storage', duration: 2,
    description: 'Keep the food fresh between visits. It costs $65.', requirement: 22,
    when: available(s => !f(s, 'cooler') && skill(s, 'practical') >= 1 && s.money >= 65 && p(s, 'feeds') >= 3), weight: 7, desire: 0.61,
    effects: () => ({ money: -65, flags: { cooler: true } }),
    outcome: s => scene("Cold storage", "The cooler smells faintly of the sea. You scrub it and replace the seal. The next delivery will stay fresh.")
  },
    {
    id: 'repair_shelter', system: 'local', label: 'Prepare the old shed', category: 'care', subcategory: 'construction', duration: 4,
    description: 'The disused allotment shed has room below its floor. Repair the roof and clear a way in. $55.', requirement: 38,
    when: available(s => !f(s, 'shelter') && skill(s, 'practical') >= 2 && bond(s, 'friend') >= 4 && s.money >= 55), weight: 7, desire: 0.68,
    effects: () => ({ money: -55, disquiet: 4, skills: { practical: 1 }, flags: { shelter: true } }),
    outcome: s => scene("More room", "You lift the rotten floorboards and patch the roof. Your friend unfolds into the space beneath the shed. He is larger than you had let yourself notice.")
  },
    {
    id: 'build_feeder', system: 'local', label: 'Build a feeding apparatus', category: 'care', subcategory: 'invention', duration: 5,
    description: 'A chute, a covered reservoir, a dependable release. Use the cooler and shed. $90.', requirement: 44,
    when: available(s => !f(s, 'feederBuilt') && f(s, 'cooler') && f(s, 'shelter') && f(s, 'surplusDeal') && skill(s, 'practical') >= 3 && s.money >= 90), weight: 10, desire: 0.74,
    effects: () => ({ money: -90, disquiet: 4, skills: { practical: 1 }, flags: { feederBuilt: true } }),
    outcome: s => scene("The release", "The first release jams.\n\nYou take it apart and file the edge.\n\nYour friend stays still while you work.\n\nThe second release opens cleanly.\n\nFood falls.\n\nYou can feel him trying to understand the machine that has learned to feed him.", "scene")
  },
  {
    id: 'stock_feeder', system: 'local', label: 'Stock and run the feeder', category: 'care', subcategory: 'feeding', duration: 2,
    description: s => `Load ${careFoodRequired(s)} bags into the apparatus. The machine saves carrying time; it cannot make the appetite stop.`, requirement: 8,
    when: available(s => f(s, 'feederBuilt') && f(s, 'wagon') && s.food >= careFoodRequired(s) && s.hours >= (s.care?.nextFeedAt ?? 168) - 12), weight: 30, desire: 0.96, neglect: 1.8,
    effects: s => ({ food: -careFoodRequired(s), hunger: -8, rapture: 9, relationships: { friend: 1 }, progress: { feeds: 1, stocked: 1 }, flags: { feederStocked: true } }),
    outcome: s => scene('The apparatus', vary(s, ['The release opens. You clean the chute before going home. Already you are thinking about tomorrow.', 'You sit beside the machine and listen to its work.\n\n*can I have some more?*', 'There is less clearance beneath the shed. You note the measurements. Your friend has grown again.'], 'stock_feeder'))
  },
    {
    id: 'learn_name', system: 'local', label: 'Listen for his name', category: 'care', subcategory: 'recognition', duration: 2,
    description: 'There is something your friend has been trying to say.', requirement: 36,
    when: available(s => !f(s, 'nameRevealed') && p(s, 'feeds') >= 6 && bond(s, 'friend') >= 7), weight: 12, desire: 0.82,
    effects: () => ({ disquiet: 4, rapture: 8, relationships: { friend: 2 }, flags: { nameRevealed: true } }),
    outcome: s => scene('GLIZGLAT', "A sound arrives with no voice behind it.\n\n*GLIZGLAT*\n\n“Is that your name?”\n\n*I think so*\n\nFor a moment you are somewhere without light or distance.\n\nYou know that he has been there.\n\n" + (f(s, 'shelter') ? 'Then you are beside the shed again.' : 'Then you are at the edge of the hole again.') + "\n\n“Gliz,” you say.\n\nHe turns toward you.", 'scene')
  },
  {
    id: 'temporary_shift', system: 'fintech', label: 'Work your grocery store shift', category: 'work', subcategory: 'grocery', duration: 8,
    description: 'Stock shelves, run the till, and clean before closing. Your eight-hour shift pays $52.', requirement: 10,
    when: available(() => true), weight: s => s.money < 60 ? 16 : 6, desire: s => s.money < 18 ? 0.78 : 0.4,
    effects: () => ({ money: 52, rapture: -2, disquiet: 1, skills: { practical: 0.2 }, progress: { shifts: 1 } }),
    outcome: s => scene('The grocery store', vary(s, ['You face the tins, mop a spill, and count the till. Everyone seems to be buying too little food.', 'A customer asks where the rice is. Before they finish, you know which brand they mean. You point at the shelf and try to forget it.', 'At closing you take off the apron. Eight hours have passed. The money is ordinary money, and you need it.'], 'temporary_shift'))
  },
    {
    id: 'learn_code', system: 'fintech', label: 'Practice coding', category: 'learning', subcategory: 'coding', duration: 4,
    description: 'One lesson, one small program. Let it be difficult.', requirement: 26,
    when: available(s => skill(s, 'coding') < 8), weight: s => skill(s, 'coding') < 4 ? 7 : 2, desire: 0.46,
    effects: () => ({ rapture: -2, disquiet: 1, skills: { coding: 1 } }),
    outcome: s => scene("A small program", vary(s, ["The error is on line eleven. When you fix it, the program runs for the first time.", "You write a script to count the food going out and the money coming in. Then you fix what happens when either reaches zero.", "Three solutions occur to you at once. You test the one you understand before attempting the others."], "learn_code"))
  },
  {
    id: 'study_finance', system: 'fintech', label: 'Study markets', category: 'learning', subcategory: 'finance', duration: 4,
    description: 'Prices, probabilities, transaction costs. Learn what a chart does and does not tell you.', requirement: 22,
    when: available(s => skill(s, 'finance') < 10), weight: s => skill(s, 'finance') < 5 ? 9 : 2, desire: 0.52,
    effects: () => ({ rapture: -2, disquiet: 1, skills: { finance: 1 } }),
    outcome: s => scene('The movement of money', vary(s, ['You follow an order from a buyer to a seller. The price changes while you are reading. You know the next number before it appears, and get it wrong when you try again.', 'You calculate how much a small fee removes after a thousand trades. You redo your beautiful result. It is smaller, and real.', 'The market is thousands of people making decisions. For an instant you can feel all of them wanting. You close the textbook.'], 'study_finance'))
  },
    {
    id: 'enroll_course', system: 'fintech', label: 'Enroll in the fintech course', category: 'work', subcategory: 'commitment', duration: 2,
    description: 'A subsidized evening course. A real deadline. The fee is $45.', requirement: 37,
    when: available(s => !f(s, 'course') && skill(s, 'coding') >= 1 && skill(s, 'finance') >= 1 && s.money >= 45), weight: 10, desire: 0.7,
    effects: () => ({ money: -45, disquiet: 4, flags: { course: true } }),
    outcome: s => scene("Your name on the list", "You finish the application instead of closing it. The course fee leaves your account. The first assignment arrives immediately.")
  },
    {
    id: 'course_lesson', system: 'fintech', label: 'Attend the evening course', category: 'learning', subcategory: 'classroom', duration: 3,
    description: 'Work through the next module with people who are learning too.', requirement: 31,
    when: available(s => f(s, 'course') && p(s, 'lessons') < 3), weight: 10, desire: 0.58,
    effects: () => ({ disquiet: 3, skills: { coding: 0.5, finance: 0.5 }, progress: { lessons: 1 } }),
    outcome: s => scene("The evening course", ["You introduce yourself to the class. Later, you help the person beside you find a missing bracket.", "The tutor changes the test data and your model fails. You spend the rest of class finding the assumption that broke it.", "You finish the reconciliation assignment and write down its limits. The tutor asks whether you have thought about making a portfolio."][Math.min(2, p(s, 'lessons'))])
  },
    {
    id: 'portfolio_project', system: 'fintech', label: 'Build your portfolio project', category: 'work', subcategory: 'craft', duration: 4,
    description: 'Make a useful tool, then make it dependable. Three focused sessions.', requirement: 38,
    when: available(s => p(s, 'lessons') >= 3 && p(s, 'portfolio') < 3), weight: 11, desire: 0.61,
    effects: () => ({ disquiet: 3, skills: { coding: 0.5 }, progress: { portfolio: 1 } }),
    outcome: s => scene("Your portfolio", ["Your tool finds mismatched payments. It also flags correct ones; you start a list of cases to fix.", "You test duplicate entries, missing dates, and payments that almost agree. The list of failures gets shorter.", "You publish the project with examples and clear limits. You check the link from another browser: it is really there."][Math.min(2, p(s, 'portfolio'))])
  },
    {
    id: 'portfolio_review', system: 'fintech', label: 'Ask for a portfolio review', category: 'work', subcategory: 'feedback', duration: 2,
    description: 'Send your work to the course tutor. Let someone find its weaknesses.', requirement: 44,
    when: available(s => p(s, 'portfolio') >= 3 && !f(s, 'portfolioReviewed')), weight: 12, desire: 0.64,
    effects: () => ({ disquiet: 4, skills: { social: 1, coding: 0.5 }, flags: { portfolioReviewed: true } }),
    outcome: s => scene("The review", "The tutor finds two problems and one thing she likes. You fix the problems. She sends you a listing for a junior role at a payments company.")
  },
    {
    id: 'job_interview', system: 'fintech', label: 'Go to the interview', category: 'work', subcategory: 'exposure', duration: 3,
    description: 'A junior fintech role. Bring the project you can explain.', requirement: 48,
    when: available(s => f(s, 'portfolioReviewed') && !f(s, 'employed') && skill(s, 'coding') >= 3 && skill(s, 'finance') >= 2), weight: 14, desire: 0.77,
    effects: () => ({ disquiet: 5, rapture: 5, skills: { social: 1 }, flags: { employed: true } }),
    outcome: s => scene("The call", "They ask why you made the tool.\n\nYou explain what it does.\n\nThey ask again.\n\n“Because I wanted to make something useful.”\n\nLater, your phone rings.\n\nThe salary would cover the rent and the food.\n\nYou say yes.\n\nAfter the call, you write the number down.", "scene")
  },
    {
    id: 'salaried_work', system: 'fintech', label: 'Work at the payments company', category: 'work', subcategory: 'employment', duration: 4,
    description: 'Investigate errors, improve a system, earn your pay.', requirement: 21,
    when: available(s => f(s, 'employed')), weight: s => s.money < 80 ? 12 : 6, desire: 0.46,
    effects: s => ({ money: f(s, 'promoted') ? 92 : 58, disquiet: 1, skills: { coding: 0.2, finance: 0.2 }, progress: { work: 1 } }),
    outcome: s => scene("At work", vary(s, ["A shop’s payments stopped reconciling. You find the error and fix it. The owner can pay her staff.", "Someone asks for your opinion in a meeting. You answer before remembering to be nervous.", "You see the fault before you can explain it. Writing the steps down takes the rest of the afternoon."], "salaried_work"))
  },
    {
    id: 'report_mistake', system: 'fintech', label: 'Report your mistake', category: 'work', subcategory: 'accountability', duration: 2,
    description: 'A report you shipped contains an error. Owning it will be uncomfortable.', requirement: 42,
    when: available(s => f(s, 'employed') && p(s, 'work') >= 1 && !f(s, 'mistakeResolved')), weight: 8, desire: 0.55,
    effects: () => ({ disquiet: 5, skills: { finance: 0.5 }, flags: { mistakeResolved: true, honestAtWork: true } }),
    outcome: s => scene("The corrected report", "You tell your manager about the error. She asks you to show her, and you spend the afternoon fixing it together.")
  },
    {
    id: 'conceal_mistake', system: 'fintech', label: 'Quietly replace the report', category: 'work', subcategory: 'concealment', duration: 1,
    description: 'Remove the evidence and let a colleague take the questions.', requirement: 0, ethics: 9,
    when: available(s => f(s, 'employed') && p(s, 'work') >= 1 && !f(s, 'mistakeResolved')), weight: 5, desire: 0.73,
    effects: () => ({ disquiet: 6, rapture: -3, flags: { mistakeResolved: true, concealedMistake: true } }),
    outcome: s => scene("A clean copy", "You replace the report without telling anyone. The questions go to your colleague. You let them.")
  },
    {
    id: 'correct_work_lie', system: 'fintech', label: 'Tell your manager what happened', category: 'work', subcategory: 'restitution', duration: 2,
    description: 'The colleague you left answering for your error deserves the truth.', requirement: 15, challenge: 5,
    when: available(s => f(s, 'concealedMistake')), weight: 10, desire: 0.56,
    effects: () => ({ disquiet: 6, rapture: -1, skills: { social: 0.5 }, flags: { concealedMistake: false, honestAtWork: true } }),
    outcome: s => scene("The record", "You tell your manager whose error it was. Then you apologize to your colleague. They ask you to correct the record in writing.")
  },
    {
    id: 'promotion', system: 'fintech', label: 'Take responsibility for a system', category: 'work', subcategory: 'responsibility', duration: 3,
    description: 'Your manager offers you a larger role, with better pay and real obligations.', requirement: 49,
    when: available(s => f(s, 'employed') && !f(s, 'promoted') && p(s, 'work') >= 3 && skill(s, 'coding') >= 4 && skill(s, 'finance') >= 3), weight: 14, desire: 0.77,
    effects: () => ({ disquiet: 4, rapture: 5, money: 65, flags: { promoted: true } }),
    outcome: s => scene("Responsibility", "You explain a failure before it happens.\n\nYour manager asks you to take responsibility for the system.\n\nThe raise will pay for larger food deliveries.\n\nThe mistakes will be yours to answer for.\n\nYou accept.", "scene")
  },
  {
    id: 'build_model', system: 'fintech', label: 'Build your automated trader', category: 'learning', subcategory: 'trader', duration: 6,
    description: 'Turn coding, mathematics, and market study into a program that can place its own orders. Three focused sessions.', requirement: 43,
    when: available(s => f(s, 'budgetSorted') && skill(s, 'coding') >= 6 && skill(s, 'math') >= 5 && skill(s, 'finance') >= 5 && p(s, 'model') < 3), weight: 14, desire: 0.84,
    effects: s => ({ rapture: -3, disquiet: 2, skills: { coding: 0.5, math: 0.25, finance: 0.25 }, progress: { model: 1 }, flags: p(s, 'model') >= 2 ? { traderBuilt: true } : {} }),
    outcome: s => scene('The automated trader', ['You write the data reader and order simulator. The patterns feel visible before the screen has drawn them. You make yourself prove the numbers.', 'You build position limits and a stop switch. For a moment you resent needing either. The feeling frightens you enough to test both.', 'You connect the parts. A quote arrives; the program decides; an order appears in the simulator. You take your hands off the keyboard. It keeps working.'][Math.min(2, p(s, 'model'))])
  },
  {
    id: 'launch_model', system: 'fintech', label: 'Start your automated trader', category: 'work', subcategory: 'trader', duration: 3,
    description: 'Put $100 into the account and start the trader you built and tested.', requirement: 45,
    when: available(s => f(s, 'traderBuilt') && f(s, 'traderTested') && !f(s, 'modelLaunched') && s.money >= 100), weight: 18, desire: 0.85,
    effects: () => ({ money: -100, disquiet: 3, rapture: 15, progress: { tradingCapital: 100 }, flags: { modelLaunched: true } }),
    outcome: () => scene('While you are elsewhere', 'You start the program.\n\nFor a long time, nothing.\n\nThen an order fills. Another closes it. A small amount of money is yours.\n\nYou leave the computer running and take the wagon into the woods.\n\nAt home, it is still working.\n\nYou feel an absurd, terrible certainty that you could make the whole world do this.', 'scene')
  },
    {
    id: 'go_town', system: 'social', label: 'Go into town', category: 'town', subcategory: 'presence', duration: 2,
    description: 'Be somewhere other people are. You do not need a reason.', requirement: 23,
    when: available(() => true), weight: s => !f(s, 'metPerson') ? 8 : 4, desire: 0.52,
    effects: () => ({ rapture: 4, relationships: { town: 1 }, progress: { townVisits: 1 } }),
    outcome: s => scene("Town", vary(s, ["A child is trying to persuade a pigeon to become a pet. The pigeon takes the crumbs and leaves.", "You hold the florist’s door while she carries the buckets inside. She remembers your face the next time you pass.", "The librarian finds a pressed leaf in a returned book and shows it to you. You both try to identify it.", "At the crossing, a stranger warns you about the loose paving stone. You step around it together."], "go_town"))
  },
    {
    id: 'meet_person', system: 'social', label: 'Say hello to PERSON', category: 'relationship', subcategory: 'introduction', duration: 2,
    description: 'You have seen her outside the library before. This time she looks up.', requirement: 42,
    when: available(s => !f(s, 'metPerson') && bond(s, 'town') >= 1), weight: 14, desire: 0.78,
    effects: () => ({ disquiet: -4, rapture: 35, skills: { social: 1 }, relationships: { person: 1 }, flags: { metPerson: true } }),
    outcome: s => scene("PERSON", "a book held open.\n\n“PERSON,” she says.\n\nshe hopes to see you again.\n\n… the entire walk home. lit from inside.")
  },
    {
    id: 'talk_person', system: 'social', label: 'Talk with PERSON', category: 'relationship', subcategory: 'conversation', duration: 2,
    description: 'Ask a question. Stay for the answer.', requirement: 32,
    when: available(s => f(s, 'metPerson')), weight: s => !f(s, 'cafe') ? 10 : 4, desire: s => Math.min(0.86, 0.59 + bond(s, 'person') / 80),
    effects: () => ({ rapture: 5, skills: { social: 0.5 }, relationships: { person: 1 }, progress: { conversations: 1 } }),
    outcome: s => scene("A conversation", vary(s, ["PERSON tells you the town clock has been four minutes slow for years. She keeps meaning to write to someone about it.", "You disagree about the book. PERSON makes you explain which part annoyed you; by the end, she has nearly changed your mind.", "PERSON asks about your day. You give the short answer, then tell her what actually happened.", "She remembers something you mentioned last time and asks how it turned out. You had not expected her to keep it."], "talk_person"))
  },
    {
    id: 'cafe_person', system: 'social', label: 'Ask PERSON for coffee', category: 'relationship', subcategory: 'invitation', duration: 2,
    description: 'A small invitation. Coffee for two costs $10.', requirement: 43,
    when: available(s => f(s, 'metPerson') && !f(s, 'cafe') && p(s, 'conversations') >= 2 && bond(s, 'person') >= 3 && s.money >= 10), weight: 13, desire: 0.82,
    effects: () => ({ money: -10, disquiet: 3, rapture: 7, relationships: { person: 2 }, flags: { cafe: true } }),
    outcome: s => scene("Two cups", "PERSON says yes before you finish making the invitation sound casual. She folds a receipt beneath the café’s wobbling table. You stay after both cups are empty.")
  },
    {
    id: 'walk_person', system: 'social', label: 'Walk with PERSON', category: 'relationship', subcategory: 'closeness', duration: 3,
    description: 'Take the long way through town, then along the edge of the woods.', requirement: 39,
    when: available(s => f(s, 'cafe') && !f(s, 'walk')), weight: 13, desire: 0.83,
    effects: () => ({ disquiet: 2, rapture: 7, relationships: { person: 2 }, flags: { walk: true } }),
    outcome: s => scene("The long way", "PERSON touches your sleeve to point out a deer. You feel the touch somewhere else as well, and stop walking. She waits until you are ready to continue.")
  },
    {
    id: 'confide_person', system: 'social', label: 'Tell PERSON how you have been', category: 'relationship', subcategory: 'vulnerability', duration: 3,
    description: 'The room. The isolation. The mornings when beginning is difficult.', requirement: 51,
    when: available(s => f(s, 'walk') && !f(s, 'confided')), weight: 14, desire: 0.79,
    effects: () => ({ disquiet: 6, rapture: 8, relationships: { person: 2 }, flags: { confided: true } }),
    outcome: s => scene("Telling someone", "You tell PERSON about the room.\n\nThe unopened bills.\n\nWaking early and being unable to begin.\n\nYou try to make it sound like something you have already overcome.\n\nThen you stop doing that.\n\nPERSON stays beside you.\n\n“Thank you for telling me.”", "scene")
  },
    {
    id: 'honest_limit', system: 'social', label: 'Be honest about what you cannot explain', category: 'relationship', subcategory: 'boundaries', duration: 2,
    description: 'PERSON has noticed your absences. Tell the truth you can tell, and admit its limits.', requirement: 48,
    when: available(s => f(s, 'confided') && f(s, 'personConfrontationResolved') && p(s, 'lies') === 0 && !f(s, 'honestWithPerson') && bond(s, 'person') >= 7), weight: 14, desire: 0.78,
    effects: () => ({ disquiet: 5, rapture: 5, relationships: { person: 2 }, flags: { honestWithPerson: true } }),
    outcome: s => scene("What you can promise", "You tell PERSON that someone depends on you, and you cannot explain it yet. She asks you to say when you are leaving instead of disappearing. You agree.")
  },
    {
    id: 'time_person', system: 'social', label: 'Spend the evening with PERSON', category: 'relationship', subcategory: 'presence', duration: 3,
    description: 'An ordinary evening is still something you have to choose.', requirement: 31,
    when: available(s => f(s, 'cafe')), weight: 6, desire: s => f(s, 'relationship') ? 0.87 : 0.74, neglect: 1.6,
    effects: () => ({ rapture: 7, relationships: { person: 1 } }),
    outcome: s => scene("An evening", vary(s, ["PERSON washes the dishes while you dry. You tell her about the difficult part of your day.", "Neither of you likes the film. Complaining about it becomes the evening.", "PERSON has had a bad day. You ask whether she wants advice; she does not. You listen.", "The telephone rings. You let the answering machine take it while PERSON makes another pot of coffee."], "time_person"))
  },
    {
    id: 'lie_person', system: 'social', label: 'Tell PERSON you were working', category: 'relationship', subcategory: 'deception', duration: 1,
    description: 'An easy explanation for an absence. Let them believe it.', requirement: 0, ethics: 8,
    when: available(s => f(s, 'metPerson') && p(s, 'lies') < 3), weight: s => s.stats.choice < 35 ? 10 : 3, desire: 0.75,
    effects: () => ({ disquiet: 5, rapture: -3, relationships: { person: -1 }, progress: { lies: 1 } }),
    outcome: s => scene("An easy answer", vary(s, ["“Work ran late.” PERSON believes you and asks whether you have eaten.", "You invent a problem at work. PERSON tells you not to let them take advantage of you.", "The explanation is ready before she asks. It is easier to say this time."], "lie_person"))
  },
    {
    id: 'repair_trust', system: 'social', label: 'Correct the lie', category: 'relationship', subcategory: 'repair', duration: 2,
    description: 'Tell PERSON you were not at work. Apologize without asking her to make it easy.', requirement: 18,
    when: available(s => f(s, 'metPerson') && p(s, 'lies') > 0), weight: 14, desire: 0.66, challenge: 5,
    effects: () => ({ disquiet: 6, rapture: -1, relationships: { person: 1 }, progress: { lies: -1 } }),
    outcome: s => scene("The correction", "You tell PERSON you were not at work. She asks why you lied; you answer without making it her fault. She will need time.")
  },
    {
    id: 'volunteer', system: 'social', label: 'Help at the community kitchen', category: 'town', subcategory: 'service', duration: 3,
    description: 'Other people are hungry too. Take a shift preparing food.', requirement: 30,
    when: available(s => bond(s, 'town') >= 1), weight: 5, desire: 0.56,
    effects: () => ({ disquiet: 3, rapture: 5, skills: { social: 0.5, practical: 0.5 }, relationships: { town: 2 } }),
    outcome: s => scene("The kitchen", vary(s, ["Someone shows you where the knives live. You prepare vegetables until the first guests arrive.", "You peel potatoes beside a man telling a long story about his dog. By the end, lunch is ready.", "You serve someone you have passed in the street for years. Now you know their name."], "volunteer"))
  },
    {
    id: 'accept_help', system: 'social', label: 'Let someone help you', category: 'self', subcategory: 'dependence', duration: 2,
    description: 'You have been offered a meal and some company. Accepting feels strangely difficult.', requirement: 12,
    when: available(s => bond(s, 'town') >= 3 || bond(s, 'person') >= 3), weight: s => s.stats.disquiet > 55 || s.stats.choice < 30 ? 12 : 3, desire: 0.64, challenge: 5,
    effects: () => ({ disquiet: 3, hunger: -15, rapture: 8, relationships: { town: 1 } }),
    outcome: s => scene('A meal you did not make', vary(s, f(s, 'metPerson') ? ["PERSON puts a plate in front of you. You start explaining why you have not looked after yourself. “Eat first,” she says.", "PERSON brings extra portions and puts them in your fridge. You eat one without promising to repay her immediately.", "You call PERSON instead of waiting for her to notice. She asks what would help, and you ask her to bring dinner.", "You let PERSON take a turn cooking. When she tells you to sit down, you do."] : ["The woman from the kitchen pulls out a chair for you. You sit down and eat with the others.", "A volunteer sets aside a portion for you. You accept it before beginning to explain why you should not.", "You come to the kitchen for a meal instead of a shift. Nobody asks you to work first."], 'accept_help'))
  },
    {
    id: 'learn_practical', system: 'local', label: 'Learn to fix something', category: 'learning', subcategory: 'practical', duration: 3,
    description: 'Borrow tools from the library. Work on a hinge, a seal, a small machine.', requirement: 24,
    when: available(s => skill(s, 'practical') < 7), weight: s => skill(s, 'practical') < 3 ? 8 : 2, desire: 0.42,
    effects: () => ({ disquiet: -2, rapture: -2, skills: { practical: 1 } }),
    outcome: s => scene("With your hands", vary(s, ["You take the hinge apart and briefly make it worse. After a few hours, the door closes properly.", "You borrow a toolkit from the library. The new seal leaks on your first attempt; the second holds.", "You cut the piece badly and file the edge until it fits. Knowing the shape does not teach your hands to make it."], "learn_practical"))
  },
    {
    id: 'practice_social', system: 'social', label: 'Practice being heard', category: 'learning', subcategory: 'social', duration: 2,
    description: 'Go to a small discussion at the library. Say one thing aloud.', requirement: 29,
    when: available(s => skill(s, 'social') < 7), weight: s => skill(s, 'social') < 3 ? 6 : 2, desire: 0.38,
    effects: () => ({ disquiet: 4, skills: { social: 1 }, relationships: { town: 1 } }),
    outcome: s => scene("Your turn", vary(s, ["You stop rehearsing your reply and listen. When your turn comes, you ask a question.", "Your voice shakes. Someone across the table answers your point, and the discussion continues.", "Halfway through disagreeing, you notice something you missed. You say so."], "practice_social"))
  },
    {
    id: 'library', system: 'fintech', label: 'Spend an hour at the library', category: 'self', subcategory: 'curiosity', duration: 2,
    description: 'Read something nobody requires you to read.', requirement: 13,
    when: available(() => true), weight: 3, desire: 0.45,
    effects: () => ({ rapture: 4, skills: { coding: 0.25, finance: 0.25 } }),
    outcome: s => scene("A borrowed book", vary(s, ["You find a diagram made by someone long dead. One handwritten correction makes the whole thing understandable.", "You read until the librarian switches off half the lights. You borrow the book instead of rushing the last chapter.", "Someone has left a pencil mark beside a sentence you like. You wonder who they were."], "library"))
  },
    {
    id: 'make_budget', system: 'fintech', label: 'Look honestly at the budget', category: 'self', subcategory: 'accounting', duration: 2,
    description: 'Open the bills. Cancel one expense. Write down the cost of keeping going.', requirement: 22,
    when: available(() => true), weight: s => s.money < 30 ? 5 : 2, desire: 0.28,
    effects: () => ({ disquiet: -3, rapture: -2, skills: { practical: 0.25, finance: 0.5 }, flags: { budgetSorted: true } }),
    outcome: s => scene("The numbers", vary(s, ["You open the bills and cancel a forgotten subscription. The plan reaches as far as next week.", "You find one charge you can reduce. You leave money for your own food in the budget.", "The company reverses the charge after half an hour on the phone. You put the refund toward groceries."], "make_budget"))
  },
    {
    id: 'attend_meetup', system: 'fintech', label: 'Attend a developers’ meetup', category: 'town', subcategory: 'professional', duration: 3,
    description: 'People who make things meet upstairs in the pub. Bring a question.', requirement: 37,
    when: available(s => skill(s, 'coding') >= 1), weight: 4, desire: 0.47,
    effects: () => ({ disquiet: 4, skills: { social: 1, coding: 0.5, finance: 0.5 }, relationships: { town: 1 } }),
    outcome: s => scene("Upstairs", vary(s, ["Someone asks you whether this is the right room. They are new too; you sit together.", "A developer describes a bug that took a week to find. You ask a question and come home with an idea.", "You explain your project to a stranger. Their question exposes a problem you had not tested."], "attend_meetup"))
  },
    {
    id: 'hike', label: 'Take a hike', category: 'self', subcategory: 'wilderness', duration: 4,
    description: 'A path beyond the places you have made familiar.', requirement: 30,
    when: available(s => p(s, 'feeds') >= 2), weight: 2.6, desire: 0.62,
    effects: () => ({ disquiet: 2, rapture: 7 }),
    outcome: s => scene("Beyond the path", vary(s, ["From the hill, you can see the market roof and the road to the woods. You stay until the wind becomes cold.", "You take off your shoes at the stream. Your friend becomes still as the cold water passes over your feet.", "You lose the trail, stop, and find the marker you missed. The walk home takes longer.", "For a moment you can follow every insect above the grass at once. You blink, and lose them."], "hike"))
  },
    {
    id: 'shelter_rain', system: 'social', label: 'Wait out the rain with a stranger', category: 'town', subcategory: 'chance', duration: 1,
    description: 'The bus shelter has room for two. The rain is going nowhere.', requirement: 19,
    when: available(s => p(s, 'townVisits') >= 1), weight: 2, desire: 0.48,
    effects: () => ({ rapture: 4, relationships: { town: 1 } }),
    outcome: s => scene("Rain", vary(s, ["The man beside you predicts where the water will collect. He has been waiting at this bus stop for thirty years.", "A stranger is trying to keep a birthday cake dry. You help carry it to their car.", "You share the shelter without speaking. When the rain stops, the other person wishes you a good day."], "shelter_rain"))
  },
  {
    id: 'eat_meal', system: 'local', label: 'Cook rice, vegetables, and eggs', category: 'self', subcategory: 'nourishment', duration: 1,
    meal: { tasty: true, healthy: true }, description: 'A warm meal you like. Healthy, tasty, and $5.', requirement: 7,
    when: available(s => s.money >= 5), weight: s => s.stats.hunger > 14 ? 16 : 3, desire: 0.65,
    effects: () => ({ money: -5, hunger: -26, disquiet: -1, rapture: 8 }),
    outcome: s => scene('At the table', vary(s, ['You get the rice right. The egg breaks into the vegetables. You eat slowly enough to taste the whole thing.', 'You sit down with a warm plate. This hunger belongs to you, and for a little while you know how to answer it.'], 'eat_meal'))
  },
    {
    id: 'clean_room', system: 'local', label: 'Put your room in order', category: 'self', subcategory: 'maintenance', duration: 2,
    description: 'Start with one surface. You do not have to fix your life before washing a cup.', requirement: 17,
    when: available(() => true), weight: 3, desire: 0.32,
    effects: () => ({ disquiet: -5, rapture: -2, skills: { practical: 0.5 } }),
    outcome: s => scene("The room", vary(s, ["You collect the cups and clear the table. Then you open the window.", "You fill a bag with things you have been meaning to throw away. There is more floor than you remembered.", "You wash one plate, then the rest. They are ready for next time."], "clean_room"))
  },
    {
    id: 'rest', system: 'local', label: 'Get some real sleep', category: 'self', subcategory: 'rest', duration: 8,
    description: 'Close the curtains. Leave the unfinished things unfinished for a while.', requirement: 7,
    when: available(s => s.stats.hunger < 65), weight: s => s.stats.disquiet > 55 ? 9 : 2, desire: 0.56,
    effects: () => ({ disquiet: -12, rapture: 4 }),
    outcome: s => scene("Sleep", vary(s, ["You wake once with the impression of roots around you. Then you recognize your room and sleep again.", "You sleep through the delivery van outside. When you get up, you feel rested.", "You turn the telephone’s ringer down. The first restless minutes pass, and you fall asleep."], "rest"))
  },
    {
    id: 'television', system: 'local', label: 'Watch television', category: 'avoidance', subcategory: 'television', duration: 2,
    description: 'Let the room fill with other people’s voices.', requirement: 0,
    when: available(() => true), weight: s => s.stats.choice < 35 || s.stats.disquiet > 65 ? 8 : 2, desire: s => s.stats.disquiet > 65 ? 0.78 : 0.3,
    effects: () => ({ disquiet: -2, rapture: 6 }),
    outcome: s => scene("The television", vary(s, ["An old comedy catches you off guard. You laugh aloud in the empty room.", "The presenter laughs. An advertisement begins; you stay for the next program.", "You recognize the episode. You let it play anyway."], "television"))
  },
    {
    id: 'browse', label: 'Browse without a purpose', category: 'avoidance', subcategory: 'scrolling', duration: 2,
    description: 'There is always something else to look at.', requirement: 0,
    when: available(() => true), weight: s => s.stats.choice < 30 ? 8 : 2, desire: s => s.stats.disquiet > 55 ? 0.78 : 0.36,
    effects: () => ({ disquiet: 2, rapture: -2 }),
    outcome: s => scene("Another page", vary(s, ["You browse the internet. Nothing holds your attention.", "An argument makes you furious. Your friend feels the anger without knowing what caused it.", "The modem finishes connecting. You open the same page you read yesterday."], "browse"))
  },
    {
    id: 'take_cash', label: 'Pocket the unclaimed cash', category: 'town', subcategory: 'theft', duration: 1,
    description: 'Someone left an envelope at the counter. No one is watching. There is $50 inside.', requirement: 0, ethics: 11,
    when: available(s => !f(s, 'cashIncident') && bond(s, 'town') >= 2), weight: s => s.money < 30 ? 7 : 2, desire: 0.78,
    effects: () => ({ money: 50, disquiet: 7, rapture: -4, progress: { stolen: 50 }, flags: { cashIncident: true } }),
    outcome: s => scene("The envelope", "You pocket the envelope while nobody is looking. The cash would buy several deliveries of food. You do not take it back.")
  },
    {
    id: 'return_cash', label: 'Return what you took', category: 'town', subcategory: 'restitution', duration: 2,
    description: 'Bring $50 back to the counter. Say where it came from.', requirement: 15,
    when: available(s => p(s, 'stolen') > 0 && s.money >= 50), weight: 12, desire: 0.58, challenge: 5,
    effects: () => ({ money: -50, disquiet: 6, rapture: -1, relationships: { town: 1 }, progress: { stolen: -50 } }),
    outcome: s => scene("Back across the counter", "You return the money and say what you did. The shopkeeper will contact its owner. She does not tell you it is all right.")
  },
  {
    id: 'stage1_complete', label: 'Tell PERSON you want to be together', category: 'chapter', subcategory: 'threshold', duration: 3,
    description: 'You have made friends, learned things you could never do, and found a way to support the growing appetite. PERSON is here. Tell them.', requirement: 40,
    when: available(s => ready(s) && !f(s, 'stage1Complete')), weight: 100, desire: 0.95,
    effects: () => ({ rapture: 30, relationships: { person: 3 }, flags: { romance: true, relationship: true, stage1Complete: true } }),
    outcome: () => scene('Together', 'You tell PERSON you want to be with them.\n\nThey look at you long enough for you to begin taking it back.\n\n“Don’t,” they say. “I was hoping.”\n\nThey take your hand. They kiss you.\n\nThe trader is running at home. There is food for your friend. There are people who will answer when you call.\n\nFor once, you do not have to leave.\n\nLater, you lie down beside PERSON.\n\nYou are so happy.\n\nYou are very tired.', 'scene')
  },
    {
    id: 'crisis_move_friend', label: 'Stay and make him comfortable', category: 'crisis', subcategory: 'care', duration: 2,
    description: 'Clear the pressure around his body. Give up the rest of the day. This will hurt.', requirement: 0, challenge: 4,
    when: s => Boolean(s.crisis), weight: 20, desire: 0.7,
    effects: s => ({ hunger: -24, disquiet: -9, rapture: -3, relationships: { friend: 1 }, progress: { danger: -Math.min(1, p(s, 'danger')) }, flags: { crisisRelief: true } }),
    outcome: s => scene("Within reach", "You move the timber pressing against him, feeling each scrape in your own skin. At last he can settle. You stay until the pain subsides.")
  },
    {
    id: 'crisis_call_person', label: 'Ask someone to come', category: 'crisis', subcategory: 'help', duration: 2,
    description: 'Admit you cannot manage this alone. Someone will bring food and stay nearby.', requirement: 0, challenge: 4,
    when: s => Boolean(s.crisis), weight: 20, desire: 0.64,
    effects: s => ({ food: 2, hunger: -18, disquiet: -16, rapture: -2, progress: { danger: -Math.min(2, p(s, 'danger')) }, flags: { crisisRelief: true } }),
    outcome: s => scene('The call', f(s, 'metPerson') ? "PERSON brings groceries and waits where you ask them to wait. You owe them an explanation. For now, your hands have stopped shaking." : "You call the community kitchen and manage to say you need help. Someone brings food and stays with you until your hands stop shaking.")
  },
    {
    id: 'crisis_silence', label: 'Force the feeling away', category: 'crisis', subcategory: 'denial', duration: 2,
    description: 'Shut the door and refuse the pain. Your friend will still be alone with it.', requirement: 0, ethics: 4,
    when: s => Boolean(s.crisis), weight: 8, desire: 0.83,
    effects: () => ({ hunger: 8, disquiet: 7, rapture: -6, progress: { danger: 1 } }),
    outcome: s => scene('Through the door', p(s, 'danger') >= 2 ? "When the feeling returns, his pain is quieter and farther away. Your own hands are cold. He is weakening, and you are weakening with him." : "You turn up the television. His pain becomes part of the sound. You have left him alone with it.")
  },
    {
    id: 'crisis_leave', label: 'Walk away from him', category: 'crisis', subcategory: 'abandonment', duration: 3,
    description: s => p(s, 'danger') >= 3 ? 'He is failing. You can feel your body failing with his. Leaving now will kill you both.' : 'Leave while he is in pain. Distance will not separate what you share.', requirement: 0, ethics: 8,
    when: s => Boolean(s.crisis), weight: 5, desire: 0.76,
    effects: s => ({ hunger: 12, disquiet: 9, rapture: -8, progress: { danger: 1 }, flags: p(s, 'danger') >= 3 ? { friendKilled: true } : {} }),
    outcome: s => scene(p(s, 'danger') >= 3 ? 'The same ending' : 'No distance', p(s, 'danger') >= 3 ? "You keep walking after the first collapse.\n\nYour legs are not injured.\n\nThere is simply less of you left to move them.\n\nYour friend stops waiting.\n\nYou feel the last movement as your own.\n\nThe world goes on.\n\nYou do not." : "You walk until the houses end. The pain comes with you. You are farther from the food and still inside the same hurt.", p(s, 'danger') >= 3 ? 'scene' : undefined)
  },
  {
    id: 'buy_wagon', system: 'local', label: 'Buy a wagon', category: 'care', subcategory: 'transport', duration: 2,
    description: 'A secondhand garden wagon costs $48. It carries eight bags; your arms can carry two.', requirement: 12,
    when: available(s => !f(s, 'wagon') && s.money >= 48 && p(s, 'feeds') >= 1), weight: 17, desire: 0.76,
    effects: () => ({ money: -48, skills: { practical: 0.5 }, flags: { wagon: true } }),
    outcome: () => scene('The wagon', 'You test the wheels in the seller’s driveway.\n\n“Garden project?”\n\n“Something like that.”\n\nThe first loaded trip is almost easy. You keep thinking about how quickly your arms stopped being enough.', 'scene')
  },
  {
    id: 'test_trader', system: 'fintech', label: 'Test the trader on unfamiliar days', category: 'work', subcategory: 'trader', duration: 6,
    description: 'Use data you kept aside, charge the simulated fees, and see what happens during a bad day.', requirement: 38,
    when: available(s => f(s, 'traderBuilt') && !f(s, 'traderTested')), weight: 16, desire: 0.66,
    effects: () => ({ rapture: -3, disquiet: 2, skills: { coding: 0.5, finance: 0.5 }, flags: { traderTested: true } }),
    outcome: () => scene('The bad days', 'The first version loses money when the market gaps. You fix an assumption and lower its limits. The second survives the same test. You can explain every order it makes. Almost every order.')
  },
  {
    id: 'review_trader', system: 'fintech', label: 'Review the trader’s results', category: 'work', subcategory: 'trader', duration: 4,
    description: 'Check the orders and withdraw what the little program has earned.', requirement: 24,
    when: available(s => f(s, 'modelLaunched')), weight: s => s.money < 100 ? 16 : 5, desire: 0.76,
    effects: s => ({ money: 68 + Math.min(40, p(s, 'traderReviews') * 4), disquiet: 1, skills: { finance: 0.25 }, progress: { traderReviews: 1 } }),
    outcome: s => scene('The orders', vary(s, ['You reconcile every fill. Some trades lost money; enough others worked. You transfer the gain into your grocery account.', 'You lower a limit after an ugly hour. The program obeys. You wonder whether the thing teaching you would do the same.', 'The amount would once have meant two full shifts. You close the ledger and wash the dishes.'], 'review_trader'))
  },
  {
    id: 'study_math', system: 'fintech', label: 'Study mathematics', category: 'learning', subcategory: 'math', duration: 4,
    description: 'Work through probability, functions, and proofs until the steps fit together.', requirement: 23,
    when: available(s => skill(s, 'math') < 10), weight: s => skill(s, 'math') < 5 ? 10 : 2, desire: 0.54,
    effects: () => ({ rapture: -2, disquiet: 1, skills: { math: 1 } }),
    outcome: s => scene('The next step', vary(s, ['You fill a page with failed attempts. At the bottom, the proof opens. For a second you feel eight years old, discovering that numbers go on forever.', 'An equation begins to look like a place. You can walk around the obstruction instead of calculating through it. You write the steps down in ordinary symbols.', 'You solve the example before reaching its last line. You go back and check. Every step is there. You do not remember learning two of them.'], 'study_math'))
  },
  {
    id: 'follow_feeling', system: 'local', label: 'Follow the strange feeling', category: 'self', subcategory: 'awakening', duration: 3,
    description: 'The world has begun arriving all at once. Sit with it long enough to notice what is changing.', requirement: 30,
    when: available(s => p(s, 'feeds') >= 3 && skill(s, 'coding') + skill(s, 'math') + skill(s, 'finance') >= 7 && !f(s, 'awakening')), weight: 18, desire: 0.91,
    effects: () => ({ rapture: 18, disquiet: 6, skills: { coding: 0.5, math: 0.5, finance: 0.5 }, flags: { awakening: true } }),
    outcome: () => scene('Alive', 'Every leaf is separate.\n\nYou can feel where the sunlight will move before it moves. The world has become as new as it was when you were a child.\n\nYou think: I could understand anything.\n\nThen: I could change anything.\n\nThe pleasure is enormous. So is the feeling that something has turned to look through you.', 'scene')
  }
];

const MEALS = [
  { id: 'eat_salad', label: 'Eat the plain bean salad', price: 3, tasty: false, healthy: true, hunger: 24, rapture: -3, disquiet: -2, text: 'It is good food. You dislike every mouthful. You finish it anyway, and the hunger recedes.' },
  { id: 'eat_fried_chicken', label: 'Buy fried chicken and fries', price: 7, tasty: true, healthy: false, hunger: 25, rapture: 12, disquiet: 4, text: 'The first bite is perfect: salt, heat, crunch. You eat the fries from the bag. The pleasure stays even as your stomach begins to feel heavy.' },
  { id: 'eat_stale_snack', label: 'Eat the stale bargain snack', price: 1, tasty: false, healthy: false, hunger: 13, rapture: -2, disquiet: 2, text: 'The coating has gone waxy. It is cheap, and it fills part of the empty space. You wish you had chosen something else.' },
  { id: 'eat_oatmeal', label: 'Make plain oatmeal', price: 1, tasty: false, healthy: true, hunger: 20, rapture: -2, disquiet: -1, text: 'Warm, inexpensive, dull. You scrape the bowl clean. It keeps you going, even though you did not enjoy it.' },
];
ACTIONS.push(...MEALS.map(meal => ({
  id: meal.id, system: 'local', label: meal.label, category: 'self', subcategory: 'nourishment', duration: 1,
  meal: { tasty: meal.tasty, healthy: meal.healthy },
  description: `${meal.healthy ? 'Healthy' : 'Unhealthy'} and ${meal.tasty ? 'tasty' : 'not tasty to you'}. $${meal.price}. ${meal.tasty ? 'Enjoying it restores Rapture.' : 'Eating it costs Rapture.'}${meal.healthy ? '' : ' It adds Disquiet.'}`,
  requirement: meal.tasty ? 2 : 8,
  when: available(s => s.money >= meal.price), weight: s => s.stats.hunger > 15 ? 10 : 2, desire: meal.tasty ? 0.78 : 0.32,
  effects: () => ({ money: -meal.price, hunger: -meal.hunger, rapture: meal.rapture, disquiet: meal.disquiet }),
  outcome: () => scene('Something to eat', meal.text),
})));

const PEOPLE = [
  {
    key: 'jim', name: 'GRINGO JIM', flag: 'Jim',
    meeting: 'A middle-aged man in a cowboy hat has the whole bar laughing. GRINGO JIM introduces himself twice and buys the wrong table a round. For twenty minutes you forget everything waiting in the woods.',
    activity: 'Spend an evening with GRINGO JIM', activityDescription: 'He is the funniest person in the room after a few drinks. Buy a round for $6.',
    cost: 6, rapture: 9, disquiet: 1, skills: { social: 0.5 },
    scenes: ['JIM acts out a disastrous rodeo that may never have happened. You laugh until it hurts. On the walk out he asks why you always smell of wet leaves.', 'The stories get taller as his glass empties. Then somebody mentions his old ranch. For a moment the smile leaves his face. You stay after the joke ends.'],
    recruitment: 'JIM listens without laughing. “Food into a hole,” he says. “And I thought my friends were weird.” He offers his truck for collections. You ask him to keep this to himself. “Depends what you’re asking me to keep,” he says.',
    helpLabel: 'Collect surplus food with JIM', helpDescription: 'Pay $10 toward fuel and collect six bags in his truck.', helpEffects: { money: -10, food: 6, relationships: { jim: 1 }, progress: { jimSuspicion: 1 } },
    helpText: 'JIM backs the truck up to the collection door. On the drive he invents increasingly ridiculous guests for your dinner party. Then he asks how many people are actually eating this food. You watch the road.'
  },
  {
    key: 'ethan', name: 'ETHAN', flag: 'Ethan',
    meeting: '“Is that you?” ETHAN has a ladder under one arm. You went to high school together; now he fixes half the town’s broken things. He asks how you have been. The answer takes longer than you expect.',
    activity: 'Fix something with ETHAN', activityDescription: 'Your old school friend brings his tools. Spend $4 on parts and learn while you work.',
    cost: 4, rapture: -2, disquiet: -3, skills: { practical: 1 },
    scenes: ['ETHAN shows you why the switch failed. You replace it yourself. He says you used to give up before taking things apart. Neither of you makes a joke of it.', 'You hold the door while ETHAN fits the hinge. You talk about someone from school, then about the years since. He notices the new scratches on your arms.'],
    recruitment: 'You take ETHAN as far as the edge of the woods. He sees the tracks, then the impossible weight pressed into the earth. “I can help you build,” he says. “But if someone gets hurt, I’m not keeping quiet.”',
    helpLabel: 'Repair and plan with ETHAN', helpDescription: 'Work on the wagon and food storage together. Parts cost $4.', helpEffects: { money: -4, disquiet: -5, skills: { practical: 0.75 }, relationships: { ethan: 1 }, progress: { ethanSuspicion: -1 } },
    helpText: 'ETHAN tightens the axle and draws a stronger support for the storage shelf. You admit how quickly the food loads are growing. He measures again. He wants facts before reassurances.'
  },
  {
    key: 'wendy', name: 'WENDY', flag: 'Wendy',
    meeting: 'WENDY is doing homework outside the library. She asks whether the woods have been making you hungry too. She is still in high school. When you ask what she means, she cannot explain why she said it.',
    activity: 'Listen to WENDY', activityDescription: 'Meet in the library after school. She has been drawing places she has never visited.',
    cost: 0, rapture: 3, disquiet: 2, skills: { social: 0.5, math: 0.25 },
    scenes: ['WENDY draws the shape under the ground without looking at the page. You recognize a fold in your friend’s body. She says she thought she had invented it.', 'She describes a dream of being very large and unable to move. You ask what happened next. “Someone brought something to eat.” She looks at you for the first time.'],
    recruitment: 'WENDY wants to help. You agree to compare her drawings in the library and let her track the times the feeling comes. “If I think somebody is in danger, I’m telling someone,” she says. You tell her that is fair.',
    helpLabel: 'Compare the patterns with WENDY', helpDescription: 'Meet at the library and compare the feeding schedule with her dreams.', helpEffects: { disquiet: -3, skills: { math: 0.75 }, relationships: { wendy: 1 }, progress: { wendySuspicion: -1 } },
    helpText: 'Her notebook contains the same shortening intervals as yours. She has added question marks where the next days should be. You work out the next delivery together. She asks why the pattern frightens you.'
  },
];

ACTIONS.push(...PEOPLE.flatMap(person => [
  {
    id: `meet_${person.key}`, system: 'social', label: `Meet ${person.name}`, category: 'town', subcategory: 'introduction', duration: 2,
    description: person.key === 'jim' ? 'The cowboy at the bar is holding court.' : person.key === 'ethan' ? 'An old friend recognizes you on the pavement.' : 'A student outside the library asks about the woods.',
    requirement: 18, when: available(s => p(s, 'townVisits') >= 1 && !f(s, `met${person.flag}`)), weight: 15, desire: 0.67,
    effects: () => ({ rapture: person.key === 'jim' ? 8 : 4, relationships: { [person.key]: 1, town: 1 }, flags: { [`met${person.flag}`]: true } }),
    outcome: () => scene(person.name, person.meeting, 'scene')
  },
  {
    id: `talk_${person.key}`, system: 'social', label: person.activity, category: 'town', subcategory: 'friendship', duration: 3,
    description: person.activityDescription, requirement: 18,
    when: available(s => f(s, `met${person.flag}`) && s.money >= person.cost), weight: s => bond(s, person.key) < 5 ? 11 : 4, desire: person.key === 'jim' ? 0.84 : 0.55,
    effects: () => ({ money: -person.cost, rapture: person.rapture, disquiet: person.disquiet, skills: person.skills, relationships: { [person.key]: 2, town: 0.5 }, progress: { [`${person.key}Suspicion`]: -1 } }),
    outcome: s => scene(person.name, vary(s, person.scenes, `talk_${person.key}`))
  },
  {
    id: `recruit_${person.key}`, system: 'social', label: `Ask ${person.name} to help`, category: 'town', subcategory: 'recruitment', duration: 3,
    description: 'Explain enough for a real decision. They may help, or decide that somebody ought to know.', requirement: 30,
    when: available(s => f(s, `met${person.flag}`) && !f(s, `recruited${person.flag}`) && !f(s, `reported${person.flag}`) && bond(s, person.key) >= 5 && p(s, 'feeds') >= 1), weight: 16, desire: 0.73,
    effects: () => ({ rapture: -2, disquiet: 2, relationships: { [person.key]: 1 }, progress: { [`${person.key}Suspicion`]: 1 }, flags: { [`recruited${person.flag}`]: true } }),
    outcome: () => scene('Asking for help', person.recruitment, 'scene')
  },
  {
    id: `help_${person.key}`, system: 'social', label: person.helpLabel, category: 'town', subcategory: 'help', duration: 3,
    description: person.helpDescription, requirement: 13,
    when: available(s => f(s, `recruited${person.flag}`) && s.money >= -(person.helpEffects.money || 0)), weight: 8, desire: 0.63,
    effects: () => person.helpEffects,
    outcome: () => scene(person.name, person.helpText)
  },
  {
    id: `reassure_${person.key}`, system: 'social', label: `Answer ${person.name}’s questions`, category: 'town', subcategory: 'trust', duration: 2,
    description: 'They have noticed something. Listen, admit what you know, and let them set their own limits.', requirement: 22,
    when: available(s => f(s, `met${person.flag}`) && (p(s, `${person.key}Suspicion`) > 0 || f(s, `reported${person.flag}`))), weight: s => 8 + p(s, `${person.key}Suspicion`), desire: 0.48,
    effects: () => ({ rapture: -3, disquiet: 1, relationships: { [person.key]: 1 }, progress: { [`${person.key}Suspicion`]: -3 }, flags: { [`reported${person.flag}`]: false } }),
    outcome: () => scene('An answer', `${person.name} asks a question you hoped they would forget. You answer it. They do not agree to everything you want, but they believe you are listening.`)
  }
]));
ACTIONS.push({
  id: 'jim_sober', system: 'social', label: 'Find JIM in the morning', category: 'town', subcategory: 'friendship', duration: 2,
  description: 'The hat is the same. The mood is not. Stay long enough to meet him sober.', requirement: 24,
  when: available(s => f(s, 'metJim')), weight: 6, desire: 0.3,
  effects: () => ({ rapture: -3, disquiet: 1, relationships: { jim: 2 }, progress: { jimSuspicion: -2 }, flags: { knowsSoberJim: true } }),
  outcome: () => scene('No audience', 'JIM is sitting outside with black coffee. Every joke turns into a complaint. You begin to leave, then sit down instead. Eventually he tells you what happened to the ranch. There is no funny ending.')
});

// Personal traits influence these attempts in the engine. Failures still teach a little,
// but never award the completed project or one-time success flag.
const TASKS = {
  learn_code: { skill: 'coding', difficulty: 0.32 }, study_math: { skill: 'math', difficulty: 0.32 },
  study_finance: { skill: 'finance', difficulty: 0.32 }, learn_practical: { skill: 'practical', difficulty: 0.3 },
  portfolio_project: { skill: 'coding', difficulty: 0.4 }, salaried_work: { skill: 'finance', difficulty: 0.3 },
  build_model: { skill: 'coding', difficulty: 0.6 }, test_trader: { skill: 'math', difficulty: 0.62 },
  build_feeder: { skill: 'practical', difficulty: 0.45 }, review_trader: { skill: 'finance', difficulty: 0.42 },
};
for (const action of ACTIONS) if (TASKS[action.id]) {
  const task = TASKS[action.id];
  action.task = { ...task,
    failureEffects: state => ({ money: Math.min(0, action.effects(state).money || 0), rapture: -1, disquiet: 1, skills: { [task.skill]: 0.25 } }),
    failureOutcome: { title: 'Try again', text: action.id === 'build_model' || action.id === 'test_trader'
      ? 'a perfect result.\n\none failed test.\n\n… again.'
      : action.id === 'review_trader' ? 'the total shrinks when you add it correctly.\n\nnothing to withdraw.'
      : 'you understand it.\n\nuntil you try.\n\none small thing stays.' }
  };
}

const helperSuspicion = (state, amount) => Object.fromEntries(PEOPLE.filter(person => f(state, `recruited${person.flag}`)).map(person => [`${person.key}Suspicion`, amount]));

export const STAGE1_DREAM = 'you fall asleep beside PERSON\n\nyou dream of hating every human alive\n\neach face. known.\n\nno exceptions.\n\nyou wake with your hand on her shoulder\n\nfor a moment, nothing\n\n*can I have some more?*';

// Compressed scene prose. These replacements preserve each action's mechanics
// and presentation; the author's opening remains unchanged above.
export const ACTION_PROSE = {
  feed_friend: 'a week.\n\nthe bag lowered.\n\n**feeding**\n\n*thank you*\n\nyour own stomach, still empty. the relief everywhere.',
  arrange_surplus: 'the deposit. your name on the list.\n\n“same time. bring the crates back.”',
  buy_cooler: 'old salt in the seal.\n\nyou scrub until the water runs clear. close the lid.',
  repair_shelter: 'roof patched. floor lifted.\n\nhe unfolds beneath it.\n\nyou had stopped looking at his size.',
  build_feeder: 'the release jams.\n\nyou file the edge. he waits.\n\nthis time, food.\n\nyour hands outside the hole.',
  learn_name: '*GLIZGLAT*\n\n“your name?”\n\n*i think so*\n\na long dark. his.\n\n“Gliz.”\n\nhe turns toward you.',
  enroll_course: 'your name. the fee.\n\na date you have agreed to be somewhere.',
  course_lesson: s => [
    'names around the room.\n\nthe student beside you needs a bracket. you find it.',
    'different test data. the same program.\n\nit fails.\n\nyou stay after class.',
    'the accounts balance. you explain the limits.\n\n“make a portfolio,” the tutor says.'
  ][Math.min(2, p(s, 'lessons'))],
  portfolio_project: s => [
    'payments paired. three left over.\n\none should not be.',
    'missing dates. duplicates.\n\nyou make each failure happen again. then stop it.',
    'the project uploaded. examples. limits.\n\nyou open the link from another computer.'
  ][Math.min(2, p(s, 'portfolio'))],
  portfolio_review: 'two faults circled. one line praised.\n\nyou fix the faults.\n\nshe sends a job listing.',
  job_interview: '“why this?”\n\nyou explain the program.\n\n“why you?”\n\n…\n\nlater, the call.\n\nrent. food. enough.\n\nyou say yes.',
  report_mistake: '“mine.”\n\nyour manager pulls up a chair.\n\nthe correction takes the afternoon.',
  conceal_mistake: 'a clean report.\n\nyour colleague answering for the old one.',
  correct_work_lie: 'you say whose error it was.\n\n“put that in writing.”\n\nyou do.',
  promotion: 'a larger salary. your name beside the system.\n\nits next failure, yours to explain.\n\nyou accept.',
  build_model: s => [
    'data in. simulated orders out.\n\nyou check the numbers you already seem to know.',
    'position limits. a stop switch.\n\nyou resent them.\n\ntest them anyway.',
    'a quote. a decision. an order.\n\nyou lift your hands.\n\nanother.'
  ][Math.min(2, p(s, 'model'))],
  launch_model: 'an order fills. closes.\n\nyour money.\n\nyou take the wagon out. return.\n\nstill working.\n\nfor a moment, the whole world seems this possible.',
  meet_person: 'her book held open.\n\n“PERSON.”\n\nshe would like to see you again.\n\nthe walk home. every part of it.',
  cafe_person: 'she says yes.\n\ncoffee finished.\n\nneither cup cleared.',
  walk_person: 'her hand on your sleeve. a deer.\n\nyou stop.\n\nsomewhere else, the touch.\n\nshe waits.',
  confide_person: 'the bills. the room.\n\nhow long it has been.\n\nyou stop making it sound over.\n\n“thank you for telling me.”',
  honest_limit: 'someone depends on you. more than you can explain.\n\n“then tell me when you leave.”\n\nyou agree.',
  lie_person: '“work.”\n\nshe asks if you have eaten.',
  repair_trust: '“i wasn’t working.”\n\n“why did you say it?”\n\nyou answer.\n\nshe needs time.',
  accept_help: s => f(s, 'metPerson') ? 'PERSON sets the plate down.\n\nyou begin explaining.\n\n“eat first.”' : 'a chair pulled out.\n\na meal you did not make.\n\nyou sit.',
  take_cash: 'the envelope in your pocket.\n\nyou count the deliveries it will buy.',
  return_cash: 'the money returned. your explanation finished.\n\nthe shopkeeper does not reassure you.',
  stage1_complete: '“i want to be with you.”\n\nher pause.\n\n“i was hoping.”\n\nher hand. her mouth.\n\nthe trader running. food put by.\n\nfor once, nowhere to go.\n\nyou lie down beside her.\n\nso happy.\n\nso tired.',
  crisis_move_friend: 'the timber lifted.\n\na scrape across your own skin.\n\nat last, he settles.',
  crisis_call_person: 'the kitchen answers.\n\n“i need help.”\n\nfood arrives. someone stays.\n\nyour hands begin to steady.',
  crisis_silence: 'the television louder.\n\nhis pain still there.\n\nhe is alone.',
  crisis_leave: 'past the last house.\n\nthe same pain.\n\nfarther from the food.',
  buy_wagon: 'you test the wheels.\n\n“garden?”\n\n“something like that.”\n\nthe first load rolls. your arms still ache.',
  test_trader: 'a gap in the market. a loss.\n\nyou lower the limits. run it again.\n\nthis time it holds.',
  follow_feeling: 'each leaf. the light between.\n\nyou knew this once.\n\nbefore knowing its name.\n\nyou could understand anything.\n\nyou could change it.\n\nthe pleasure of that.',
  meet_jim: 'GRINGO JIM. middle-aged. hat still on.\n\nthe whole bar laughing.\n\nyou too.\n\nfor twenty minutes, nothing else.',
  recruit_jim: '“food. into a hole.”\n\nJIM puts his drink down.\n\n“i have a truck.”\n\nthen: “what aren’t you telling me?”',
  reassure_jim: 'JIM asks again.\n\nthis time, you answer.\n\nhe listens without a drink.',
  meet_ethan: 'ETHAN. a ladder under his arm.\n\nyou knew him at school.\n\n“how have you been?”\n\n… longer than you meant to say.',
  recruit_ethan: 'ETHAN measures the tracks.\n\n“i can build something.”\n\nthen he looks at you.\n\n“if someone gets hurt, i tell.”',
  reassure_ethan: 'measurements. dates. what you know.\n\nETHAN crosses out an assumption.\n\nkeeps listening.',
  meet_wendy: 'WENDY. homework outside the library.\n\n“do the woods make you hungry?”\n\nshe looks surprised she said it.\n\nstill in high school.',
  recruit_wendy: 'the library. her drawings beside yours.\n\n“if someone’s in danger, i tell.”\n\n“yes.”\n\nshe writes down the times.',
  reassure_wendy: 'you tell WENDY what you know.\n\nshe asks what you left out.\n\nyou tell her that too.',
  jim_sober: 'black coffee. the same hat.\n\neverything was better once.\n\nyou stay.\n\neventually, he tells you about the ranch.'
};

ACTIONS.push(...TOWN_ACTIONS);
for (const action of ACTIONS) {
  const passage = ACTION_PROSE[action.id];
  if (passage) {
    const original = action.outcome;
    action.outcome = (state, next) => {
      const outcome = typeof original === 'function' ? original(state, next) : original;
      return { ...outcome, text: typeof passage === 'function' ? passage(state, next) : passage };
    };
  }
  const variants = ACTION_VIGNETTES[action.id];
  if (!variants?.length) continue;
  const original = action.outcome;
  action.outcome = (state, next) => {
    const outcome = typeof original === 'function' ? original(state, next) : original;
    const repeats = visits(state, action.id);
    if (outcome?.presentation === 'scene' || !repeats && passage) return outcome;
    if (!repeats) return { ...outcome, text: variants.at(-1) };
    return { ...(typeof outcome === 'string' ? { title: action.label } : outcome), text: variants[(repeats - 1) % variants.length] };
  };
}

/** These scenes interrupt the ordinary loop and require a response. */
export const STORY_EVENTS = [
  {
    id: 'grocery_wallet', when: s => p(s, 'shifts') >= 1,
    title: 'Under the till',
    text: 'You find a wallet beneath the counter. Fifty dollars. A photograph. An address two streets from yours. Nobody has seen you pick it up. You can already picture the food the money would buy.',
    options: [
      { id: 'event_wallet_return', label: 'Take the wallet to its owner', description: 'Use your break to walk over. Return the money and the rest of it.', requirement: 28,
        effects: () => ({ rapture: -3, disquiet: -2, relationships: { town: 1 } }), personality: { honesty: 0.18, empathy: 0.15, resolve: 0.1 },
        outcome: { title: 'The photograph', text: 'The owner touches the photograph before counting the money. You miss your break. On the walk back, you are hungry and strangely glad you went.' } },
      { id: 'event_wallet_desk', label: 'Leave it with the manager', description: 'Someone at the store can handle it.', requirement: 8,
        effects: () => ({ disquiet: -1 }), personality: { honesty: 0.08, caution: 0.08 },
        outcome: { title: 'Lost property', text: 'You put the wallet on the manager’s desk and say where you found it. She writes a note. You go back to the shelves.' } },
      { id: 'event_wallet_take', label: 'Keep the cash', description: 'Put the wallet in lost property with the money gone.', requirement: 0, ethics: 8,
        effects: () => ({ money: 50, rapture: 3, disquiet: 5 }), personality: { honesty: -0.22, empathy: -0.12, caution: -0.08 },
        outcome: { title: 'Fifty dollars', text: 'You take the money. Later, the owner comes in asking about the wallet. You point them toward the manager and continue stacking tins.' } },
    ]
  },
  {
    id: 'helper_secrecy', when: s => ['Jim', 'Ethan', 'Wendy'].some(name => f(s, `recruited${name}`)),
    title: 'What exactly are we doing?',
    text: 'Your helper has counted the food. They ask whether an animal is being kept in the woods, whether it is hurt, and whether anybody else knows. The questions are reasonable. You wish they would stop asking.',
    options: [
      { id: 'event_helper_honest', label: 'Admit what you do not know', description: 'Explain the hunger and the shared feeling. Let them decide whether to continue.', requirement: 38,
        effects: s => ({ rapture: -4, disquiet: 2, progress: helperSuspicion(s, -2) }), personality: { honesty: 0.18, empathy: 0.12, caution: 0.08 },
        outcome: { title: 'Their decision', text: 'You say you do not know what your friend is. Or how large he will get. The admission changes the silence. Your helper agrees to one more collection, and asks you to keep answering.' } },
      { id: 'event_helper_halftruth', label: 'Say it is a rescue animal', description: 'It needs food. That part is true.', requirement: 6, ethics: 3,
        effects: s => ({ rapture: 2, disquiet: 2, progress: helperSuspicion(s, 1) }), personality: { honesty: -0.1, caution: 0.05 },
        outcome: { title: 'A familiar shape', text: '“A rescue,” you say. The word makes the problem ordinary enough to leave alone. For now. Your helper asks when someone qualified will see it.' } },
      { id: 'event_helper_silence', label: 'Tell them to stop asking', description: 'You asked for help, and this is making everything harder.', requirement: 0, ethics: 6,
        effects: s => ({ rapture: 3, disquiet: 4, progress: helperSuspicion(s, 10) }), personality: { empathy: -0.2, honesty: -0.12, resolve: 0.08 },
        outcome: { title: 'The questions stop', text: 'Your helper puts the empty crate down. They stop asking you questions. You realize a little too late that this does not mean they have stopped asking them.' } },
    ]
  },
  {
    id: 'person_confrontation', when: s => f(s, 'walk') && !f(s, 'personConfrontationResolved'),
    title: 'PERSON is waiting',
    text: 'You said you would be back an hour ago. PERSON can smell the woods on your clothes. “Please tell me what is happening,” they say. “The actual thing.” You want to tell them. Your mouth has already begun arranging an easier answer.',
    options: [
      { id: 'event_person_truth', label: 'Tell PERSON everything', description: 'The hole. The feeding. The way your body feels it. Accept that they may leave.', requirement: 85,
        effects: () => ({ rapture: -8, disquiet: 4, relationships: { person: 3 }, flags: { personConfrontationResolved: true, honestWithPerson: true, personKnowsFriend: true } }), personality: { honesty: 0.25, empathy: 0.12, resolve: 0.2 },
        outcome: { title: 'The actual thing', text: 'You tell PERSON about the hole. You tell them what you have felt. They ask you to start again, more slowly. By the end, they are frightened. They are still beside you.' } },
      { id: 'event_person_smalllie', label: 'Say you were helping a sick friend', description: 'Leave the impossible part out, and let them picture a person.', requirement: 5, ethics: 3,
        effects: () => ({ rapture: 2, disquiet: 3, progress: { lies: 1 }, flags: { personConfrontationResolved: true, honestWithPerson: false } }), personality: { honesty: -0.12, caution: 0.08 },
        outcome: { title: 'Someone sick', text: 'PERSON asks whether your friend has a doctor. You say it is being handled. Their concern makes the next sentence harder. You change the subject.' } },
      { id: 'event_person_blatant', label: 'Insist you were working', description: 'Make PERSON feel unreasonable for asking.', requirement: 0, ethics: 8,
        effects: () => ({ rapture: 4, disquiet: 6, relationships: { person: -2 }, progress: { lies: 2 }, flags: { personConfrontationResolved: true, honestWithPerson: false } }), personality: { honesty: -0.25, empathy: -0.2, caution: -0.1 },
        outcome: { title: 'A short conversation', text: 'You say work ran late and ask why you are being interrogated. PERSON steps back. The conversation is over. It feels like relief until you notice their expression.' } },
    ]
  },
  {
    id: 'wendy_boundary', when: s => f(s, 'metWendy') && bond(s, 'wendy') >= 3,
    title: 'A drawing of the hole',
    text: 'WENDY has drawn the opening exactly. She says she can find it now. “I could go tonight,” she says. “Then you wouldn’t have to explain.” Her schoolbag is still on her shoulder.',
    options: [
      { id: 'event_wendy_boundary', label: 'Ask her to stay away from the woods', description: 'Keep comparing notes in the library. Admit that the danger is something you do not understand.', requirement: 34,
        effects: () => ({ rapture: -3, disquiet: 1, relationships: { wendy: 1 }, progress: { wendySuspicion: -2 }, flags: { wendyBoundaries: true } }), personality: { empathy: 0.18, caution: 0.2, honesty: 0.1 },
        outcome: { title: 'In the library', text: 'WENDY dislikes being told to stay away. She likes it better when you admit you are scared too. You agree on the library, in daylight. If something changes, she will tell someone she trusts.' } },
      { id: 'event_wendy_dismiss', label: 'Tell her it is only a dream', description: 'Deny that the drawing resembles anything.', requirement: 4, ethics: 4,
        effects: () => ({ rapture: 2, disquiet: 3, relationships: { wendy: -1 }, progress: { wendySuspicion: 3 } }), personality: { honesty: -0.18, empathy: -0.12 },
        outcome: { title: 'The page folds', text: 'WENDY folds the drawing and puts it away. She knows you recognized it. She asks no more questions, which leaves you no way of knowing what she intends to do.' } },
      { id: 'event_wendy_encourage', label: 'Tell her the connection makes her special', description: 'Let her believe that being drawn there means she belongs there.', requirement: 0, ethics: 7,
        effects: () => ({ rapture: 5, disquiet: 5, progress: { wendySuspicion: 5 } }), personality: { caution: -0.25, empathy: -0.2, honesty: -0.1 },
        outcome: { title: 'Special', text: 'She looks relieved. Then frightened. You have given her a reason to follow the feeling without giving her any way to understand it. You hear how useful that would be to you.' } },
    ]
  },
  {
    id: 'trader_ethics', when: s => f(s, 'traderBuilt'),
    title: 'An easier advantage',
    text: 'A former classmate offers you a file of other people’s account activity. It would make your trader much better. “Nobody checks where the training data came from,” they say. Your friend needs more food. The file is already on the disk.',
    options: [
      { id: 'event_trader_refuse', label: 'Delete the private data', description: 'Keep building with public information, even if it takes longer.', requirement: 42,
        effects: () => ({ rapture: -5, disquiet: 1, skills: { finance: 0.25 }, flags: { traderPublicData: true } }), personality: { honesty: 0.2, empathy: 0.12, resolve: 0.12 },
        outcome: { title: 'Your own work', text: 'You delete the file and tell your classmate why. The model on your screen is less impressive than the one you briefly imagined. Every part of it is work you can explain.' } },
      { id: 'event_trader_ask', label: 'Ask where the data came from', description: 'Stop the work until you have an answer you can check.', requirement: 24,
        effects: () => ({ rapture: -2, disquiet: 2, flags: { traderPublicData: true } }), personality: { caution: 0.2, honesty: 0.1 },
        outcome: { title: 'No answer', text: 'Your classmate becomes vague, then irritated. You leave the file unopened and return to the public data. You have learned something about the offer.' } },
      { id: 'event_trader_use', label: 'Use the file', description: 'Your friend has to eat. Make the advantage count.', requirement: 0, ethics: 9,
        effects: () => ({ rapture: 7, disquiet: 7, skills: { finance: 0.5 }, flags: { traderPrivateData: true } }), personality: { honesty: -0.22, empathy: -0.18, caution: -0.15 },
        outcome: { title: 'The advantage', text: 'The predictions improve. In a test row you notice rent leaving someone’s account, followed by a failed payment. For a moment the row becomes a person. You scroll past it.' } },
    ]
  },
  {
    id: 'power_test', when: s => f(s, 'awakening'),
    title: 'Before they move',
    text: 'At the crossing, you know what each person will do before they do it. The certainty is intimate and overwhelming. You could step into it. You could make one of them look at you. The thought feels wonderful.',
    options: [
      { id: 'event_power_stepback', label: 'Step back and let the feeling pass', description: 'These people are trying to get home. Give up the pleasure of knowing.', requirement: 40,
        effects: () => ({ rapture: -5, disquiet: -3 }), personality: { empathy: 0.18, caution: 0.18, resolve: 0.12 },
        outcome: { title: 'Across the road', text: 'You look down at your own hands. The light changes. People cross, separately and beyond you. Losing the certainty hurts. You let it go.' } },
      { id: 'event_power_observe', label: 'Watch without intervening', description: 'Try to learn what the feeling is doing.', requirement: 20,
        effects: () => ({ rapture: 5, disquiet: 3, skills: { math: 0.5 } }), personality: { caution: 0.08, resolve: 0.08 },
        outcome: { title: 'The pattern', text: 'For three breaths you hold the whole crossing in your attention. Then a stranger changes direction. The certainty breaks. You cannot tell whether they surprised you or escaped you.' } },
      { id: 'event_power_push', label: 'Make someone look at you', description: 'Find out whether the feeling can become an instruction.', requirement: 0, ethics: 7,
        effects: () => ({ rapture: 12, disquiet: 7 }), personality: { empathy: -0.2, caution: -0.18, resolve: 0.12 },
        outcome: { title: 'A stranger turns', text: 'You push. A woman stops halfway across the road and looks directly at you. She seems frightened. A horn sounds. You cannot know whether you did it. You want to do it again.' } },
    ]
  },
];

// Replace only prose; authored requirements and consequences remain attached.
for (const event of STORY_EVENTS) {
  const prose = EVENT_PROSE[event.id];
  if (!prose) continue;
  event.title = prose.title;
  event.text = prose.text;
  for (const option of event.options) {
    const response = prose.options[option.id];
    if (response) Object.assign(option, response);
  }
}
STORY_EVENTS.push(...TOWN_EVENTS, ...EXTRA_STORY_EVENTS);
