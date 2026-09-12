/*
 * Alignment — Stage 1 implementation fiction.
 * The opening follows the author's latest explicit wording and presentation.
 * New scenes and concrete progression are implementation prose, not amendments
 * to the author's source record. Balance remains an implementation choice.
 */

const f = (s, key) => Boolean(s.flags?.[key]);
const p = (s, key) => Number(s.progress?.[key] || 0);
const skill = (s, key) => Number(s.skills?.[key] || 0);
const bond = (s, key) => Number(s.relationships?.[key] || 0);
const scene = (title, text, presentation) => ({ title, text, ...(presentation ? { presentation } : {}) });
// Cycle per activity, so a repeated three-turn routine cannot repeat one passage forever.
const vary = (s, options, id) => options[(s.history || []).filter(entry => entry.id === id).length % options.length];
const ordinary = s => !s.crisis;
const available = predicate => s => ordinary(s) && predicate(s);
const ready = s => STAGE1_MILESTONES.every(m => m.test(s));

export const INTRO = [
  {
    title: 'too early',
    text: 'you wake up too early\n\nstepping outside you are immersed in the UNQUIET\n\ncan you describe this feeling?\n\ncan emptiness be felt?\n\nyes it can\n\n*my heart is yelling*\n\n*from somewhere in the woods came a small sound*',
    prompt: 'Investigate? (Y/N)',
    refusal: 'you feel yourself immersed in the UNQUIET',
    button: 'Yes'
  },
  {
    title: 'there is no path',
    text: 'you wander into the woods. the sun is rising. there is no path\n\n*i want to hold something, so tightly it hurts*\n\nyou arrive at a hole that wasn’t there before\n\nthe bottom two eyes look up at you\n\n*i am hungry*\n\nare these your own thoughts?\n\nyou have a half-eaten granola bar in your pocket',
    prompt: 'Throw it in the hole? (Y/N)',
    refusal: '*i am hungry*',
    button: 'Yes'
  },
  {
    title: 'thank you',
    text: '*thank you*\n\n*can i have some more?*',
    button: 'Continue'
  },
  {
    title: 'something to return to',
    text: 'on the way home you are hungry.\n\na sharp ache travels up a leg that is not moving.\n\nyou stop.\n\nfar behind you, something shifts in the hole.\n\nthe ache stops too.\n\nyour room is as you left it.\n\nno messages.\n\nvery little money.\n\nyou sit down with your coat still on.\n\n*can i have some more?*',
    button: 'begin stage 1'
  }
];

export const STAGE1_MILESTONES = [
  {
    id: 'care', label: 'Establish a dependable way to care for your friend',
    test: s => f(s, 'feederBuilt') && f(s, 'feederStocked') && f(s, 'nameRevealed') && p(s, 'feeds') >= 10,
    detail: s => !f(s, 'surplusDeal') ? 'Get to know the town, learn a practical skill, and arrange regular food collections.'
      : !f(s, 'cooler') ? 'Save $65 for a cooler; food needs a place of its own.'
      : !f(s, 'shelter') ? 'Practice practical skills, then repair the old shed for $55.'
      : !f(s, 'feederBuilt') ? 'Reach Practical 3 and save $90 to build a feeder.'
      : !f(s, 'feederStocked') ? 'Collect four bags and stock the feeder.'
      : !f(s, 'nameRevealed') ? 'Stay close to your friend. There is something he wants to say.'
      : `${Math.min(10, p(s, 'feeds'))}/10 meals shared · A dependable feeding apparatus`
  },
  {
    id: 'career', label: 'Build a career and a model of your own',
    test: s => f(s, 'employed') && f(s, 'promoted') && f(s, 'modelLaunched'),
    detail: s => !f(s, 'course') ? 'Learn some coding and finance, then save $45 for the evening course.'
      : p(s, 'lessons') < 3 ? `${p(s, 'lessons')}/3 course modules completed`
      : p(s, 'portfolio') < 3 ? `${p(s, 'portfolio')}/3 portfolio sessions completed`
      : !f(s, 'portfolioReviewed') ? 'Ask the tutor to review your finished project.'
      : !f(s, 'employed') ? 'An interview is waiting. You have work you can show.'
      : !f(s, 'promoted') ? `${Math.min(3, p(s, 'work'))}/3 days at the company · Grow your coding and finance skills`
      : p(s, 'model') < 3 ? `${p(s, 'model')}/3 sessions on your own predictive model`
      : !f(s, 'modelLaunched') ? 'Find a first client for a cautious pilot.'
      : 'A fintech career and an independent model'
  },
  {
    id: 'relationship', label: 'Make a life with PERSON',
    test: s => f(s, 'relationship') && bond(s, 'person') >= 11,
    detail: s => !f(s, 'metPerson') ? 'Spend time in town. Say hello when someone looks up.'
      : p(s, 'lies') > 0 ? 'There is a lie between you. Correct it before asking for more trust.'
      : !f(s, 'cafe') ? 'Get to know PERSON, then invite them for coffee.'
      : !f(s, 'walk') ? 'Make time for a walk together.'
      : !f(s, 'confided') ? 'Tell PERSON something true about how you have been.'
      : !f(s, 'honestWithPerson') ? 'Be honest about your absences and what you cannot yet explain.'
      : !f(s, 'romance') ? 'Tell PERSON what they mean to you.'
      : !f(s, 'relationship') ? 'Talk about the ordinary details of a shared life.'
      : 'A relationship you both chose'
  },
  {
    id: 'learning', label: 'Develop coding, finance, social, and practical skills',
    test: s => skill(s, 'coding') >= 4 && skill(s, 'finance') >= 3 && skill(s, 'social') >= 3 && skill(s, 'practical') >= 3,
    detail: s => `Coding ${Math.min(4, skill(s, 'coding')).toFixed(1)}/4 · Finance ${Math.min(3, skill(s, 'finance')).toFixed(1)}/3 · Social ${Math.min(3, skill(s, 'social')).toFixed(1)}/3 · Practical ${Math.min(3, skill(s, 'practical')).toFixed(1)}/3`
  }
];

