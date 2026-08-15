const ADJECTIVES = [
  'Blue', 'Silent', 'Cosmic', 'Velvet', 'Solar', 'Neon', 'Brave', 'Swift', 
  'Mystic', 'Crimson', 'Golden', 'Shadow', 'Luminous', 'Vibrant', 'Ethereal', 
  'Starlight', 'Silver', 'Cyber', 'Wild', 'Frost', 'Zen', 'Astral', 'Amber'
];

const NOUNS = [
  'Fox', 'Tiger', 'Panther', 'Falcon', 'Owl', 'Panda', 'Wolf', 'Phoenix', 
  'Lynx', 'Raven', 'Dolphin', 'Otter', 'Hawk', 'Koala', 'Cheetah', 'Bear', 
  'Eagle', 'Dragon', 'Puma', 'Jaguar', 'Viper', 'Robin', 'Penguin'
];

/**
 * Generates a random non-identifying anonymous username.
 * Example: "BlueFox42", "SilentTiger18", "CosmicFalcon99"
 */
export function generateAnonymousUsername(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10 - 99
  return `${adj}${noun}${num}`;
}

/**
 * Validates a username string.
 * Must be 2-20 characters, non-empty.
 */
export function validateUsername(name: string): { isValid: boolean; sanitized: string } {
  const sanitized = name.trim().replace(/[^a-zA-Z0-9_\-\s]/g, '');
  if (sanitized.length < 2 || sanitized.length > 20) {
    return { isValid: false, sanitized: sanitized.slice(0, 20) };
  }
  return { isValid: true, sanitized };
}
