/* Optional town fiction. Everyone at the house is an adult.
 * Visits open a place to know people, never a required Stage 1 milestone.
 */
const f = (s, key) => Boolean(s.flags?.[key]);
const p = (s, key) => Number(s.progress?.[key] || 0);
const bond = (s, key) => Number(s.relationships?.[key] || 0);
const scene = (title, text) => ({ title, text });
const visits = (s, id) => s.progress?.[`visits_${id}`] ?? (s.history || []).filter(entry => entry.id === id).length;
const vary = (s, options, id) => options[visits(s, id) % options.length];
const available = predicate => s => !s.crisis && predicate(s);
const freeToday = (s, key) => !Object.hasOwn(s.progress || {}, key) || s.hours - p(s, key) >= 24;
const stamp = (s, key) => ({ [key]: s.hours - p(s, key) });
const foolTrust = s => !f(s, 'betrayedFoolName') && !f(s, 'blamedFool');


export const TOWN_ACTIONS = [
  {
    id: 'visit_brothel', system: 'social', label: 'Visit the brothel', category: 'social', subcategory: 'house', duration: 1,
    description: 'Past the tailor … tea, $3.', requirement: 8,
    when: available(s => p(s, 'townVisits') >= 1 && s.money >= 3), weight: s => f(s, 'visitedBrothel') ? 2 : 5, desire: 0.54,
    effects: () => ({ money: -3, rapture: 4, disquiet: -1, relationships: { madame: 1, town: 0.25 }, progress: { brothelVisits: 1 }, flags: { visitedBrothel: true, metMadame: true } }),
    outcome: s => scene('The house', !f(s, 'visitedBrothel')
      ? 'MADAME. Fifty-something … a hand on your arm.\n\nThree women work here. THE PRIESTESS. THE FOOL. THE SUN.\n\n“Tea first?”'
      : vary(s, [
        'The door ajar … MADAME lifts a hand.',
        'A coat over the banister … someone staying awhile.',
        'Your cup. Still chipped … still yours.',
        'Wet shoes by the stove … room for another pair.',
        'The same perfume … fresh towels underneath.',
        'MADAME counts change … stops when you speak.',
        'A woman leaving. Her collar straightened … by another woman.',
        'From upstairs, laughter … then the plumbing.',
        'The hall freshly swept … one missed hairpin.',
        'Two coats touch on the hook … their owners apart.',
        'The front room empty … a kettle nearly ready.',
        'You knock … though she said you needn’t.',
      ], 'visit_brothel')),
  },
  {
    id: 'tea_madame', system: 'social', label: 'Have tea with MADAME', category: 'social', subcategory: 'madame', duration: 1,
    description: 'Her feet up … another pot, $4.', requirement: 4,
    when: available(s => f(s, 'metMadame') && s.money >= 4), weight: 3, desire: 0.6,
    personality: { empathy: 0.025, caution: 0.015 },
    effects: () => ({ money: -4, rapture: 5, disquiet: -2, relationships: { madame: 1 }, progress: { madameTeas: 1 } }),
    outcome: s => scene('MADAME', vary(s, [
        '“How are you?” … she waits past “fine.”',
        'Your mother’s name … she remembers.',
        'Two biscuits … she gives you the larger.',
        'Her holiday brochure … folded at the cheapest room.',
        '“You look tired.” … no advice follows.',
        'Her glasses. You point … she laughs.',
        'The plumber’s bill … she smooths it twice.',
        'Tea gone cold … neither reaching for the pot.',
        'She takes her shoes off … a small groan.',
        'A question about your work … then another.',
        'You say too much … she pours.',
        'Her hand over yours … briefly.',
      ], 'tea_madame')),
  },
  {
    id: 'help_madame', system: 'social', label: 'Fix something around the house', category: 'social', subcategory: 'handiwork', duration: 2,
    description: 'A loose step … MADAME has tools.', requirement: 16, challenge: 3,
    when: available(s => f(s, 'metMadame')), weight: 3, desire: 0.4,
    personality: { empathy: 0.035, resolve: 0.035 },
    effects: () => ({ rapture: -3, disquiet: -1, lifestyle: 3, skills: { practical: 0.5 }, relationships: { madame: 1, town: 0.25 }, progress: { brothelRepairs: 1 } }),
    outcome: s => scene('Small repairs', vary(s, [
        'The drawer opens … old receipts, spare buttons.',
        'A hook secured … her winter coat holds.',
        'The chair steadier … you sit first.',
        'The tap stops … MADAME turns off the radio.',
        'The lampshade straight … she notices.',
        'A door that closes … without lifting.',
        'The shelf level … you put everything back.',
        'The wrong screwdriver … she brings three more.',
        'Paint beneath your nail … white, for days.',
        'The loose step … finally quiet.',
        'She holds the ladder … even after you climb down.',
        'Two screws left over … you find where.',
      ], 'help_madame')),
  },
  {
    id: 'meet_priestess', system: 'social', label: 'Meet THE PRIESTESS', category: 'social', subcategory: 'priestess', duration: 1,
    description: 'A candle … her hand shielding it.', requirement: 10,
    when: available(s => f(s, 'visitedBrothel') && !f(s, 'metPriestess')), weight: 6, desire: 0.58,
    effects: () => ({ rapture: 4, disquiet: 1, relationships: { priestess: 1 }, flags: { metPriestess: true } }),
    outcome: () => scene('THE PRIESTESS', 'Thirty-eight … a card tucked into her sleeve.\n\nYour palm in hers.\n\n“You came today … of all days.”'),
  },
  {
    id: 'reading_priestess', system: 'social', label: 'Sit for a reading', category: 'social', subcategory: 'priestess', duration: 1,
    description: 'Three cards … $8.', requirement: 8,
    when: available(s => f(s, 'metPriestess') && s.money >= 8), weight: 3, desire: 0.66,
    effects: () => ({ money: -8, rapture: 6, disquiet: 2, relationships: { priestess: 1 }, progress: { priestessReadings: 1 } }),
    outcome: s => scene('Three cards', vary(s, [
        'The tower … her finger stays there.',
        'The moon … “Something withheld.”',
        '“Someone is hungry.” … your hands under the table.',
        'The same card … she remembers last time.',
        '“A journey.” … you ask how far.',
        'One card left … she waits for you.',
        'You ask when … she says “soon.”',
        '“You carry something.” … you stop moving.',
        'Your question unfinished … she starts answering.',
        'A reversed card … she turns it upright.',
        '“It fits, doesn’t it?” … almost.',
        'She writes the date … underlines the prediction.',
      ], 'reading_priestess')),
  },
  {
    id: 'question_priestess', system: 'social', label: 'Ask THE PRIESTESS how she knows', category: 'social', subcategory: 'priestess', duration: 2,
    description: 'She seems certain … ask why.', requirement: 20, challenge: 3,
    when: available(s => f(s, 'metPriestess') && p(s, 'priestessReadings') >= 1), weight: 2, desire: 0.38,
    personality: { honesty: 0.035, caution: 0.05, resolve: 0.02 },
    effects: () => ({ rapture: -2, disquiet: -3, skills: { math: 0.2 }, relationships: { priestess: 0.75 }, progress: { priestessQuestions: 1 } }),
    outcome: s => scene('How she knows', vary(s, [
        '“I felt it.” … you ask about the misses.',
        'You write it down … word for word.',
        'The candle goes out … an open window.',
        'She predicted rain … you find yesterday’s forecast.',
        '“Would you tell anyone that?” … “Possibly.”',
        'The misses too … a longer list.',
        '“I don’t know.” … quietly.',
        'She thanks you … the cards stay down.',
        'You ask what would change her mind … she thinks.',
        'No reading today … just the question.',
        'She corrects one word … you cross it out.',
        'A coincidence … she still wants it kept.',
      ], 'question_priestess')),
  },
  {
    id: 'meet_fool', system: 'social', label: 'Meet THE FOOL', category: 'social', subcategory: 'fool', duration: 1,
    description: 'A laugh … she makes room.', requirement: 8,
    when: available(s => f(s, 'visitedBrothel') && !f(s, 'metFool')), weight: 6, desire: 0.64,
    effects: () => ({ rapture: 6, disquiet: -1, relationships: { fool: 1 }, flags: { metFool: true } }),
    outcome: () => scene('THE FOOL', 'Thirty-five … bare feet under a good dress.\n\n“First time?”\n\nYou hesitate.\n\n“That answers that.”'),
  },
  {
    id: 'jokes_fool', system: 'social', label: 'Trade terrible jokes', category: 'social', subcategory: 'fool', duration: 1,
    description: 'She has heard worse … from you.', requirement: 6,
    when: available(s => f(s, 'metFool') && foolTrust(s)), weight: 3, desire: 0.73,
    personality: { empathy: 0.025, resolve: 0.015 },
    effects: () => ({ rapture: 6, disquiet: -1, skills: { social: 0.2 }, relationships: { fool: 1 }, progress: { foolJokes: 1 } }),
    outcome: s => scene('THE FOOL', vary(s, [
        '“A man walks into a brothel …” She points at you.',
        'The mayor’s voice … exactly. You check the door.',
        'You forget the ending … she knows a worse one.',
        'Her joke. Your laugh … a second too late.',
        'A terrible accent … an apology, in the same accent.',
        'She laughs into her tea … you get the towel.',
        '“Knock knock.” … “We’re closed.”',
        'The joke worse on retelling … somehow funnier.',
        'She keeps a straight face … you cannot.',
        'You tell her one from work … she asks for names.',
        'The punchline whispered … MADAME hears anyway.',
        'A joke about herself … you don’t join in.',
      ], 'jokes_fool')),
  },
  {
    id: 'cards_fool', system: 'social', label: 'Play cards with THE FOOL', category: 'social', subcategory: 'fool', duration: 2,
    description: 'No money … just cards.', requirement: 12,
    when: available(s => f(s, 'metFool') && foolTrust(s)), weight: 3, desire: 0.56,
    personality: { caution: 0.025 },
    effects: () => ({ rapture: 4, skills: { math: 0.25 }, relationships: { fool: 1 }, progress: { foolGames: 1 } }),
    outcome: s => scene('A small game', vary(s, [
        'She loses … pushes the last biscuit over.',
        'You count cards … she watches your lips.',
        '“Beginner’s luck.” … again.',
        'The next card … not the one you expected.',
        'A queen under the sofa … dusty.',
        'Sugar cubes for the odds … you count again.',
        'You lose by one … ask for another hand.',
        'Three hands … no need to talk.',
        'A bent corner … she replaces the deck.',
        'She lets you look … then wins anyway.',
        'Your winning hand … she checks twice.',
        'The cards put away … you keep sitting.',
      ], 'cards_fool')),
  },
  {
    id: 'meet_sun', system: 'social', label: 'Meet THE SUN', category: 'social', subcategory: 'sun', duration: 1,
    description: 'A soft voice … come in.', requirement: 8,
    when: available(s => f(s, 'visitedBrothel') && !f(s, 'metSun')), weight: 6, desire: 0.7,
    effects: () => ({ rapture: 7, disquiet: -2, relationships: { sun: 1 }, flags: { metSun: true } }),
    outcome: () => scene('THE SUN', 'Forty-six … large, voluptuous. At ease.\n\nWarm hands. A loosened shoulder … she knows where.\n\n“Come sit, darling.”'),
  },
  {
    id: 'company_sun', system: 'social', label: 'Private company with THE SUN — $30', category: 'social', subcategory: 'sun', duration: 1,
    description: 'Her private hour costs $30. Touch only if wanted. One appointment a day.', requirement: 10,
    when: available(s => f(s, 'metSun') && !f(s, 'cancelledForSun') && s.money >= 30 && freeToday(s, 'sunCompanyAt')), weight: 3, desire: 0.82,
    personality: { empathy: 0.025 },
    effects: s => ({ money: -30, rapture: 25, disquiet: -3, relationships: { sun: 1 }, progress: { sunCompany: 1, ...stamp(s, 'sunCompanyAt') } }),
    outcome: s => scene('An hour', vary(s, [
        '“May I?” … your hand opens.',
        'Your head on her shoulder … a long breath.',
        '“Here?” … exactly there.',
        'Nothing to explain … you sit close.',
        'The curtain half drawn … enough.',
        'Her laugh … felt through her shoulder.',
        'Your shoes stay on … she brings a footstool.',
        'The hour ends … she lets you finish.',
        'You flinch … she moves her hand away.',
        'Warm palms … the knot beneath your neck loosens.',
        '“Softer?” … you nod.',
        'No touching today … she stays beside you.',
      ], 'company_sun')),
  },
  {
    id: 'meal_sun', system: 'social', label: 'Share THE SUN’s supper', category: 'social', subcategory: 'sun', duration: 2,
    description: 'Supper for $6. Food and company. Lifestyle improves; Hunger stays.', requirement: 4,
    when: available(s => f(s, 'metSun') && s.money >= 6), weight: s => (s.lifestyle ?? 40) < 45 ? 4 : 2, desire: 0.71,
    personality: { empathy: 0.02 },
    effects: () => ({ money: -6, lifestyle: 4, rapture: 12, disquiet: -1, relationships: { sun: 1 }, progress: { sunMeals: 1 } }),
    outcome: s => scene('Supper', vary(s, [
        'Soup … the bowl warm underneath.',
        'Bread torn by hand … half for you.',
        'The potato gives … butter in the split.',
        '“Enough?” … you check before answering.',
        'Sweet carrots … she asks if you like them.',
        'Bread around the bowl … the last trace.',
        'Soup again … better today.',
        'The last spoonful … you set it down.',
        'An extra plate … she had hoped.',
        'You reach for salt … she passes it.',
        'Steam against your face … you wait.',
        'Her recipe … measurements crossed out.',
      ], 'meal_sun')),
  },
  {
    id: 'close_brothel', system: 'social', label: 'Help put the house to bed', category: 'social', subcategory: 'house', duration: 2,
    description: 'Cups. Curtains … the last lock.', requirement: 14, challenge: 3,
    when: available(s => f(s, 'metMadame') && bond(s, 'madame') >= 2), weight: 2, desire: 0.39,
    personality: { empathy: 0.035, resolve: 0.03 },
    effects: () => ({ rapture: -2, disquiet: -2, lifestyle: 2, skills: { practical: 0.3 }, relationships: { madame: 1, town: 0.25 }, progress: { brothelClosings: 1 } }),
    outcome: s => scene('Closing time', vary(s, [
        'Lipstick on the cups … hot water, then none.',
        'Coins under cushions … into MADAME’s jar.',
        'A caught curtain … you mend the hem.',
        'The sign turned … the bolt drawn.',
        'The bins heavier … than they looked.',
        'Towels counted … one still upstairs.',
        'Chairs up … a damp floor.',
        'The hall lamp stays on … someone coming back.',
        'A stain on the cloth … cold water first.',
        'MADAME checks the lock … thanks you twice.',
        'Shoes in her hand … THE SUN heads upstairs.',
        'One cup kept out … for the morning.',
      ], 'close_brothel')),
  },
];


