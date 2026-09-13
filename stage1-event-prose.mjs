/* Short fiction overlays. Existing event mechanics stay in stage1-content.mjs. */

const flag = (state, key) => Boolean(state.flags?.[key]);
const progress = (state, key) => Number(state.progress?.[key] || 0);
const skill = (state, key) => Number(state.skills?.[key] || 0);
const bond = (state, key) => Number(state.relationships?.[key] || 0);

export const EVENT_PROSE = {
  grocery_wallet: {
    title: 'under the till',
    text: 'a wallet. fifty dollars. a family photograph.\n\nthe address: two streets away.\n\nno one saw.',
    options: {
      event_wallet_return: {
        description: 'Two streets. Your break. Everything inside.',
        outcome: { title: 'returned', text: 'the owner counts it.\n\nthen takes your hand.\n\nyour break is over.' },
      },
      event_wallet_desk: {
        description: 'Give it to the manager. Say where you found it.',
        outcome: { title: 'lost property', text: 'your name. the time.\n\na drawer closes.\n\nback to the tins.' },
      },
      event_wallet_take: {
        description: 'Return the wallet. Keep the fifty.',
        outcome: { title: 'fifty dollars', text: 'the owner comes in.\n\nasks twice.\n\nyou keep facing tins.' },
      },
    },
  },
  helper_secrecy: {
    title: 'how much food?',
    text: 'your helper counts the bags.\n\n“what are we feeding?”\n\nthen, quieter.\n\n“what did you get me into?”',
    options: {
      event_helper_honest: {
        description: 'The hunger. The pain. What you still do not know.',
        outcome: { title: 'one more collection', text: 'you tell what you can.\n\none more collection, they say.\n\nthen another conversation.' },
      },
      event_helper_halftruth: {
        description: 'A rescue animal. Leave it there.',
        outcome: { title: 'a rescue', text: '“which vet?”\n\nyou adjust the bags.\n\n“i’m sorting that out.”' },
      },
      event_helper_silence: {
        description: 'Say their questions are making this harder.',
        outcome: { title: 'no more questions', text: 'the crate goes down.\n\n“right.”\n\nthey leave it there.' },
      },
    },
  },
  person_confrontation: {
    title: 'PERSON is waiting',
    text: 'late again. mud on your cuffs.\n\n“where do you go?”\n\nyou start. she waits.\n\n“the actual thing.”',
    options: {
      event_person_truth: {
        description: 'The hole. The feeding. Feeling his body. She may leave.',
        outcome: { title: 'the actual thing', text: 'you tell her.\n\n“again. slower.”\n\nshe is frightened.\n\nstill beside you.' },
      },
      event_person_smalllie: {
        description: 'A sick friend. Let her assume the rest.',
        outcome: { title: 'someone sick', text: '“has he seen a doctor?”\n\n“it’s being handled.”\n\nher concern. your relief.' },
      },
      event_person_blatant: {
        description: 'Work ran late. Make the question her fault.',
        outcome: { title: 'working', text: '“why are you interrogating me?”\n\nshe steps back.\n\nrelief. then her face.' },
      },
    },
  },
  wendy_boundary: {
    title: 'the drawing',
    text: 'WENDY’s drawing. the hole. exactly.\n\n“i could go tonight.”\n\nher schoolbag against your chair.',
    options: {
      event_wendy_boundary: {
        description: 'Ask her to stay away. Meet at the library. Admit the danger.',
        outcome: { title: 'library hours', text: '“because i’m a kid?”\n\n“because i’m scared.”\n\nthe library, then.\n\nshe will tell someone she trusts.' },
      },
      event_wendy_dismiss: {
        description: 'Say it is a dream. Deny recognizing the hole.',
        outcome: { title: 'folded once', text: 'she saw you recognize it.\n\n“okay.”\n\nthe drawing goes away.' },
      },
      event_wendy_encourage: {
        description: 'Call her special. Let her take that as permission.',
        outcome: { title: 'special', text: '“you really think so?”\n\nthen she asks the way.\n\nyou begin explaining.' },
      },
    },
  },
  trader_ethics: {
    title: 'the other accounts',
    text: 'a classmate’s disk. private account records.\n\n“nobody checks.”\n\nbetter predictions. more food.\n\nother people’s money.',
    options: {
      event_trader_refuse: {
        description: 'Delete it. Say why. Use public data.',
        outcome: { title: 'your own work', text: 'file deleted.\n\nthe result is smaller.\n\nyou can account for it.' },
      },
      event_trader_ask: {
        description: 'Ask where it came from. Verify the answer.',
        outcome: { title: 'where, exactly?', text: 'a vague answer. then irritation.\n\nyou leave it unopened.\n\nback to public data.' },
      },
      event_trader_use: {
        description: 'Use the records. Make the advantage pay.',
        outcome: { title: 'better predictions', text: 'a name. an overdraft.\n\nyou hide that column.\n\nthe results improve.' },
      },
    },
  },
  power_test: {
    title: 'before they move',
    text: 'at the crossing. each next step, somehow known.\n\n*look at me*\n\nyou want to try.',
    options: {
      event_power_stepback: {
        description: 'Give up the feeling. Let them cross.',
        outcome: { title: 'their own feet', text: 'you look down.\n\nthe light changes.\n\nlosing the certainty hurts.' },
      },
      event_power_observe: {
        description: 'Watch. Three breaths. No instruction.',
        outcome: { title: 'three breaths', text: 'someone turns unexpectedly.\n\nyou lose the pattern.\n\nalmost a relief.' },
      },
      event_power_push: {
        description: 'Make someone turn. Find out if you can.',
        outcome: { title: 'she turns', text: 'a woman stops in the road. looks at you.\n\n**a horn**\n\nyou want to try again.' },
      },
    },
  },
};

