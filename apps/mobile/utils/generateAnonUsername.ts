// ─────────────────────────────────────────────
// utils/generateAnonUsername.ts
// Generates anonymous username: Adjective + Animal + Number
// Mirror of packages/core/generateAnonUsername.ts for mobile bundle
// ─────────────────────────────────────────────

const ADJECTIVES = [
  'Brave', 'Calm', 'Kind', 'Bold', 'Wise', 'Gentle', 'Joyful',
  'Hopeful', 'Radiant', 'Faithful', 'Humble', 'Serene', 'Mighty',
  'Tender', 'Gracious', 'Peaceful', 'Vibrant', 'Steadfast', 'Loving',
];

const ANIMALS = [
  'Lion', 'Dove', 'Eagle', 'Lamb', 'Fox', 'Bear', 'Deer', 'Hawk',
  'Wolf', 'Sparrow', 'Falcon', 'Otter', 'Rabbit', 'Tiger', 'Owl',
  'Crane', 'Dolphin', 'Panda', 'Gazelle',
];

/**
 * Returns a random anonymous display name.
 * Example: "HopefulDove17"
 */
export function generateAnonUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${animal}${num}`;
}
