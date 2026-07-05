export interface Project {
  project_id: string;
  project_name: string;
  createdAt?: string;
}

// ── Deterministic thumbnail (gradient + emoji) derived from the project id ──
const PROJECT_GRADIENTS: [string, string][] = [
  ['#6C5CE7', '#378ADD'],
  ['#1D9E75', '#639922'],
  ['#D85A30', '#BA7517'],
  ['#378ADD', '#6C5CE7'],
  ['#BA7517', '#D85A30'],
  ['#639922', '#1D9E75'],
];

const PROJECT_EMOJIS = ['📊', '📈', '🏆', '🌍', '⚡', '🔥', '💡', '🎯', '🧠', '🚀', '📌', '🎲'];

export interface ProjectVisual {
  gradient: string;
  emoji: string;
}

export function projectVisual(id: string): ProjectVisual {
  let h = 0;
  for (const ch of id || 'x') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [from, to] = PROJECT_GRADIENTS[h % PROJECT_GRADIENTS.length];
  const emoji = PROJECT_EMOJIS[(h >>> 3) % PROJECT_EMOJIS.length];
  return { gradient: `linear-gradient(135deg, ${from}, ${to})`, emoji };
}

/** Monogram initials from a project name, e.g. "telangana stats" → "TS". */
export function projectInitials(name: string): string {
  const n = (name ?? '').trim();
  if (!n) return '·';
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
