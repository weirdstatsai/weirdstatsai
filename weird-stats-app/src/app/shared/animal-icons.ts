/**
 * SVG outline illustrations for card backgrounds.
 * Each uses fill="none" stroke="currentColor" so they inherit the card accent color.
 * Keyed by the emoji the agent assigns to uiMeta.icon.
 */
export const ANIMAL_ICONS: Record<string, string> = {

  '🐛': `<svg viewBox="0 0 130 80" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="48" r="11"/>
    <circle cx="32" cy="54" r="12"/>
    <circle cx="53" cy="56" r="12"/>
    <circle cx="74" cy="52" r="12"/>
    <circle cx="94" cy="44" r="13"/>
    <circle cx="114" cy="34" r="13"/>
    <circle cx="120" cy="22" r="2.5" fill="currentColor"/>
    <path d="M114,21 Q108,6 102,3"/>
    <path d="M118,21 Q118,5 124,2"/>
    <path d="M32,66 L28,75"/>
    <path d="M53,68 L49,77"/>
    <path d="M74,64 L70,73"/>
    <path d="M94,56 L90,65"/>
  </svg>`,

  '🐙': `<svg viewBox="0 0 100 110" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="50" cy="36" rx="28" ry="30"/>
    <circle cx="40" cy="30" r="4.5"/>
    <circle cx="60" cy="30" r="4.5"/>
    <circle cx="40" cy="30" r="2" fill="currentColor"/>
    <circle cx="60" cy="30" r="2" fill="currentColor"/>
    <path d="M22,60 Q8,75 10,90 Q12,100 22,97 Q28,95 26,87"/>
    <path d="M34,65 Q26,82 28,95 Q30,104 40,100 Q46,97 42,89"/>
    <path d="M50,68 Q50,84 50,98 Q50,106 54,100"/>
    <path d="M66,65 Q74,82 72,95 Q70,104 60,100 Q54,97 58,89"/>
    <path d="M78,60 Q92,75 90,90 Q88,100 78,97 Q72,95 74,87"/>
  </svg>`,

  '🐱': `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="50" cy="65" rx="32" ry="26"/>
    <circle cx="50" cy="36" r="22"/>
    <path d="M32,20 L24,6 L38,16"/>
    <path d="M68,20 L76,6 L62,16"/>
    <circle cx="43" cy="35" r="3.5"/>
    <circle cx="57" cy="35" r="3.5"/>
    <circle cx="43" cy="35" r="1.5" fill="currentColor"/>
    <circle cx="57" cy="35" r="1.5" fill="currentColor"/>
    <path d="M44,41 Q50,46 56,41"/>
    <path d="M82,68 Q92,60 95,72 Q95,88 82,84"/>
  </svg>`,

  '🦅': `<svg viewBox="0 0 130 80" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5,45 Q20,20 50,38 Q60,42 65,40 Q70,42 80,38 Q110,20 125,45"/>
    <path d="M5,45 Q20,55 40,48"/>
    <path d="M125,45 Q110,55 90,48"/>
    <ellipse cx="65" cy="38" rx="12" ry="9"/>
    <path d="M73,34 Q82,28 80,22"/>
    <circle cx="70" cy="36" r="2" fill="currentColor"/>
    <path d="M58,46 Q62,58 66,62 Q70,58 72,46"/>
    <path d="M66,62 L62,72 L66,70 L70,72 L66,62"/>
  </svg>`,

  '🍺': `<svg viewBox="0 0 90 110" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18,20 L22,100 Q22,108 38,108 L58,108 Q74,108 74,100 L78,20 Z"/>
    <path d="M18,20 L78,20"/>
    <path d="M20,14 L76,14 Q80,14 80,20 L18,20 Q18,14 20,14"/>
    <path d="M74,35 Q88,35 88,50 Q88,65 74,65"/>
    <path d="M28,34 Q35,50 28,66"/>
    <path d="M42,30 Q49,50 42,70"/>
  </svg>`,

  '🌍': `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="50" r="42"/>
    <ellipse cx="50" cy="50" rx="20" ry="42"/>
    <path d="M8,50 Q50,42 92,50"/>
    <path d="M14,30 Q50,22 86,30"/>
    <path d="M14,70 Q50,78 86,70"/>
  </svg>`,

  '🌡️': `<svg viewBox="0 0 60 120" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M30,80 L30,20 Q30,10 38,10 Q46,10 46,20 L46,80"/>
    <path d="M30,20 Q22,20 22,30 Q22,80 30,80"/>
    <circle cx="38" cy="92" r="16"/>
    <path d="M44,80 Q54,85 54,92"/>
    <path d="M52,35 L58,35"/>
    <path d="M52,50 L58,50"/>
    <path d="M52,65 L58,65"/>
  </svg>`,

  '🕷️': `<svg viewBox="0 0 110 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <ellipse cx="55" cy="55" rx="16" ry="20"/>
    <circle cx="55" cy="30" r="14"/>
    <circle cx="48" cy="26" r="3"/>
    <circle cx="62" cy="26" r="3"/>
    <path d="M39,48 Q20,38 8,28"/>
    <path d="M39,54 Q18,54 6,50"/>
    <path d="M39,60 Q20,68 8,78"/>
    <path d="M71,48 Q90,38 102,28"/>
    <path d="M71,54 Q92,54 104,50"/>
    <path d="M71,60 Q90,68 102,78"/>
  </svg>`,

  '🦁': `<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="50" cy="45" r="28"/>
    <path d="M22,45 Q6,45 8,30 Q10,18 22,22"/>
    <path d="M78,45 Q94,45 92,30 Q90,18 78,22"/>
    <path d="M32,22 Q30,8 20,5"/>
    <path d="M68,22 Q70,8 80,5"/>
    <circle cx="40" cy="40" r="4"/>
    <circle cx="60" cy="40" r="4"/>
    <circle cx="40" cy="40" r="2" fill="currentColor"/>
    <circle cx="60" cy="40" r="2" fill="currentColor"/>
    <path d="M42,54 Q50,60 58,54"/>
    <ellipse cx="50" cy="72" rx="22" ry="18"/>
    <path d="M50,90 Q50,98 46,102"/>
  </svg>`,

  '🐟': `<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M90,35 Q100,10 120,5 Q110,25 120,35 Q110,45 120,65 Q100,60 90,35"/>
    <path d="M90,35 Q60,10 10,35 Q60,60 90,35"/>
    <circle cx="78" cy="30" r="4"/>
    <circle cx="78" cy="30" r="1.5" fill="currentColor"/>
    <path d="M30,22 Q38,35 30,48"/>
    <path d="M50,18 Q58,35 50,52"/>
  </svg>`,

  '🌿': `<svg viewBox="0 0 90 110" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M45,105 Q45,60 45,20"/>
    <path d="M45,80 Q20,60 10,35 Q30,30 45,55"/>
    <path d="M45,60 Q70,42 82,18 Q62,14 45,38"/>
    <path d="M45,40 Q25,28 18,8 Q38,5 48,28"/>
  </svg>`,

};