// Paid appointments are separate from introductions, tea, jokes, and ordinary
// friendship. Money never replaces the trust required to be welcome here.
TOWN_ACTIONS.push(
  {
    id: 'company_priestess', system: 'social', label: 'Private company with THE PRIESTESS — $40', category: 'social', subcategory: 'priestess', duration: 2,
    description: 'Her private time, $40. A ritual if you want it. One appointment a day.', requirement: 10,
    when: available(s => f(s, 'metPriestess') && s.money >= 40 && freeToday(s, 'priestessCompanyAt')), weight: 4, desire: 0.88,
    paidCompany: { person: 'priestess', fee: 40 },
    effects: s => ({ money: -40, rapture: 26, disquiet: 2, relationships: { priestess: 1 }, progress: { priestessCompany: 1, ...stamp(s, 'priestessCompanyAt') } }),
    outcome: s => scene('THE PRIESTESS', vary(s, [
      'The price agreed. A candle lit.\n\n“Tell me what you want.”',
      'Your hand in hers … no prediction this time.',
      'She asks before touching you.\n\nYou answer without a joke.',
      '“A sign,” she whispers.\n\nYou are happy enough not to ask.',
      'Her sleeve at your cheek … then her hand.',
      'The candle nearly gone.\n\nShe tells you the time.',
    ], 'company_priestess')),
  },
  {
    id: 'company_fool', system: 'social', label: 'Private company with THE FOOL — $35', category: 'social', subcategory: 'fool', duration: 2,
    description: 'Her private time, $35. Laughter, closeness, a clear ending. One appointment a day.', requirement: 8,
    when: available(s => f(s, 'metFool') && foolTrust(s) && s.money >= 35 && freeToday(s, 'foolCompanyAt')), weight: 4, desire: 0.91,
    paidCompany: { person: 'fool', fee: 35 },
    effects: s => ({ money: -35, rapture: 24, disquiet: -1, relationships: { fool: 1 }, progress: { foolCompany: 1, ...stamp(s, 'foolCompanyAt') } }),
    outcome: s => scene('THE FOOL', vary(s, [
      'The fee. Your nervous hands.\n\n“You can put those down.”',
      'A joke at the wrong moment … you both need a minute.',
      'She asks what feels good.\n\nWaits for a real answer.',
      'Your laugh against her shoulder … hers arriving after.',
      'No punchline.\n\nYou stay close.',
      '“Time.”\n\nOne last joke … the door opened for you.',
    ], 'company_fool')),
  },
  {
    id: 'repair_fool_trust', system: 'social', label: 'Apologize to THE FOOL', category: 'social', subcategory: 'repair', duration: 2,
    description: s => f(s, 'blamedFool')
      ? f(s, 'betrayedFoolName') ? 'Her name. The blame. Admit both without asking for company.' : 'You let them call her a cheat. Admit it without asking for company.'
      : 'Her name, her confidence. Admit what you did without asking for company.', requirement: 8, challenge: 3,
    when: available(s => f(s, 'metFool') && !foolTrust(s)), weight: 14, desire: 0.28,
    personality: { honesty: 0.08, empathy: 0.08, resolve: 0.05 },
    effects: () => ({ rapture: -5, disquiet: 3, relationships: { fool: 1 }, flags: { betrayedFoolName: false, blamedFool: false, apologizedToFool: true } }),
    outcome: () => scene('No joke', 'you name what you did.\n\nshe lets you finish.\n\n“don’t do it again.”'),
  },
  {
    id: 'repair_sun_promise', system: 'social', label: 'Answer THE SUN about her appointment', category: 'social', subcategory: 'repair', duration: 2,
    description: 'You cancelled for her. Admit it was her decision to make.', requirement: 8, challenge: 3,
    when: available(s => f(s, 'metSun') && f(s, 'cancelledForSun')), weight: 14, desire: 0.3,
    personality: { honesty: 0.08, empathy: 0.1, resolve: 0.05 },
    effects: () => ({ rapture: -4, disquiet: 2, relationships: { sun: 1 }, flags: { cancelledForSun: false, apologizedToSun: true } }),
    outcome: () => scene('Her time', '“i know you meant well.”\n\nthen the amount she lost.\n\nyou listen to both.'),
  },
  {
    id: 'house_maintenance', system: 'social', label: 'Take a paid repair job for MADAME — $24', category: 'work', subcategory: 'handiwork', duration: 3,
    description: 'She trusts your work. A small repair job pays $24; another in three days.', requirement: 16, challenge: 2,
    when: available(s => f(s, 'metMadame') && p(s, 'brothelRepairs') >= 2 && bond(s, 'madame') >= 3 && (!Object.hasOwn(s.progress || {}, 'madameJobAt') || s.hours - p(s, 'madameJobAt') >= 72)), weight: 6, desire: 0.57,
    effects: s => ({ money: 24, rapture: -2, lifestyle: 2, skills: { practical: 0.5 }, relationships: { madame: 0.5 }, progress: { madameJobs: 1, ...stamp(s, 'madameJobAt') } }),
    outcome: s => scene('Paid work', vary(s, [
      'the latch holds.\n\nshe tests it. pays you.',
      '“same rate?”\n\nyou agree before starting.',
      'the receipt in her drawer.\n\nyour money counted twice.',
      'one job finished.\n\nshe shows you the next. another day.',
    ], 'house_maintenance')),
  },
);
for (const action of TOWN_ACTIONS) {
  action.timeSlots = ['evening'];
  action.intent = action.category === 'work' ? 'work' : action.paidCompany || action.id === 'company_sun' ? 'pleasure' : 'social';
  if (['help_madame', 'house_maintenance'].includes(action.id)) action.timeSlots = ['daytime'];
  if (['visit_brothel', 'tea_madame', 'reading_priestess', 'question_priestess'].includes(action.id)) action.timeSlots = ['daytime', 'evening'];
  if (action.id === 'company_sun') action.paidCompany = { person: 'sun', fee: 30 };
  if (action.id === 'meal_sun') action.meal = { tasty: true, healthy: true };
}