// The engine records completed event IDs. These need no new completion gates.
export const EXTRA_STORY_EVENTS = [
  {
    id: 'grocery_short_change',
    when: state => progress(state, 'shifts') >= 3 && state.money >= 3,
    title: 'three dollars',
    text: 'three dollars short.\n\nsoap. soup. oranges.\n\nthe customer counts again.\n\nthe queue watches.',
    options: [
      {
        id: 'event_change_pay', label: 'Put in three dollars',
        description: 'Your money. Quietly.', requirement: 22,
        effects: () => ({ money: -3, rapture: -2, disquiet: -1, relationships: { town: 0.5 } }),
        personality: { empathy: 0.14, resolve: 0.08, caution: -0.03 },
        outcome: { title: 'exact change', text: '“it’s enough.”\n\nthey see your hand. look away.\n\neverything goes in the bag.' },
      },
      {
        id: 'event_change_swap', label: 'Find cheaper things',
        description: 'Smaller tin. Store brand. The queue can wait.', requirement: 12,
        effects: () => ({ rapture: -1, disquiet: 1, skills: { social: 0.25 }, relationships: { town: 0.5 } }),
        personality: { empathy: 0.08, caution: 0.1, resolve: 0.06 },
        outcome: { title: 'the same soup', text: 'the total fits.\n\nbehind you, a sigh.\n\nthe customer checks the bag twice.' },
      },
      {
        id: 'event_change_remove', label: 'Ask what to put back',
        description: 'Let them decide. Finish the sale.', requirement: 0,
        effects: () => ({ rapture: 1, disquiet: 1 }),
        personality: { caution: 0.08, empathy: -0.03 },
        outcome: { title: 'the soap', text: '“the soap.”\n\nyou set it aside.\n\nnext customer.' },
      },
    ],
  },
  {
    id: 'ethan_last_latch',
    when: state => flag(state, 'metEthan') && bond(state, 'ethan') >= 3 && skill(state, 'practical') >= 1,
    title: 'one last latch',
    text: 'ETHAN’s hand is cramped.\n\none latch left. his mother is waiting.\n\n“could you?”',
    options: [
      {
        id: 'event_ethan_finish', label: 'Finish the latch',
        description: 'Take the screwdriver. Give up the quiet half hour.', requirement: 24,
        effects: () => ({ rapture: -3, disquiet: 1, skills: { practical: 0.25 }, relationships: { ethan: 1 } }),
        personality: { empathy: 0.12, resolve: 0.14 },
        outcome: { title: 'it catches', text: 'one screw goes crooked.\n\nyou start again.\n\nit catches.\n\nhis message: “owe you one.”' },
      },
      {
        id: 'event_ethan_reschedule', label: 'Help him postpone the job',
        description: 'Call the customer together. Ask for tomorrow.', requirement: 10,
        effects: () => ({ rapture: -1, disquiet: -1, relationships: { ethan: 0.5 }, skills: { social: 0.25 } }),
        personality: { honesty: 0.1, caution: 0.12, empathy: 0.06 },
        outcome: { title: 'tomorrow is available', text: 'tomorrow is fine.\n\nETHAN asks twice.\n\nhis hand unclenches.' },
      },
      {
        id: 'event_ethan_false_promise', label: 'Say yes, intending to leave it',
        description: 'Say it is handled. Leave it for him.', requirement: 0, ethics: 4,
        effects: () => ({ rapture: 2, disquiet: 3, relationships: { ethan: -1 } }),
        personality: { honesty: -0.16, empathy: -0.1, resolve: -0.08 },
        outcome: { title: 'all sorted', text: '“lifesaver.”\n\nhis van pulls away.\n\nyou put the screwdriver down.' },
      },
    ],
  },
  {
    id: 'jim_missing_punchline',
    when: state => flag(state, 'knowsSoberJim') && bond(state, 'jim') >= 5,
    title: 'no punchline yet',
    text: 'cold coffee.\n\n“i don’t remember her funeral.”\n\nJIM waits. no grin.',
    options: [
      {
        id: 'event_jim_listen', label: 'Ask him about her',
        description: 'Ask her name. Stay for the answer.', requirement: 20,
        effects: () => ({ rapture: -2, disquiet: 2, relationships: { jim: 2 } }),
        personality: { empathy: 0.16, resolve: 0.1 },
        outcome: { title: 'her laugh', text: 'he tries to copy her laugh.\n\n“nothing like that.”\n\nthen a long while.\n\nyou stay.' },
      },
      {
        id: 'event_jim_sandwich', label: 'Make him a sandwich',
        description: 'His bread. His kitchen. Something you can do.', requirement: 6,
        effects: () => ({ rapture: 1, disquiet: -1, relationships: { jim: 1 } }),
        personality: { empathy: 0.08, caution: 0.1 },
        outcome: { title: 'two triangles', text: 'you cut it in half.\n\nhe eats both.\n\n“more mustard next time.”' },
      },
      {
        id: 'event_jim_joke', label: 'Give him the punchline',
        description: 'The old joke. Give him somewhere familiar.', requirement: 0,
        effects: () => ({ rapture: 3, disquiet: 2, relationships: { jim: 0.5 } }),
        personality: { empathy: -0.04, caution: 0.04, honesty: -0.03 },
        outcome: { title: 'there he is', text: 'he corrects your timing.\n\ntells it properly.\n\nyou both laugh.\n\nleave the rest.' },
      },
    ],
  },
  {
    id: 'friend_and_spilled_apples',
    when: state => progress(state, 'feeds') >= 3 && progress(state, 'townVisits') >= 2,
    title: 'two places at once',
    text: 'a bag splits. apples on the pavement.\n\nthe stranger cannot bend.\n\nyour jaw aches.\n\n*come soon*',
    options: [
      {
        id: 'event_apples_gather', label: 'Gather the apples first',
        description: 'The ache can wait for a few minutes.', requirement: 26,
        effects: () => ({ rapture: -3, disquiet: 2, relationships: { town: 1 } }),
        personality: { empathy: 0.14, resolve: 0.1, caution: -0.03 },
        outcome: { title: 'one under the bench', text: 'kneeling hurts.\n\none more under the bench.\n\n“thank you.”\n\nyou go.' },
      },
      {
        id: 'event_apples_ask', label: 'Ask someone nearby to help',
        description: 'Ask aloud. Wait for an answer.', requirement: 12,
        effects: () => ({ rapture: -1, disquiet: -1, skills: { social: 0.25 } }),
        personality: { empathy: 0.08, caution: 0.1, resolve: 0.06 },
        outcome: { title: 'another pair of hands', text: 'the first keeps walking.\n\nthe second kneels.\n\nyou thank the second. leave.' },
      },
      {
        id: 'event_apples_continue', label: 'Keep going toward the woods',
        description: 'Your friend is waiting. Keep walking.', requirement: 0,
        effects: () => ({ rapture: 2, disquiet: 2 }),
        personality: { resolve: 0.08, empathy: -0.08, caution: -0.04 },
        outcome: { title: 'the familiar direction', text: 'an apple against your shoe.\n\nyou step over it.\n\n*soon?*' },
      },
    ],
  },
  {
    id: 'coding_borrowed_answer',
    when: state => skill(state, 'coding') >= 4,
    title: 'it runs',
    text: 'an answer from a forum. pasted. working.\n\nyour exercise sheet: solved without help?\n\na box to tick.',
    options: [
      {
        id: 'event_code_understand', label: 'Close the answer and rebuild it',
        description: 'Close the answer. Start with what you understand.', requirement: 26,
        effects: () => ({ rapture: -3, disquiet: 1, skills: { coding: 0.25 } }),
        personality: { honesty: 0.12, resolve: 0.16 },
        outcome: { title: 'line four', text: 'line four.\n\nstill line four.\n\nthen you see why.' },
      },
      {
        id: 'event_code_bookmark', label: 'Save it for another session',
        description: 'Leave it unfinished. Return when rested.', requirement: 8,
        effects: () => ({ rapture: -1, disquiet: -1 }),
        personality: { honesty: 0.08, caution: 0.14, resolve: -0.03 },
        outcome: { title: 'unfinished', text: 'the explanation saved.\n\nthe box empty.\n\ncomputer off.' },
      },
      {
        id: 'event_code_claim', label: 'Mark it as your own solution',
        description: 'Tick the box. Leave the answer unexplained.', requirement: 0, ethics: 2,
        effects: () => ({ rapture: 3, disquiet: 2 }),
        personality: { honesty: -0.14, resolve: -0.08, caution: -0.05 },
        outcome: { title: 'well done', text: 'solved.\n\nyou underline it.\n\nline four still makes no sense.' },
      },
    ],
  },
  {
    id: 'puddle_first_world',
    when: state => progress(state, 'feeds') >= 5 && skill(state, 'math') >= 3,
    title: 'after the rain',
    text: 'a puddle. light on the bottom.\n\nyou stop.\n\nwhen did you stop seeing this?',
    options: [
      {
        id: 'event_puddle_play', label: 'Float another leaf',
        description: 'A minute for something useless.', requirement: 0,
        effects: () => ({ rapture: 6, disquiet: 1 }),
        personality: { caution: -0.06, empathy: 0.06 },
        outcome: { title: 'still water', text: 'the leaf catches at the edge.\n\nyou free it.\n\nstay until it settles.' },
      },
      {
        id: 'event_puddle_measure', label: 'Count the rings',
        description: 'Drop a pebble. Measure the ripples.', requirement: 14,
        effects: () => ({ rapture: 2, disquiet: 2, skills: { math: 0.25 } }),
        personality: { caution: 0.08, resolve: 0.1 },
        outcome: { title: 'the next ring', text: 'you predict the next ring.\n\nit arrives.\n\na small, complete pleasure.' },
      },
      {
        id: 'event_puddle_leave', label: 'Keep your eyes on the pavement',
        description: 'You have things to do. Walk on.', requirement: 22,
        effects: () => ({ rapture: -2, disquiet: -2 }),
        personality: { caution: 0.16, resolve: 0.06 },
        outcome: { title: 'the ordinary size', text: 'you walk on.\n\nstill seeing the light.\n\nthen the next errand.' },
      },
    ],
  },
  {
    id: 'grocery_broken_jar',
    when: state => progress(state, 'shifts') >= 2,
    title: 'on the floor',
    text: 'a jar slips. breaks.\n\nthe manager looks up.\n\n“damaged delivery?”\n\nyour hand is still wet.',
    options: [
      {
        id: 'event_jar_admit', label: 'Say you dropped it',
        description: 'Your hand. Your mistake. Clean it up.', requirement: 18,
        effects: () => ({ rapture: -2, disquiet: 1, relationships: { town: 0.5 } }),
        personality: { honesty: 0.14, resolve: 0.1 },
        outcome: { title: 'dropped', text: '“right. mind the glass.”\n\nthat is all.\n\nyou fetch the mop.' },
      },
      {
        id: 'event_jar_clean', label: 'Clean up without answering',
        description: 'Make the aisle safe. Let the question pass.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 1 }),
        personality: { caution: 0.08, resolve: 0.05, honesty: -0.03 },
        outcome: { title: 'the mop', text: 'you reach for the mop.\n\nthe manager watches.\n\nthen goes back to work.' },
      },
      {
        id: 'event_jar_blame', label: 'Blame the delivery',
        description: 'Say the jar was already cracked.', requirement: 0, ethics: 4,
        effects: () => ({ rapture: 2, disquiet: 3 }),
        personality: { honesty: -0.16, empathy: -0.05, caution: -0.04 },
        outcome: { title: 'already cracked', text: 'he writes it down.\n\nthe driver’s name.\n\nyou start mopping.' },
      },
    ],
  },
  {
    id: 'grocery_closing_clock',
    when: state => progress(state, 'shifts') >= 5,
    title: 'the time sheet',
    text: 'your coworker stayed to close. unpaid.\n\nthe manager has written six o’clock.\n\n“initial here.”\n\nit was seven.',
    options: [
      {
        id: 'event_clock_correct', label: 'Write the actual time',
        description: 'Seven. Put your initials beside it.', requirement: 28,
        effects: () => ({ rapture: -3, disquiet: 2, relationships: { town: 1 }, skills: { social: 0.25 } }),
        personality: { honesty: 0.16, empathy: 0.1, resolve: 0.14 },
        outcome: { title: 'seven', text: 'the manager taps your correction.\n\nyou leave it.\n\nyour coworker says nothing. stays close.' },
      },
      {
        id: 'event_clock_decline', label: 'Refuse to initial it',
        description: 'You cannot confirm six. Leave the sheet unsigned.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 2 }),
        personality: { honesty: 0.08, caution: 0.1, resolve: 0.06 },
        outcome: { title: 'unsigned', text: '“someone else, then.”\n\nthe sheet passes you.\n\nthe wrong time remains.' },
      },
      {
        id: 'event_clock_sign', label: 'Initial six o’clock',
        description: 'Keep the manager pleased. Let the hour disappear.', requirement: 0, ethics: 6,
        effects: () => ({ rapture: 2, disquiet: 4, relationships: { town: -0.5 } }),
        personality: { honesty: -0.18, empathy: -0.12, caution: 0.05 },
        outcome: { title: 'initials', text: 'a quick mark.\n\nyour coworker sees.\n\nyou cap the pen.' },
      },
    ],
  },
  {
    id: 'finances_disputed_charge',
    when: state => flag(state, 'budgetSorted') && skill(state, 'finance') >= 1,
    title: 'twelve dollars',
    text: 'a charge on your statement. yours.\n\nthe dispute form offers a refund.\n\n“i did not make this purchase.”',
    options: [
      {
        id: 'event_charge_accept', label: 'Accept the charge',
        description: 'You bought it. File the statement.', requirement: 16,
        effects: () => ({ rapture: -2, disquiet: -1 }),
        personality: { honesty: 0.12, resolve: 0.08 },
        outcome: { title: 'filed', text: 'the balance stays.\n\nyou put the form away.\n\nanother envelope.' },
      },
      {
        id: 'event_charge_call', label: 'Ask about a payment plan',
        description: 'Explain the shortage. Keep the purchase on the bill.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 1, skills: { finance: 0.25 } }),
        personality: { honesty: 0.08, caution: 0.12, resolve: 0.05 },
        outcome: { title: 'on hold', text: 'you explain twice.\n\na later date. the same amount.\n\nyou write both down.' },
      },
      {
        id: 'event_charge_dispute', label: 'Claim you never bought it',
        description: 'Sign the false statement. Seek the twelve dollars.', requirement: 0, ethics: 6,
        effects: () => ({ money: 12, rapture: 3, disquiet: 4 }),
        personality: { honesty: -0.18, caution: -0.08, resolve: -0.04 },
        outcome: { title: 'credited', text: 'the claim is accepted.\n\nyou still have the receipt.\n\nyou tear it small.' },
      },
    ],
  },
  {
    id: 'care_kitchen_shortage',
    when: state => flag(state, 'surplusDeal') && progress(state, 'feeds') >= 4 && state.food >= 1,
    title: 'one bag',
    text: 'the community kitchen is short.\n\nyour food packed.\n\n“could we have one?”\n\nyou counted every bag.',
    options: [
      {
        id: 'event_kitchen_give', label: 'Give them one bag',
        description: 'One less for your friend. You will have to replace it.', requirement: 26,
        effects: () => ({ food: -1, rapture: -3, disquiet: 2, relationships: { town: 1 } }),
        personality: { empathy: 0.15, resolve: 0.08, caution: -0.05 },
        outcome: { title: 'one less', text: 'they carry it inside.\n\nyou recount.\n\nas if the answer might change.' },
      },
      {
        id: 'event_kitchen_arrange', label: 'Call another supplier for them',
        description: 'Keep your load. Try to find theirs.', requirement: 10,
        effects: () => ({ rapture: -1, disquiet: 1, skills: { social: 0.25 }, relationships: { town: 0.5 } }),
        personality: { empathy: 0.08, caution: 0.12, resolve: 0.08 },
        outcome: { title: 'one call', text: 'nothing spare today.\n\na possible collection tomorrow.\n\nyou pass over the number.' },
      },
      {
        id: 'event_kitchen_keep', label: 'Say you need all of it',
        description: 'Your friend depends on you. Keep every bag.', requirement: 0,
        effects: () => ({ rapture: 1, disquiet: 2 }),
        personality: { resolve: 0.08, empathy: -0.06, honesty: 0.04 },
        outcome: { title: 'all of it', text: '“understood.”\n\nthey hold the door.\n\nyou leave. all of it with you.' },
      },
    ],
  },
  {
    id: 'ethan_night_off',
    when: state => flag(state, 'recruitedEthan') && progress(state, 'feeds') >= 3,
    title: 'tonight',
    text: 'ETHAN’s keys on the table.\n\n“i need tonight off.”\n\nthe collection still needs doing.\n\nhe waits for permission.',
    options: [
      {
        id: 'event_ethan_release', label: 'Tell him to go home',
        description: 'Take responsibility for arranging the collection yourself.', requirement: 24,
        effects: () => ({ rapture: -3, disquiet: 2, relationships: { ethan: 1 }, progress: { ethanSuspicion: -2 } }),
        personality: { empathy: 0.14, resolve: 0.12, honesty: 0.06 },
        outcome: { title: 'home', text: 'he picks up his keys.\n\n“thank you.”\n\nyou begin working out the evening.' },
      },
      {
        id: 'event_ethan_negotiate', label: 'Ask what he can manage',
        description: 'Make refusal possible. Work out the rest yourself.', requirement: 8,
        effects: () => ({ rapture: -1, disquiet: 1, relationships: { ethan: 0.5 } }),
        personality: { empathy: 0.08, caution: 0.12, honesty: 0.05 },
        outcome: { title: 'twenty minutes', text: 'one short drive. no lifting.\n\nyou repeat the agreement.\n\nhe nods.' },
      },
      {
        id: 'event_ethan_pressure', label: 'Remind him what he promised',
        description: 'Make your need harder to refuse than his fatigue.', requirement: 0, ethics: 5,
        effects: () => ({ rapture: 3, disquiet: 4, relationships: { ethan: -1 }, progress: { ethanSuspicion: 3 } }),
        personality: { empathy: -0.16, honesty: -0.06, resolve: 0.08 },
        outcome: { title: 'fine', text: '“fine.”\n\nhe rubs his wrist.\n\nyou pretend not to see.' },
      },
    ],
  },
  {
    id: 'person_private_letter',
    when: state => flag(state, 'cafe') && bond(state, 'person') >= 4,
    title: 'her letter',
    text: 'PERSON goes to make tea.\n\nan open letter beside you.\n\n“i miss you.”\n\nthe rest within reach.',
    options: [
      {
        id: 'event_letter_leave', label: 'Leave the letter alone',
        description: 'Her page. Wait for her to return.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: -1 }),
        personality: { honesty: 0.1, empathy: 0.08, resolve: 0.08 },
        outcome: { title: 'two cups', text: 'she returns with tea.\n\nyou move your cup away from the paper.\n\nthat is all.' },
      },
      {
        id: 'event_letter_ask', label: 'Admit the line caught your eye',
        description: 'Ask. Let her decide what to tell you.', requirement: 20,
        effects: () => ({ rapture: -2, disquiet: 1, relationships: { person: 0.5 } }),
        personality: { honesty: 0.14, empathy: 0.06, caution: 0.06 },
        outcome: { title: 'not tonight', text: '“someone i knew.”\n\nshe folds it.\n\n“not tonight.”\n\nyou leave room for that.' },
      },
      {
        id: 'event_letter_read', label: 'Read the rest before she returns',
        description: 'Find out. Let her think you only waited.', requirement: 0, ethics: 5,
        effects: () => ({ rapture: 2, disquiet: 3, relationships: { person: -1 } }),
        personality: { honesty: -0.14, empathy: -0.12, caution: -0.06 },
        outcome: { title: 'the crease', text: 'you put it back.\n\nshe notices the crease.\n\nsets down your tea.' },
      },
    ],
  },
  {
    id: 'person_half_listening',
    when: state => flag(state, 'metPerson') && progress(state, 'conversations') >= 3,
    title: 'were you listening?',
    text: 'PERSON’s bad day. her voice low.\n\nyou are solving something else.\n\n“what do you think?”\n\nyou missed the question.',
    options: [
      {
        id: 'event_listen_restart', label: 'Admit it and ask her to start again',
        description: 'Put your work away. Give her your attention.', requirement: 22,
        effects: () => ({ rapture: -3, disquiet: 1, relationships: { person: 1.5 } }),
        personality: { honesty: 0.12, empathy: 0.14, resolve: 0.1 },
        outcome: { title: 'again', text: 'she looks tired.\n\nstarts again.\n\nthis time you hear the difficult part.' },
      },
      {
        id: 'event_listen_limit', label: 'Say you cannot listen properly yet',
        description: 'Be honest. Ask to talk after a quiet half hour.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 1, relationships: { person: 0.25 } }),
        personality: { honesty: 0.1, caution: 0.12, empathy: 0.03 },
        outcome: { title: 'half an hour', text: '“all right.”\n\nshe gives you the time.\n\nyou stop trying to solve anything.' },
      },
      {
        id: 'event_listen_pretend', label: 'Agree as though you heard',
        description: 'Something sympathetic. Keep your mind elsewhere.', requirement: 0, ethics: 3,
        effects: () => ({ rapture: 3, disquiet: 3, relationships: { person: -1 } }),
        personality: { honesty: -0.12, empathy: -0.14, resolve: -0.05 },
        outcome: { title: 'yes', text: '“that wasn’t what i asked.”\n\nyou nod again.\n\nthen realize.' },
      },
    ],
  },
  {
    id: 'jim_town_gossip',
    when: state => flag(state, 'metJim') && progress(state, 'townVisits') >= 4,
    title: 'something about JIM',
    text: 'they are laughing about JIM.\n\none of his worst nights.\n\n“you know him. go on.”\n\nyou know something worse.',
    options: [
      {
        id: 'event_gossip_defend', label: 'Say he has been good to you',
        description: 'Give them one true thing. Let the laughter stop.', requirement: 20,
        effects: () => ({ rapture: -3, disquiet: 1, relationships: { jim: 1, town: -0.25 } }),
        personality: { empathy: 0.14, honesty: 0.1, resolve: 0.12 },
        outcome: { title: 'a good thing', text: 'you tell it.\n\nno laugh at the end.\n\nsomeone changes the subject.' },
      },
      {
        id: 'event_gossip_redirect', label: 'Change the subject yourself',
        description: 'Keep his confidence. Find something else to say.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 1, skills: { social: 0.25 } }),
        personality: { empathy: 0.07, caution: 0.12, honesty: 0.03 },
        outcome: { title: 'the weather', text: 'you ask about the rain.\n\na poor transition.\n\nthey let you make it.' },
      },
      {
        id: 'event_gossip_trade', label: 'Tell them what JIM told you',
        description: 'Trade his confidence for a place in the conversation.', requirement: 0, ethics: 5,
        effects: () => ({ rapture: 3, disquiet: 4, relationships: { jim: -1, town: 0.5 }, progress: { jimSuspicion: 2 } }),
        personality: { empathy: -0.16, honesty: -0.12, caution: -0.08 },
        outcome: { title: 'your turn', text: 'they lean closer.\n\nyou add a detail.\n\nthey know your name now.' },
      },
    ],
  },
  {
    id: 'coding_rounding_fault',
    when: state => skill(state, 'coding') >= 5 && skill(state, 'math') >= 3,
    title: 'two cents',
    text: 'the calculator you shared. a rounding error.\n\nsmall, unless repeated.\n\npeople are using it.\n\nyour name at the bottom.',
    options: [
      {
        id: 'event_rounding_warn', label: 'Warn everyone who has a copy',
        description: 'Explain the error. Ask them to stop using it.', requirement: 28,
        effects: () => ({ rapture: -3, disquiet: 2, skills: { coding: 0.25 }, relationships: { town: 0.5 } }),
        personality: { honesty: 0.14, empathy: 0.12, resolve: 0.1 },
        outcome: { title: 'correction', text: 'you write the warning.\n\nremove an excuse.\n\nsend it.' },
      },
      {
        id: 'event_rounding_withdraw', label: 'Withdraw your copy quietly',
        description: 'Stop new downloads. Leave the old users unwarned.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 2 }),
        personality: { caution: 0.08, honesty: -0.04, empathy: -0.03 },
        outcome: { title: 'removed', text: 'the file comes down.\n\nthe old copies remain.\n\nyou close your mail.' },
      },
      {
        id: 'event_rounding_ignore', label: 'Leave it available',
        description: 'Call it too small to matter. Keep the praise.', requirement: 0, ethics: 6,
        effects: () => ({ rapture: 3, disquiet: 4 }),
        personality: { honesty: -0.16, empathy: -0.12, caution: -0.14 },
        outcome: { title: 'close enough', text: 'another thank-you arrives.\n\nyou save it.\n\nleave the error.' },
      },
    ],
  },
  {
    id: 'wendy_homework',
    when: state => flag(state, 'metWendy') && skill(state, 'math') >= 2,
    title: 'due tomorrow',
    text: 'the library. WENDY’s unfinished homework.\n\n“could you just do this one?”\n\nyou could do all of it.',
    options: [
      {
        id: 'event_homework_teach', label: 'Work through an example with her',
        description: 'Use another problem. Let her solve the assigned one.', requirement: 20,
        effects: () => ({ rapture: -3, disquiet: 1, skills: { math: 0.25 }, relationships: { wendy: 1 } }),
        personality: { empathy: 0.12, honesty: 0.1, resolve: 0.12 },
        outcome: { title: 'her pencil', text: 'you nearly take the pencil.\n\nstop.\n\nshe finds the next step.' },
      },
      {
        id: 'event_homework_decline', label: 'Say it has to be her work',
        description: 'Leave the answer unwritten. Point her to the chapter.', requirement: 0,
        effects: () => ({ rapture: -1, disquiet: 1 }),
        personality: { honesty: 0.1, caution: 0.08, empathy: -0.02 },
        outcome: { title: 'the chapter', text: 'she turns back a page.\n\nsighs.\n\nyou leave your answer unsaid.' },
      },
      {
        id: 'event_homework_write', label: 'Write it for her',
        description: 'Make it quick. Let her hand it in as her own.', requirement: 0, ethics: 3,
        effects: () => ({ rapture: 3, disquiet: 3, relationships: { wendy: 0.5 } }),
        personality: { honesty: -0.14, resolve: -0.08, empathy: -0.04 },
        outcome: { title: 'finished', text: 'she copies your answer.\n\n“you’re so good at this.”\n\nyou let that be enough.' },
      },
    ],
  },
];