/** Category/keyword → emoji fallback map */
const KEYWORD_MAP: Record<string, string> = {
  bug: '🐛', caterpillar: '🐛', millipede: '🐛', worm: '🐛',
  octopus: '🐙', squid: '🐙',
  cat: '🐱', kitten: '🐱',
  eagle: '🦅', falcon: '🦅', bird: '🦅', hawk: '🦅',
  beer: '🍺', drink: '🍺', alcohol: '🍺',
  world: '🌍', globe: '🌍', earth: '🌍', map: '🌍',
  temperature: '🌡️', thermometer: '🌡️', heat: '🌡️',
  spider: '🕷️', arachnid: '🕷️',
  lion: '🦁', cat2: '🦁',
  fish: '🐟', salmon: '🐟',
  plant: '🌿', leaf: '🌿', nature: '🌿',
};

/** Return SVG string for a given emoji or keyword, or undefined if not found */
export function getAnimalSvg(iconOrKeyword: string): string | undefined {
  if (!iconOrKeyword) return undefined;
  // Direct emoji match
  if (ANIMAL_ICONS[iconOrKeyword]) return ANIMAL_ICONS[iconOrKeyword];
  // Keyword match (lowercase)
  const key = iconOrKeyword.toLowerCase().trim();
  const emoji = KEYWORD_MAP[key];
  return emoji ? ANIMAL_ICONS[emoji] : undefined;
}