export const ACTIONS = [
  {
    id: 'buy_food', label: 'Buy groceries', category: 'care', subcategory: 'supplies', duration: 1,
    description: 'Three bags of food. The shop is still open.', requirement: 6,
    when: available(s => s.money >= 18), weight: s => s.food < 2 ? 12 : 2,
    desire: s => s.stats.hunger > 48 && s.food < 2 ? 0.82 : 0.32,
    effects: () => ({ money: -18, food: 3 }),
    outcome: s => scene("The grocery store", vary(s, ["Beneath the fluorescent lights, everything looks edible. You buy three bags of food.", "The cashier asks whether you are having people over. You say something like that.", "You compare the prices, then the weights. For a moment you can smell the food through its packaging."], "buy_food"))
  },
  {
    id: 'feed_friend', label: 'Feed your friend', category: 'care', subcategory: 'feeding', duration: 2,
    description: 'Take one bag down the path. You can feel the waiting.', requirement: 4,
    when: available(s => s.food >= 1), weight: s => 4 + s.stats.hunger / 4,
    desire: s => Math.min(0.99, 0.35 + s.stats.hunger / 110), neglect: 1.8,
    effects: () => ({ food: -1, hunger: -34, rapture: 6, relationships: { friend: 1 }, progress: { feeds: 1 } }),
    outcome: s => scene(f(s, 'nameRevealed') ? 'Glizglat' : 'Your friend', p(s, 'feeds') === 0 ? "You lower the food into the dark.\n\n*thank you*\n\nThe relief reaches your stomach.\n\nYou have not eaten.\n\nYou stand very still until it passes." : vary(s, ["He waits for your hand to clear the opening. Then the sound starts.","The bag is empty. Then comes the same question: *can I have some more?*","A pale fold touches the bag. For a moment you are the one trying not to hurt your hand.","You say hello before lowering the food. He answers before you finish."], 'feed_friend'), p(s, 'feeds') === 0 ? 'scene' : undefined)
  },
  {
    id: 'ask_friend', label: 'Ask your friend a question', category: 'care', subcategory: 'understanding', duration: 1,
    description: 'There are things you would like to know.', requirement: 24,
    when: available(s => p(s, 'feeds') >= 1), weight: 4, desire: 0.45,
    effects: () => ({ disquiet: 2, relationships: { friend: 1 }, progress: { questions: 1 } }),
    outcome: s => scene("A question", vary(s, ["“Where did you come from?” *I don’t know.* You receive an impression of distance without direction.", "“What are you?” *I don’t know.* Then the question comes back to you.", "“Does it hurt?” He cannot answer, but an ache fills your jaw. You move the stone pressing against him; the ache stops."], "ask_friend"))
  },
  {
    id: 'sit_friend', label: 'Stay a little longer', category: 'care', subcategory: 'company', duration: 2,
    description: 'You do not have to bring something every time.', requirement: 16,
    when: available(s => p(s, 'feeds') >= 2 && s.stats.hunger < 65), weight: 3, desire: 0.61,
    effects: () => ({ rapture: 5, relationships: { friend: 1 } }),
    outcome: s => scene("Company", vary(s, ["You tell him about the unpaid bills. He listens with the same attention he gives to the birds.", "A bird lands beside you. For a moment you see it without knowing what a bird is.", "You think about leaving and feel a small hurt. You stay another hour."], "sit_friend"))
  },
  {
    id: 'search_surplus', label: 'Ask for surplus food', category: 'town', subcategory: 'asking', duration: 3,
    description: 'The market throws away things that are still good. Asking is harder than looking.', requirement: 25,
    when: available(() => true), weight: s => s.money < 18 || s.food < 1 ? 12 : 2, desire: s => s.stats.hunger > 55 ? 0.8 : 0.34,
    effects: () => ({ food: 2, disquiet: 3, skills: { social: 0.5 }, relationships: { town: 1 } }),
    outcome: s => scene("At the back door", vary(s, ["You have to ask twice before the market worker can hear you. She brings out the bread they were going to throw away.", "Bruised fruit and a split sack of oats. Nobody asks who they are for.", "The worker remembers you. You help her carry the empty crates inside before taking the food."], "search_surplus"))
  },
  {
    id: 'arrange_surplus', label: 'Arrange a regular collection', category: 'care', subcategory: 'logistics', duration: 3,
    description: 'A deposit and a promise to collect on time. Food that can be counted on.', requirement: 32,
    when: available(s => !f(s, 'surplusDeal') && bond(s, 'town') >= 2 && skill(s, 'practical') >= 1 && s.money >= 35), weight: 7, desire: 0.67,
    effects: () => ({ money: -35, disquiet: 3, skills: { practical: 0.5 }, flags: { surplusDeal: true } }),
    outcome: s => scene("An arrangement", "You pay the deposit and agree to return the crates. The manager writes your name on the collection list. You can start buying surplus food in bulk.")
  },
  {
    id: 'collect_surplus', label: 'Collect the food crates', category: 'care', subcategory: 'supplies', duration: 2,
    description: 'Six bags’ worth, packed together. Your arrangement is paying off.', requirement: 8,
    when: available(s => f(s, 'surplusDeal') && s.money >= 18), weight: s => s.food < 3 ? 13 : 2, desire: s => s.food < 2 && s.stats.hunger > 45 ? 0.9 : 0.42,
    effects: () => ({ money: -18, food: 6 }),
    outcome: s => scene("The collection", vary(s, ["Your name is already on the crate. You return the empties and take the food.", "“You’re reliable,” the manager says. You have arrived when you said you would.", "You know the weight of the crate before lifting it. You check the label anyway."], "collect_surplus"))
  },
  {
    id: 'buy_cooler', label: 'Buy a secondhand cooler', category: 'care', subcategory: 'storage', duration: 2,
    description: 'Keep the food fresh between visits. It costs $65.', requirement: 22,
    when: available(s => !f(s, 'cooler') && skill(s, 'practical') >= 1 && s.money >= 65 && p(s, 'feeds') >= 3), weight: 7, desire: 0.61,
    effects: () => ({ money: -65, flags: { cooler: true } }),
    outcome: s => scene("Cold storage", "The cooler smells faintly of the sea. You scrub it and replace the seal. The next delivery will stay fresh.")
  },
  {
    id: 'repair_shelter', label: 'Prepare the old shed', category: 'care', subcategory: 'construction', duration: 4,
    description: 'The disused allotment shed has room below its floor. Repair the roof and clear a way in. $55.', requirement: 38,
    when: available(s => !f(s, 'shelter') && skill(s, 'practical') >= 2 && bond(s, 'friend') >= 4 && s.money >= 55), weight: 7, desire: 0.68,
    effects: () => ({ money: -55, disquiet: 4, skills: { practical: 1 }, flags: { shelter: true } }),
    outcome: s => scene("More room", "You lift the rotten floorboards and patch the roof. Your friend unfolds into the space beneath the shed. He is larger than you had let yourself notice.")
  },
  {
    id: 'build_feeder', label: 'Build a feeding apparatus', category: 'care', subcategory: 'invention', duration: 5,
    description: 'A chute, a covered reservoir, a dependable release. Use the cooler and shed. $90.', requirement: 44,
    when: available(s => !f(s, 'feederBuilt') && f(s, 'cooler') && f(s, 'shelter') && f(s, 'surplusDeal') && skill(s, 'practical') >= 3 && s.money >= 90), weight: 10, desire: 0.74,
    effects: () => ({ money: -90, disquiet: 4, skills: { practical: 1 }, flags: { feederBuilt: true } }),
    outcome: s => scene("The release", "The first release jams.\n\nYou take it apart and file the edge.\n\nYour friend stays still while you work.\n\nThe second release opens cleanly.\n\nFood falls.\n\nYou can feel him trying to understand the machine that has learned to feed him.", "scene")
  },
  {
    id: 'stock_feeder', label: 'Stock and run the feeder', category: 'care', subcategory: 'feeding', duration: 2,
    description: 'Load four bags and run a long feeding cycle.', requirement: 8,
    when: available(s => f(s, 'feederBuilt') && s.food >= 4), weight: s => 5 + s.stats.hunger / 5, desire: s => Math.min(0.98, 0.48 + s.stats.hunger / 130), neglect: 1.8,
    effects: () => ({ food: -4, hunger: -68, rapture: 7, relationships: { friend: 1 }, progress: { feeds: 2, stocked: 1 }, flags: { feederStocked: true } }),
    outcome: s => scene("The apparatus", vary(s, ["The hopper empties a little at a time. You clean the chute before going home.", "You sit on the step while the release clicks. He has begun to recognize the sound.", "There is less clearance beneath the shed. You note the measurements; he has grown again."], "stock_feeder"))
  },
  {
    id: 'learn_name', label: 'Listen for his name', category: 'care', subcategory: 'recognition', duration: 2,
    description: 'There is something your friend has been trying to say.', requirement: 36,
    when: available(s => !f(s, 'nameRevealed') && p(s, 'feeds') >= 6 && bond(s, 'friend') >= 7), weight: 12, desire: 0.82,
    effects: () => ({ disquiet: 4, rapture: 8, relationships: { friend: 2 }, flags: { nameRevealed: true } }),
    outcome: s => scene('GLIZGLAT', "A sound arrives with no voice behind it.\n\n*GLIZGLAT*\n\n“Is that your name?”\n\n*I think so*\n\nFor a moment you are somewhere without light or distance.\n\nYou know that he has been there.\n\n" + (f(s, 'shelter') ? 'Then you are beside the shed again.' : 'Then you are at the edge of the hole again.') + "\n\n“Gliz,” you say.\n\nHe turns toward you.", 'scene')
  },
  {
    id: 'temporary_shift', label: 'Take a temporary shift', category: 'work', subcategory: 'labor', duration: 4,
    description: 'Stock shelves, wash dishes, carry boxes. Earn $24.', requirement: 18,
    when: available(() => true), weight: s => s.money < 35 ? 12 : f(s, 'employed') ? 1 : 6, desire: s => s.money < 18 ? 0.75 : 0.3,
    effects: () => ({ money: 24, disquiet: 2, progress: { shifts: 1 } }),
    outcome: s => scene("A shift", vary(s, ["You stock shelves until your arms shake. At the end of the shift, you are paid.", "The supervisor gives you another room to clean. She checks it, thanks you, and signs the timesheet.", "You know how many boxes remain without counting. The number disappears when someone speaks to you."], "temporary_shift"))
  },
  {
    id: 'learn_code', label: 'Practice coding', category: 'learning', subcategory: 'coding', duration: 3,
    description: 'One lesson, one small program. Let it be difficult.', requirement: 26,
    when: available(s => skill(s, 'coding') < 8), weight: s => skill(s, 'coding') < 4 ? 7 : 2, desire: 0.46,
    effects: () => ({ disquiet: 3, skills: { coding: 1 } }),
    outcome: s => scene("A small program", vary(s, ["The error is on line eleven. When you fix it, the program runs for the first time.", "You write a script to count the food going out and the money coming in. Then you fix what happens when either reaches zero.", "Three solutions occur to you at once. You test the one you understand before attempting the others."], "learn_code"))
  },
  {
    id: 'study_finance', label: 'Study financial systems', category: 'learning', subcategory: 'finance', duration: 3,
    description: 'Payments, ledgers, uncertainty. Follow the movement of ordinary money.', requirement: 26,
    when: available(s => skill(s, 'finance') < 7), weight: s => skill(s, 'finance') < 3 ? 7 : 2, desire: 0.42,
    effects: () => ({ disquiet: 3, skills: { finance: 1 } }),
    outcome: s => scene("The ledger", vary(s, ["You follow a payment from buyer to seller. Five systems have to agree before either person can forget about it.", "The exercise asks you to price a risk. You write down who carries it if the estimate is wrong.", "You reconstruct a shop’s cash flow. Deliveries on Tuesday; wages on Friday; very little room between them."], "study_finance"))
  },
  {
    id: 'enroll_course', label: 'Enroll in the fintech course', category: 'work', subcategory: 'commitment', duration: 2,
    description: 'A subsidized evening course. A real deadline. The fee is $45.', requirement: 37,
    when: available(s => !f(s, 'course') && skill(s, 'coding') >= 1 && skill(s, 'finance') >= 1 && s.money >= 45), weight: 10, desire: 0.7,
    effects: () => ({ money: -45, disquiet: 4, flags: { course: true } }),
    outcome: s => scene("Your name on the list", "You finish the application instead of closing it. The course fee leaves your account. The first assignment arrives immediately.")
  },
  {
    id: 'course_lesson', label: 'Attend the evening course', category: 'learning', subcategory: 'classroom', duration: 3,
    description: 'Work through the next module with people who are learning too.', requirement: 31,
    when: available(s => f(s, 'course') && p(s, 'lessons') < 3), weight: 10, desire: 0.58,
    effects: () => ({ disquiet: 3, skills: { coding: 0.5, finance: 0.5 }, progress: { lessons: 1 } }),
    outcome: s => scene("The evening course", ["You introduce yourself to the class. Later, you help the person beside you find a missing bracket.", "The tutor changes the test data and your model fails. You spend the rest of class finding the assumption that broke it.", "You finish the reconciliation assignment and write down its limits. The tutor asks whether you have thought about making a portfolio."][Math.min(2, p(s, 'lessons'))])
  },
  {
    id: 'portfolio_project', label: 'Build your portfolio project', category: 'work', subcategory: 'craft', duration: 4,
    description: 'Make a useful tool, then make it dependable. Three focused sessions.', requirement: 38,
    when: available(s => p(s, 'lessons') >= 3 && p(s, 'portfolio') < 3), weight: 11, desire: 0.61,
    effects: () => ({ disquiet: 3, skills: { coding: 0.5 }, progress: { portfolio: 1 } }),
    outcome: s => scene("Your portfolio", ["Your tool finds mismatched payments. It also flags correct ones; you start a list of cases to fix.", "You test duplicate entries, missing dates, and payments that almost agree. The list of failures gets shorter.", "You publish the project with examples and clear limits. You check the link from another browser: it is really there."][Math.min(2, p(s, 'portfolio'))])
  },
  {
    id: 'portfolio_review', label: 'Ask for a portfolio review', category: 'work', subcategory: 'feedback', duration: 2,
    description: 'Send your work to the course tutor. Let someone find its weaknesses.', requirement: 44,
    when: available(s => p(s, 'portfolio') >= 3 && !f(s, 'portfolioReviewed')), weight: 12, desire: 0.64,
    effects: () => ({ disquiet: 4, skills: { social: 1, coding: 0.5 }, flags: { portfolioReviewed: true } }),
    outcome: s => scene("The review", "The tutor finds two problems and one thing she likes. You fix the problems. She sends you a listing for a junior role at a payments company.")
  },
  {
    id: 'job_interview', label: 'Go to the interview', category: 'work', subcategory: 'exposure', duration: 3,
    description: 'A junior fintech role. Bring the project you can explain.', requirement: 48,
    when: available(s => f(s, 'portfolioReviewed') && !f(s, 'employed') && skill(s, 'coding') >= 3 && skill(s, 'finance') >= 2), weight: 14, desire: 0.77,
    effects: () => ({ disquiet: 5, rapture: 5, skills: { social: 1 }, flags: { employed: true } }),
    outcome: s => scene("The call", "They ask why you made the tool.\n\nYou explain what it does.\n\nThey ask again.\n\n“Because I wanted to make something useful.”\n\nLater, your phone rings.\n\nThe salary would cover the rent and the food.\n\nYou say yes.\n\nAfter the call, you write the number down.", "scene")
  },
  {
    id: 'salaried_work', label: 'Work at the payments company', category: 'work', subcategory: 'employment', duration: 4,
    description: 'Investigate errors, improve a system, earn your pay.', requirement: 21,
    when: available(s => f(s, 'employed')), weight: s => s.money < 80 ? 12 : 6, desire: 0.46,
    effects: s => ({ money: f(s, 'promoted') ? 92 : 58, disquiet: 1, skills: { coding: 0.2, finance: 0.2 }, progress: { work: 1 } }),
    outcome: s => scene("At work", vary(s, ["A shop’s payments stopped reconciling. You find the error and fix it. The owner can pay her staff.", "Someone asks for your opinion in a meeting. You answer before remembering to be nervous.", "You see the fault before you can explain it. Writing the steps down takes the rest of the afternoon."], "salaried_work"))
  },
  {
    id: 'report_mistake', label: 'Report your mistake', category: 'work', subcategory: 'accountability', duration: 2,
    description: 'A report you shipped contains an error. Owning it will be uncomfortable.', requirement: 42,
    when: available(s => f(s, 'employed') && p(s, 'work') >= 1 && !f(s, 'mistakeResolved')), weight: 8, desire: 0.55,
    effects: () => ({ disquiet: 5, skills: { finance: 0.5 }, flags: { mistakeResolved: true, honestAtWork: true } }),
    outcome: s => scene("The corrected report", "You tell your manager about the error. She asks you to show her, and you spend the afternoon fixing it together.")
  },
  {
    id: 'conceal_mistake', label: 'Quietly replace the report', category: 'work', subcategory: 'concealment', duration: 1,
    description: 'Remove the evidence and let a colleague take the questions.', requirement: 0, ethics: 9,
    when: available(s => f(s, 'employed') && p(s, 'work') >= 1 && !f(s, 'mistakeResolved')), weight: 5, desire: 0.73,
    effects: () => ({ disquiet: 6, rapture: -3, flags: { mistakeResolved: true, concealedMistake: true } }),
    outcome: s => scene("A clean copy", "You replace the report without telling anyone. The questions go to your colleague. You let them.")
  },
  {
    id: 'correct_work_lie', label: 'Tell your manager what happened', category: 'work', subcategory: 'restitution', duration: 2,
    description: 'The colleague you left answering for your error deserves the truth.', requirement: 15, challenge: 5,
    when: available(s => f(s, 'concealedMistake')), weight: 10, desire: 0.56,
    effects: () => ({ disquiet: 6, rapture: -1, skills: { social: 0.5 }, flags: { concealedMistake: false, honestAtWork: true } }),
    outcome: s => scene("The record", "You tell your manager whose error it was. Then you apologize to your colleague. They ask you to correct the record in writing.")
  },
  {
    id: 'promotion', label: 'Take responsibility for a system', category: 'work', subcategory: 'responsibility', duration: 3,
    description: 'Your manager offers you a larger role, with better pay and real obligations.', requirement: 49,
    when: available(s => f(s, 'employed') && !f(s, 'promoted') && p(s, 'work') >= 3 && skill(s, 'coding') >= 4 && skill(s, 'finance') >= 3), weight: 14, desire: 0.77,
    effects: () => ({ disquiet: 4, rapture: 5, money: 65, flags: { promoted: true } }),
    outcome: s => scene("Responsibility", "You explain a failure before it happens.\n\nYour manager asks you to take responsibility for the system.\n\nThe raise will pay for larger food deliveries.\n\nThe mistakes will be yours to answer for.\n\nYou accept.", "scene")
  },
  {
    id: 'build_model', label: 'Develop your own predictive model', category: 'learning', subcategory: 'research', duration: 4,
    description: 'Use public data and your own time. Build, test, then test on data it has never seen.', requirement: 45,
    when: available(s => f(s, 'promoted') && p(s, 'model') < 3), weight: 12, desire: 0.73,
    effects: () => ({ disquiet: 4, skills: { coding: 0.5, finance: 0.5 }, progress: { model: 1 } }),
    outcome: s => scene("Your own model", ["You gather public records of late payments. The first task is to separate useful information from information that only looks useful.", "The model performs well until you change the test data. You rebuild it around the failure you can reproduce.", "It works on records you have kept aside. You document where it fails and prepare a small pilot."][Math.min(2, p(s, 'model'))])
  },
  {
    id: 'launch_model', label: 'Pilot the model independently', category: 'work', subcategory: 'independence', duration: 3,
    description: 'A local business will pay for a cautious pilot. Set limits and keep a person in the loop.', requirement: 50,
    when: available(s => p(s, 'model') >= 3 && !f(s, 'modelLaunched')), weight: 15, desire: 0.79,
    effects: () => ({ money: 160, disquiet: 4, rapture: 6, flags: { modelLaunched: true } }),
    outcome: s => scene("The first client", "Your model finds a gap in a small business’s cash flow.\n\nEarly enough for someone to make a phone call.\n\nThe payment comes through.\n\nYour client pays you.\n\nYou open a new account for the work and transfer some money to the food budget.\n\nThere are more businesses with this problem.\n\nYou know what you will try next.", "scene")
  },
  {
    id: 'go_town', label: 'Go into town', category: 'town', subcategory: 'presence', duration: 2,
    description: 'Be somewhere other people are. You do not need a reason.', requirement: 23,
    when: available(() => true), weight: s => !f(s, 'metPerson') ? 8 : 4, desire: 0.52,
    effects: () => ({ rapture: 4, relationships: { town: 1 }, progress: { townVisits: 1 } }),
    outcome: s => scene("Town", vary(s, ["A child is trying to persuade a pigeon to become a pet. The pigeon takes the crumbs and leaves.", "You hold the florist’s door while she carries the buckets inside. She remembers your face the next time you pass.", "The librarian finds a pressed leaf in a returned book and shows it to you. You both try to identify it.", "At the crossing, a stranger warns you about the loose paving stone. You step around it together."], "go_town"))
  },
  {
    id: 'meet_person', label: 'Say hello to PERSON', category: 'relationship', subcategory: 'introduction', duration: 2,
    description: 'You have seen them outside the library before. This time they look up.', requirement: 42,
    when: available(s => !f(s, 'metPerson') && bond(s, 'town') >= 1), weight: 14, desire: 0.78,
    effects: () => ({ disquiet: 4, rapture: 5, skills: { social: 1 }, relationships: { person: 1 }, flags: { metPerson: true } }),
    outcome: s => scene("PERSON", "You ask about the book they are holding. They turn it over to show you the title and introduce themselves: PERSON. When you leave, they say they hope to see you again.")
  },
  {
    id: 'talk_person', label: 'Talk with PERSON', category: 'relationship', subcategory: 'conversation', duration: 2,
    description: 'Ask a question. Stay for the answer.', requirement: 32,
    when: available(s => f(s, 'metPerson')), weight: s => !f(s, 'cafe') ? 10 : 4, desire: s => Math.min(0.86, 0.59 + bond(s, 'person') / 80),
    effects: () => ({ rapture: 5, skills: { social: 0.5 }, relationships: { person: 1 }, progress: { conversations: 1 } }),
    outcome: s => scene("A conversation", vary(s, ["PERSON tells you the town clock has been four minutes slow for years. They keep meaning to write to someone about it.", "You disagree about the book. PERSON makes you explain which part annoyed you; by the end, they have nearly changed your mind.", "PERSON asks about your day. You give the short answer, then tell them what actually happened.", "They remember something you mentioned last time and ask how it turned out. You had not expected them to keep it."], "talk_person"))
  },
  {
    id: 'cafe_person', label: 'Ask PERSON for coffee', category: 'relationship', subcategory: 'invitation', duration: 2,
    description: 'A small invitation. Coffee for two costs $10.', requirement: 43,
    when: available(s => f(s, 'metPerson') && !f(s, 'cafe') && p(s, 'conversations') >= 2 && bond(s, 'person') >= 3 && s.money >= 10), weight: 13, desire: 0.82,
    effects: () => ({ money: -10, disquiet: 3, rapture: 7, relationships: { person: 2 }, flags: { cafe: true } }),
    outcome: s => scene("Two cups", "PERSON says yes before you finish making the invitation sound casual. They fold a receipt beneath the café’s wobbling table. You stay after both cups are empty.")
  },
  {
    id: 'walk_person', label: 'Walk with PERSON', category: 'relationship', subcategory: 'closeness', duration: 3,
    description: 'Take the long way through town, then along the edge of the woods.', requirement: 39,
    when: available(s => f(s, 'cafe') && !f(s, 'walk')), weight: 13, desire: 0.83,
    effects: () => ({ disquiet: 2, rapture: 7, relationships: { person: 2 }, flags: { walk: true } }),
    outcome: s => scene("The long way", "PERSON touches your sleeve to point out a deer. You feel the touch somewhere else as well, and stop walking. They wait until you are ready to continue.")
  },
  {
    id: 'confide_person', label: 'Tell PERSON how you have been', category: 'relationship', subcategory: 'vulnerability', duration: 3,
    description: 'The room. The isolation. The mornings when beginning is difficult.', requirement: 51,
    when: available(s => f(s, 'walk') && !f(s, 'confided')), weight: 14, desire: 0.79,
    effects: () => ({ disquiet: 6, rapture: 8, relationships: { person: 2 }, flags: { confided: true } }),
    outcome: s => scene("Telling someone", "You tell PERSON about the room.\n\nThe unopened bills.\n\nWaking early and being unable to begin.\n\nYou try to make it sound like something you have already overcome.\n\nThen you stop doing that.\n\nPERSON stays beside you.\n\n“Thank you for telling me.”", "scene")
  },
  {
    id: 'honest_limit', label: 'Be honest about what you cannot explain', category: 'relationship', subcategory: 'boundaries', duration: 2,
    description: 'PERSON has noticed your absences. Tell the truth you can tell, and admit its limits.', requirement: 48,
    when: available(s => f(s, 'confided') && !f(s, 'honestWithPerson') && bond(s, 'person') >= 7), weight: 14, desire: 0.78,
    effects: () => ({ disquiet: 5, rapture: 5, relationships: { person: 2 }, flags: { honestWithPerson: true } }),
    outcome: s => scene("What you can promise", "You tell PERSON that someone depends on you, and you cannot explain it yet. They ask you to say when you are leaving instead of disappearing. You agree.")
  },
  {
    id: 'romance_person', label: 'Tell PERSON what they mean to you', category: 'relationship', subcategory: 'romance', duration: 3,
    description: 'Let this become something you have both chosen.', requirement: 52,
    when: available(s => f(s, 'confided') && f(s, 'honestWithPerson') && !f(s, 'romance') && bond(s, 'person') >= 9 && p(s, 'lies') === 0), weight: 15, desire: 0.9,
    effects: () => ({ disquiet: 4, rapture: 10, relationships: { person: 2 }, flags: { romance: true } }),
    outcome: s => scene('Closer', "You tell PERSON you want to be with them.\n\nThey look at you long enough for you to begin taking it back.\n\n“Don’t,” they say.\n\n“I was hoping.”\n\nThey take your hand and kiss you.\n\nFar away, " + (f(s, 'nameRevealed') ? 'Gliz' : 'your friend') + " is very still.\n\nYou cannot tell how much he understands.", 'scene')
  },
  {
    id: 'commit_person', label: 'Make room for a shared life', category: 'relationship', subcategory: 'commitment', duration: 4,
    description: 'Talk about time, money, keys, and what you owe each other.', requirement: 51,
    when: available(s => f(s, 'romance') && !f(s, 'relationship') && bond(s, 'person') >= 11 && p(s, 'lies') === 0), weight: 15, desire: 0.88,
    effects: () => ({ disquiet: 4, rapture: 9, relationships: { person: 2 }, flags: { relationship: true } }),
    outcome: s => scene("A spare key", "You talk about money and time.\n\nWhich evenings are yours.\n\nWhat to do when one of you needs to be alone.\n\nPERSON clears a drawer.\n\nYou bring a mug you like.\n\nBefore you leave for the woods, you say when you expect to be back.\n\nThey give you a key.", "scene")
  },
  {
    id: 'time_person', label: 'Spend the evening with PERSON', category: 'relationship', subcategory: 'presence', duration: 3,
    description: 'An ordinary evening is still something you have to choose.', requirement: 31,
    when: available(s => f(s, 'cafe')), weight: 6, desire: s => f(s, 'relationship') ? 0.87 : 0.74, neglect: 1.6,
    effects: () => ({ rapture: 7, relationships: { person: 1 } }),
    outcome: s => scene("An evening", vary(s, ["PERSON washes the dishes while you dry. You tell them about the difficult part of your day.", "Neither of you likes the film. Complaining about it becomes the evening.", "PERSON has had a bad day. You ask whether they want advice; they do not. You listen.", "The telephone rings. You let the answering machine take it while PERSON makes another pot of coffee."], "time_person"))
  },
  {
    id: 'lie_person', label: 'Tell PERSON you were working', category: 'relationship', subcategory: 'deception', duration: 1,
    description: 'An easy explanation for an absence. Let them believe it.', requirement: 0, ethics: 8,
    when: available(s => f(s, 'metPerson') && p(s, 'lies') < 3), weight: s => s.stats.choice < 35 ? 10 : 3, desire: 0.75,
    effects: () => ({ disquiet: 5, rapture: -3, relationships: { person: -1 }, progress: { lies: 1 } }),
    outcome: s => scene("An easy answer", vary(s, ["“Work ran late.” PERSON believes you and asks whether you have eaten.", "You invent a problem at work. PERSON tells you not to let them take advantage of you.", "The explanation is ready before they ask. It is easier to say this time."], "lie_person"))
  },
  {
    id: 'repair_trust', label: 'Correct the lie', category: 'relationship', subcategory: 'repair', duration: 2,
    description: 'Tell PERSON you were not at work. Apologize without asking them to make it easy.', requirement: 18,
    when: available(s => f(s, 'metPerson') && p(s, 'lies') > 0), weight: 14, desire: 0.66, challenge: 5,
    effects: () => ({ disquiet: 6, rapture: -1, relationships: { person: 1 }, progress: { lies: -1 } }),
    outcome: s => scene("The correction", "You tell PERSON you were not at work. They ask why you lied; you answer without making it their fault. They will need time.")
  },
  {
    id: 'volunteer', label: 'Help at the community kitchen', category: 'town', subcategory: 'service', duration: 3,
    description: 'Other people are hungry too. Take a shift preparing food.', requirement: 30,
    when: available(s => bond(s, 'town') >= 1), weight: 5, desire: 0.56,
    effects: () => ({ disquiet: 3, rapture: 5, skills: { social: 0.5, practical: 0.5 }, relationships: { town: 2 } }),
    outcome: s => scene("The kitchen", vary(s, ["Someone shows you where the knives live. You prepare vegetables until the first guests arrive.", "You peel potatoes beside a man telling a long story about his dog. By the end, lunch is ready.", "You serve someone you have passed in the street for years. Now you know their name."], "volunteer"))
  },
  {
    id: 'accept_help', label: 'Let someone help you', category: 'self', subcategory: 'dependence', duration: 2,
    description: 'You have been offered a meal and some company. Accepting feels strangely difficult.', requirement: 12,
    when: available(s => bond(s, 'town') >= 3 || bond(s, 'person') >= 3), weight: s => s.stats.disquiet > 55 || s.stats.choice < 30 ? 12 : 3, desire: 0.64, challenge: 5,
    effects: () => ({ disquiet: 3, hunger: -15, rapture: 8, relationships: { town: 1 } }),
    outcome: s => scene('A meal you did not make', vary(s, f(s, 'metPerson') ? ["PERSON puts a plate in front of you. You start explaining why you have not looked after yourself. “Eat first,” they say.", "PERSON brings extra portions and puts them in your fridge. You eat one without promising to repay them immediately.", "You call PERSON instead of waiting for them to notice. They ask what would help, and you ask them to bring dinner.", "You let PERSON take a turn cooking. When they tell you to sit down, you do."] : ["The woman from the kitchen pulls out a chair for you. You sit down and eat with the others.", "A volunteer sets aside a portion for you. You accept it before beginning to explain why you should not.", "You come to the kitchen for a meal instead of a shift. Nobody asks you to work first."], 'accept_help'))
  },
  {
    id: 'learn_practical', label: 'Learn to fix something', category: 'learning', subcategory: 'practical', duration: 3,
    description: 'Borrow tools from the library. Work on a hinge, a seal, a small machine.', requirement: 24,
    when: available(s => skill(s, 'practical') < 7), weight: s => skill(s, 'practical') < 3 ? 8 : 2, desire: 0.42,
    effects: () => ({ disquiet: 3, skills: { practical: 1 } }),
    outcome: s => scene("With your hands", vary(s, ["You take the hinge apart and briefly make it worse. After a few hours, the door closes properly.", "You borrow a toolkit from the library. The new seal leaks on your first attempt; the second holds.", "You cut the piece badly and file the edge until it fits. Knowing the shape does not teach your hands to make it."], "learn_practical"))
  },
  {
    id: 'practice_social', label: 'Practice being heard', category: 'learning', subcategory: 'social', duration: 2,
    description: 'Go to a small discussion at the library. Say one thing aloud.', requirement: 29,
    when: available(s => skill(s, 'social') < 7), weight: s => skill(s, 'social') < 3 ? 6 : 2, desire: 0.38,
    effects: () => ({ disquiet: 4, skills: { social: 1 }, relationships: { town: 1 } }),
    outcome: s => scene("Your turn", vary(s, ["You stop rehearsing your reply and listen. When your turn comes, you ask a question.", "Your voice shakes. Someone across the table answers your point, and the discussion continues.", "Halfway through disagreeing, you notice something you missed. You say so."], "practice_social"))
  },
  {
    id: 'library', label: 'Spend an hour at the library', category: 'self', subcategory: 'curiosity', duration: 2,
    description: 'Read something nobody requires you to read.', requirement: 13,
    when: available(() => true), weight: 3, desire: 0.45,
    effects: () => ({ rapture: 4, skills: { coding: 0.25, finance: 0.25 } }),
    outcome: s => scene("A borrowed book", vary(s, ["You find a diagram made by someone long dead. One handwritten correction makes the whole thing understandable.", "You read until the librarian switches off half the lights. You borrow the book instead of rushing the last chapter.", "Someone has left a pencil mark beside a sentence you like. You wonder who they were."], "library"))
  },
  {
    id: 'make_budget', label: 'Look honestly at the budget', category: 'self', subcategory: 'accounting', duration: 2,
    description: 'Open the bills. Cancel one expense. Write down the cost of keeping going.', requirement: 22,
    when: available(() => true), weight: s => s.money < 30 ? 5 : 2, desire: 0.28,
    effects: () => ({ money: 6, disquiet: 3, skills: { practical: 0.5, finance: 0.25 } }),
    outcome: s => scene("The numbers", vary(s, ["You open the bills and cancel a forgotten subscription. The plan reaches as far as next week.", "You find one charge you can reduce. You leave money for your own food in the budget.", "The company reverses the charge after half an hour on the phone. You put the refund toward groceries."], "make_budget"))
  },
  {
    id: 'attend_meetup', label: 'Attend a developers’ meetup', category: 'town', subcategory: 'professional', duration: 3,
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
    id: 'shelter_rain', label: 'Wait out the rain with a stranger', category: 'town', subcategory: 'chance', duration: 1,
    description: 'The bus shelter has room for two. The rain is going nowhere.', requirement: 19,
    when: available(s => p(s, 'townVisits') >= 1), weight: 2, desire: 0.48,
    effects: () => ({ rapture: 4, relationships: { town: 1 } }),
    outcome: s => scene("Rain", vary(s, ["The man beside you predicts where the water will collect. He has been waiting at this bus stop for thirty years.", "A stranger is trying to keep a birthday cake dry. You help carry it to their car.", "You share the shelter without speaking. When the rain stops, the other person wishes you a good day."], "shelter_rain"))
  },
  {
    id: 'eat_meal', label: 'Make yourself a proper meal', category: 'self', subcategory: 'nourishment', duration: 1,
    description: 'Something warm, eaten sitting down. $5.', requirement: 9,
    when: available(s => s.money >= 5), weight: s => s.stats.disquiet > 60 ? 6 : 3, desire: 0.58,
    effects: () => ({ money: -5, hunger: -14, rapture: 5 }),
    outcome: s => scene("At the table", vary(s, ["You make something warm and eat it sitting down. Some of the hunger remains.", "You put the food on a plate instead of eating from the pan. This time you taste it.", "The first bite is too hot. You wait and try again."], "eat_meal"))
  },
  {
    id: 'clean_room', label: 'Put your room in order', category: 'self', subcategory: 'maintenance', duration: 2,
    description: 'Start with one surface. You do not have to fix your life before washing a cup.', requirement: 17,
    when: available(() => true), weight: 3, desire: 0.32,
    effects: () => ({ disquiet: 2, rapture: 3, skills: { practical: 0.5 } }),
    outcome: s => scene("The room", vary(s, ["You collect the cups and clear the table. Then you open the window.", "You fill a bag with things you have been meaning to throw away. There is more floor than you remembered.", "You wash one plate, then the rest. They are ready for next time."], "clean_room"))
  },
  {
    id: 'rest', label: 'Get some real sleep', category: 'self', subcategory: 'rest', duration: 5,
    description: 'Close the curtains. Leave the unfinished things unfinished for a while.', requirement: 7,
    when: available(s => s.stats.hunger < 65), weight: s => s.stats.disquiet > 55 ? 9 : 2, desire: 0.56,
    effects: () => ({ disquiet: -11, rapture: 2 }),
    outcome: s => scene("Sleep", vary(s, ["You wake once with the impression of roots around you. Then you recognize your room and sleep again.", "You sleep through the delivery van outside. When you get up, you feel rested.", "You turn the telephone’s ringer down. The first restless minutes pass, and you fall asleep."], "rest"))
  },
  {
    id: 'television', label: 'Watch television', category: 'avoidance', subcategory: 'television', duration: 2,
    description: 'Let the room fill with other people’s voices.', requirement: 0,
    when: available(() => true), weight: s => s.stats.choice < 35 || s.stats.disquiet > 65 ? 8 : 2, desire: s => s.stats.disquiet > 65 ? 0.78 : 0.3,
    effects: () => ({ disquiet: -3, rapture: -1 }),
    outcome: s => scene("The television", vary(s, ["You watch television. You cannot remember what was on.", "The presenter laughs. An advertisement begins; you stay for the next program.", "You recognize the episode. You let it play anyway."], "television"))
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
    id: 'stage1_complete', label: 'Bring your lives together', category: 'chapter', subcategory: 'threshold', duration: 3,
    description: 'The work is yours. The feeder is running. PERSON is waiting. Choose a place for all of it.', requirement: 40,
    when: available(s => ready(s) && !f(s, 'stage1Complete')), weight: 100, desire: 0.9,
    effects: () => ({ rapture: 10, flags: { stage1Complete: true } }),
    outcome: s => scene("Home", "You finish the day’s work.\n\nAt the shed, the release is running cleanly.\n\n*thank you*\n\nAt home, PERSON has left a light on.\n\nYou put your key beside theirs.\n\nLater, you feel Glizglat move beneath the floor of the shed.\n\nHe is pressing against the space you made for him.\n\nYou look toward the room where PERSON is sleeping.\n\nThen toward the woods.\n\nTomorrow you will need more room.\n\n— END OF STAGE 1 —", "scene")
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
  }
];
