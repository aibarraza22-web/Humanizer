// ══════════════════════════════════════════════════════════════════
//  HUMANIZER RUNTIME SUPPORT — datasets.js
//  No pre-entered human/AI corpora. Runtime datasets are built in-app.
// ══════════════════════════════════════════════════════════════════

const FORCED_SUBSTITUTIONS = [
  { from: 'important', to: ['big', 'key', 'worth paying attention to'] },
  { from: 'utilize', to: ['use'] },
  { from: 'leverage', to: ['use', 'lean on'] },
  { from: 'furthermore', to: ['also', 'on top of that'] },
  { from: 'moreover', to: ['also', 'besides'] },
  { from: 'in conclusion', to: ['so', 'bottom line'] },
  { from: 'it is important to note', to: ['worth noting', 'what matters here is'] },
  { from: 'demonstrates', to: ['shows'] },
  { from: 'highlights', to: ['shows', 'points out'] },
  { from: 'suggests', to: ['points to', 'kind of shows'] },
  { from: 'therefore', to: ['so'] },
  { from: 'thus', to: ['so'] }
];

const FRAGMENT_TEMPLATES = [
  'Probably.',
  'At least for now.',
  'Maybe not always.',
  'Honestly?',
  'Depends who you ask.',
  'Not kidding.',
  'Hard to ignore.',
  'That part matters.',
  'Which is the point.',
  'Not exactly.'
];

const IMPERFECTION_RULES = [
  'Include one short sentence fragment as its own sentence.',
  'Use one conversational aside in dashes — like this — in a natural place.',
  'Use one sentence that starts with And or But if it sounds natural for this voice.',
  'Use one sentence that intentionally trails into uncertainty (e.g., "maybe", "I think", "probably").',
  'Include one direct opinion stated plainly (not hedged).',
  'Use contractions naturally where this writer would.',
  'Vary sentence lengths strongly; avoid a smooth repeated rhythm.'
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FORCED_SUBSTITUTIONS, FRAGMENT_TEMPLATES, IMPERFECTION_RULES };
}