export const TOWN_EVENTS = [
  {
    id: 'house_private_name', when: s => f(s, 'metFool') && p(s, 'brothelVisits') >= 2,
    title: 'Her other name',
    text: 'THE FOOL’s real name … she told only you.\n\nA regular asks.\n\n“Come on … we’re friends.”',
    options: [
      {
        id: 'event_house_name_boundary', label: 'Say it is hers to tell', description: 'Let the conversation become uncomfortable.', requirement: 24, challenge: 3,
        personality: { honesty: 0.12, empathy: 0.16, resolve: 0.12, caution: 0.05 },
        effects: () => ({ rapture: -3, disquiet: -2, relationships: { fool: 2 }, flags: { protectedFoolName: true } }),
        outcome: scene('Her name', '“Difficult,” he says … leaves.\n\nLater, she thanks you. No joke.'),
      },
      {
        id: 'event_house_name_smalllie', label: 'Say you do not know', description: 'A small lie. Keep her confidence.', requirement: 0, ethics: 1,
        personality: { honesty: -0.06, empathy: 0.12, caution: 0.08 },
        effects: () => ({ rapture: 3, disquiet: 1, relationships: { fool: 1 }, flags: { protectedFoolName: true } }),
        outcome: scene('Nobody knows', '“No idea.”\n\nHe asks someone else … you go inside.'),
      },
      {
        id: 'event_house_name_tell', label: 'Tell him', description: 'It would be easier to be liked.', requirement: 0, ethics: 5,
        personality: { honesty: -0.08, empathy: -0.2, caution: -0.14 },
        effects: () => ({ rapture: 4, disquiet: 4, relationships: { fool: -2, madame: -1 }, flags: { betrayedFoolName: true } }),
        outcome: scene('Outside her mouth', 'He thanks you.\n\nLater, she hears him use it … looks at you.'),
      },
    ],
  },
  {
    id: 'house_unfair_game', when: s => f(s, 'metFool') && p(s, 'foolGames') >= 2,
    title: 'The missing king',
    text: '“Cheat.”\n\nYou dealt. She played fairly.\n\nHe looks to you … so does she.',
    options: [
      {
        id: 'event_house_game_defend', label: 'Say she played fairly', description: 'You saw what happened. Say it clearly.', requirement: 26, challenge: 3,
        personality: { honesty: 0.15, empathy: 0.14, resolve: 0.16 },
        effects: () => ({ rapture: -3, disquiet: -1, relationships: { fool: 2, madame: 1 }, flags: { defendedFool: true } }),
        outcome: scene('A fair hand', '“I dealt.” … quieter than intended.\n\nMADAME comes over.'),
      },
      {
        id: 'event_house_game_check', label: 'Ask everyone to look at the cards', description: 'Slow the room down. Count together.', requirement: 6, challenge: 2,
        personality: { caution: 0.16, honesty: 0.1, resolve: 0.04 },
        effects: () => ({ rapture: -2, disquiet: -1, skills: { math: 0.2 }, relationships: { fool: 1 }, flags: { checkedFoolGame: true } }),
        outcome: scene('On the table', 'The king. Under his elbow.\n\nShe waits … no joke this time.'),
      },
      {
        id: 'event_house_game_appease', label: 'Laugh and agree with him', description: 'Perhaps he will calm down if somebody takes his side.', requirement: 0, ethics: 4,
        personality: { honesty: -0.17, empathy: -0.16, resolve: -0.1, caution: 0.03 },
        effects: () => ({ rapture: 3, disquiet: 4, relationships: { fool: -2, madame: -1 }, flags: { blamedFool: true } }),
        outcome: scene('An easy laugh', 'He laughs with you … she collects the cards.\n\nMADAME finds the king.'),
      },
    ],
  },
  {
    id: 'house_borrowed_certainty', when: s => p(s, 'priestessReadings') >= 2 && bond(s, 'priestess') >= 3,
    title: 'Will he come back?',
    text: 'Her husband left.\n\nTHE PRIESTESS turns a card. “He’ll come back.”\n\nThe woman cries … relieved.\n\nYou know no more than before.',
    options: [
      {
        id: 'event_house_certainty_question', label: 'Say the cards cannot promise that', description: 'In front of her client … interrupt the comfort.', requirement: 22, challenge: 3,
        personality: { honesty: 0.16, caution: 0.15, resolve: 0.1, empathy: -0.02 },
        effects: () => ({ rapture: -3, disquiet: -2, relationships: { priestess: -1 }, flags: { questionedHousePrediction: true } }),
        outcome: scene('No promise', 'The woman looks down … THE PRIESTESS closes the deck.\n\n“Tea?”'),
      },
      {
        id: 'event_house_certainty_private', label: 'Question THE PRIESTESS afterward', description: 'Spare her embarrassment … leave the promise standing.', requirement: 5, challenge: 2,
        personality: { honesty: 0.05, empathy: 0.1, caution: 0.09, resolve: -0.03 },
        effects: () => ({ rapture: -2, disquiet: 1, relationships: { priestess: 1 }, flags: { privatelyQuestionedPrediction: true } }),
        outcome: scene('Afterward', '“I wanted to help.”\n\nThe woman has already gone … you both watch the door.'),
      },
      {
        id: 'event_house_certainty_echo', label: 'Tell the woman you believe it too', description: 'Another voice … something for her to hold.', requirement: 0, ethics: 3,
        personality: { honesty: -0.14, empathy: 0.04, caution: -0.15, resolve: -0.04 },
        effects: () => ({ rapture: 4, disquiet: 3, relationships: { priestess: 1 }, flags: { reinforcedHousePrediction: true } }),
        outcome: scene('Two voices', 'She thanks you both … writes the date down.\n\nYou wish she hadn’t.'),
      },
    ],
  },
  {
    id: 'house_promised_waking', when: s => p(s, 'sunCompany') >= 2 && bond(s, 'sun') >= 3,
    title: 'Her guest',
    text: '“Wake me when my guest arrives.”\n\nHer guest downstairs now … her cheek against the cushion.\n\nShe worked late yesterday.',
    options: [
      {
        id: 'event_house_waking_keep', label: 'Wake her, as she asked', description: 'Her appointment … her decision.', requirement: 12, challenge: 2,
        personality: { honesty: 0.1, empathy: 0.08, resolve: 0.12 },
        effects: () => ({ rapture: -2, disquiet: -1, relationships: { sun: 1 }, flags: { keptSunPromise: true } }),
        outcome: scene('Awake', 'Her eyes open … “Already?”\n\nA breath. “Thank you.”'),
      },
      {
        id: 'event_house_waking_cover', label: 'Let her sleep; say she is unavailable', description: 'Rest for her … decide without asking.', requirement: 0, ethics: 2,
        personality: { honesty: -0.07, empathy: 0.1, caution: -0.08, resolve: -0.05 },
        effects: () => ({ rapture: 3, disquiet: 2, relationships: { sun: -0.5 }, flags: { cancelledForSun: true } }),
        outcome: scene('Still asleep', 'The guest leaves.\n\nLater … “I needed that money.”'),
      },
      {
        id: 'event_house_waking_madame', label: 'Tell MADAME what she asked', description: 'Pass the promise on … stay nearby.', requirement: 0,
        personality: { honesty: 0.05, caution: 0.1, resolve: -0.04 },
        effects: () => ({ rapture: -1, relationships: { madame: 0.5 }, flags: { askedMadameToWakeSun: true } }),
        outcome: scene('A familiar voice', 'MADAME kneels by the sofa.\n\nYou wait in the hall … hear your name.'),
      },
    ],
  },
];
