import { GraphConfig } from '../models/graph.model';

export type AvatarColor = 'purple' | 'blue' | 'green' | 'red' | 'yellow';
export type CardTemplate = 'featured' | 'mini' | 'ranking' | 'fact';

export interface RankingItem {
  label: string;
  value: number;
  emoji?: string;
}

export interface ExploreCategory {
  id: string;
  label: string;
  emoji: string;
}

export interface ExploreTopic {
  title: string;
  category: string;
  categoryEmoji: string;
  prompt: string;
  icon: string;
  color: AvatarColor;
  cardTemplate: CardTemplate;
  insight: string;
  badge?: string;
  views?: string;
  shares?: string;
  bigStat?: string;
  bigStatLabel?: string;
  rankingItems?: RankingItem[];
  chartConfig?: GraphConfig;
}

export const EXPLORE_CATEGORIES: ExploreCategory[] = [
  { id: 'Trending', label: 'Trending',  emoji: '🔥' },
  { id: 'World',    label: 'World',     emoji: '🌍' },
  { id: 'India',    label: 'India',     emoji: '🇮🇳' },
  { id: 'Business', label: 'Business',  emoji: '💸' },
  { id: 'Tech',     label: 'Tech',      emoji: '📱' },
  { id: 'Health',   label: 'Health',    emoji: '🧠' },
];

const C = {
  purple: '#6C5CE7',
  blue:   '#378ADD',
  green:  '#1D9E75',
  red:    '#D85A30',
  yellow: '#BA7517',
};

function barCfg(labels: string[], data: number[], color: string): GraphConfig {
  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: '', data, backgroundColor: color + 'CC', borderWidth: 0, borderRadius: 4 } as any],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false as any,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  };
}

function lineCfg(labels: string[], data: number[], color: string): GraphConfig {
  return {
    type: 'line',
    data: {
      labels,
      datasets: [{ label: '', data, borderColor: color, backgroundColor: color + '22',
        borderWidth: 2.5, fill: true, tension: 0.4, pointRadius: 0 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false as any,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  };
}

function doughnutCfg(labels: string[], data: number[], colors: string[]): GraphConfig {
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ label: '', data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false as any,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      cutout: '60%',
    },
  };
}

export const EXPLORE_TOPICS: ExploreTopic[] = [
  // ── FEATURED ────────────────────────────────────────────────────────────
  {
    title: 'Which country spends the most time on social media?',
    category: 'Trending',
    categoryEmoji: '🔥',
    prompt: 'Which country spends the most time on social media?',
    icon: 'phone-portrait-outline',
    color: 'purple',
    cardTemplate: 'featured',
    badge: '📈 Rising',
    insight: 'Brazil leads at 3.8 hrs/day — more than double the global average.',
    views: '18.4k',
    shares: '520',
    chartConfig: barCfg(
      ['Brazil', 'Colombia', 'Argentina', 'UAE', 'Philippines', 'India'],
      [3.8, 3.6, 3.4, 3.2, 3.1, 2.9],
      C.purple,
    ),
  },

  // ── MINI PAIR 1 ──────────────────────────────────────────────────────────
  {
    title: 'Happiest countries in 2024',
    category: 'World',
    categoryEmoji: '🌍',
    prompt: 'Which countries are happiest?',
    icon: 'happy-outline',
    color: 'yellow',
    cardTemplate: 'mini',
    badge: '😊 Feel-good',
    insight: 'Finland tops for the 7th year running.',
    views: '9.2k',
    shares: '280',
    chartConfig: barCfg(
      ['Finland', 'Denmark', 'Iceland', 'Israel', 'Netherlands'],
      [7.7, 7.6, 7.5, 7.5, 7.4],
      C.yellow,
    ),
  },
  {
    title: 'Coffee consumption by country',
    category: 'Trending',
    categoryEmoji: '🔥',
    prompt: 'Coffee consumption by country per capita',
    icon: 'cafe-outline',
    color: 'red',
    cardTemplate: 'mini',
    badge: '☕ Surprising',
    insight: 'Finland drinks 4x more coffee than Italy.',
    views: '11.1k',
    shares: '340',
    chartConfig: barCfg(
      ['Finland', 'Norway', 'Iceland', 'Denmark', 'Netherlands'],
      [12.0, 9.9, 9.0, 8.7, 8.4],
      C.red,
    ),
  },

  // ── RANKING ──────────────────────────────────────────────────────────────
  {
    title: 'Top 5 deadliest animals to humans',
    category: 'World',
    categoryEmoji: '🌍',
    prompt: 'What are the deadliest animals to humans?',
    icon: 'skull-outline',
    color: 'red',
    cardTemplate: 'ranking',
    badge: '🤯 Weird gap',
    insight: 'Mosquitoes kill more people than all other animals combined.',
    views: '22.8k',
    shares: '890',
    rankingItems: [
      { label: 'Mosquito',  value: 725000, emoji: '🦟' },
      { label: 'Human',     value: 475000, emoji: '🧑' },
      { label: 'Snake',     value: 138000, emoji: '🐍' },
      { label: 'Dog',       value: 59000,  emoji: '🐕' },
      { label: 'Tsetse Fly',value: 30000,  emoji: '🪲' },
    ],
  },

  // ── MINI PAIR 2 ──────────────────────────────────────────────────────────
  {
    title: 'Smartphone usage by age group',
    category: 'Tech',
    categoryEmoji: '📱',
    prompt: 'Smartphone usage by age group',
    icon: 'hardware-chip-outline',
    color: 'blue',
    cardTemplate: 'mini',
    badge: '📱 Tech',
    insight: '99% of 18–24 year olds own a smartphone.',
    views: '7.6k',
    shares: '190',
    chartConfig: lineCfg(
      ['13-17', '18-24', '25-34', '35-44', '55-64', '65+'],
      [95, 99, 98, 92, 71, 53],
      C.blue,
    ),
  },
  {
    title: 'AI adoption across industries',
    category: 'Tech',
    categoryEmoji: '📱',
    prompt: 'AI adoption rate across industries in 2024',
    icon: 'sparkles-outline',
    color: 'purple',
    cardTemplate: 'mini',
    badge: '🚀 Fast moving',
    insight: 'Tech leads at 78% — government barely hits 28%.',
    views: '14.3k',
    shares: '460',
    chartConfig: barCfg(
      ['Tech', 'Finance', 'Healthcare', 'Retail', 'Edu', 'Govt'],
      [78, 61, 52, 48, 33, 28],
      C.purple,
    ),
  },

  // ── AI FACT CARD ─────────────────────────────────────────────────────────
  {
    title: 'Charts about food get 2.3× more shares than charts about politics.',
    category: 'Trending',
    categoryEmoji: '🔥',
    prompt: '',
    icon: 'bulb-outline',
    color: 'yellow',
    cardTemplate: 'fact',
    badge: '🤖 AI Insight',
    insight: 'Food, animals, and money topics consistently drive the most engagement on WeirdStats.',
    views: '31.2k',
    shares: '1.2k',
  },

  // ── FEATURED ─────────────────────────────────────────────────────────────
  {
    title: 'Which country has the best healthcare system?',
    category: 'Health',
    categoryEmoji: '🧠',
    prompt: 'Which country has the best healthcare?',
    icon: 'heart-outline',
    color: 'green',
    cardTemplate: 'featured',
    badge: '🌎 Global',
    bigStat: '91',
    bigStatLabel: 'Switzerland scores 91/100 — the world\'s best.',
    insight: 'The US ranks 11th despite spending the most per capita.',
    views: '16.9k',
    shares: '610',
    chartConfig: barCfg(
      ['Switzerland', 'Norway', 'Netherlands', 'Germany', 'Sweden', 'USA'],
      [91, 88, 87, 86, 85, 69],
      C.green,
    ),
  },

  // ── MINI PAIR 3 ──────────────────────────────────────────────────────────
  {
    title: 'Countries with highest literacy rate',
    category: 'World',
    categoryEmoji: '🌍',
    prompt: 'Which countries have the highest literacy rate?',
    icon: 'school-outline',
    color: 'blue',
    cardTemplate: 'mini',
    badge: '📚 Education',
    insight: 'Finland & Norway both hit 100% literacy.',
    views: '6.8k',
    shares: '145',
    chartConfig: barCfg(
      ['Norway', 'Finland', 'Japan', 'Canada', 'Germany'],
      [99, 100, 99, 99, 99],
      C.blue,
    ),
  },
  {
    title: 'Top countries using renewable energy',
    category: 'World',
    categoryEmoji: '🌍',
    prompt: 'Top countries by renewable energy usage',
    icon: 'sunny-outline',
    color: 'green',
    cardTemplate: 'mini',
    badge: '♻️ Green',
    insight: 'Iceland runs on 99% renewable energy.',
    views: '8.3k',
    shares: '230',
    chartConfig: barCfg(
      ['Iceland', 'Norway', 'Costa Rica', 'New Zealand', 'Austria'],
      [99, 98, 91, 84, 78],
      C.green,
    ),
  },

  // ── RANKING ──────────────────────────────────────────────────────────────
  {
    title: 'Top economies in 2024',
    category: 'Business',
    categoryEmoji: '💸',
    prompt: 'Top 10 countries by GDP in 2024',
    icon: 'trending-up-outline',
    color: 'green',
    cardTemplate: 'ranking',
    badge: '💸 Business',
    insight: 'India overtook Japan to become the 4th largest economy.',
    views: '19.7k',
    shares: '750',
    rankingItems: [
      { label: 'USA',     value: 27,  emoji: '🇺🇸' },
      { label: 'China',   value: 18,  emoji: '🇨🇳' },
      { label: 'Germany', value: 4.5, emoji: '🇩🇪' },
      { label: 'India',   value: 3.7, emoji: '🇮🇳' },
      { label: 'Japan',   value: 4.2, emoji: '🇯🇵' },
    ],
  },

  // ── MINI PAIR 4 ──────────────────────────────────────────────────────────
  {
    title: 'Which industries make the most profit?',
    category: 'Business',
    categoryEmoji: '💸',
    prompt: 'Which industries make the most profit?',
    icon: 'briefcase-outline',
    color: 'purple',
    cardTemplate: 'mini',
    badge: '📊 Data',
    insight: 'Tech makes 3× more profit than retail.',
    views: '10.4k',
    shares: '295',
    chartConfig: doughnutCfg(
      ['Tech', 'Finance', 'Healthcare', 'Energy', 'Retail'],
      [32, 24, 18, 15, 11],
      [C.purple, C.blue, C.green, C.yellow, C.red],
    ),
  },
  {
    title: 'Average age by country — who is oldest?',
    category: 'World',
    categoryEmoji: '🌍',
    prompt: 'Average median age by country',
    icon: 'people-outline',
    color: 'yellow',
    cardTemplate: 'mini',
    badge: '🧓 Society',
    insight: 'Japan\'s median age of 48 is nearly 3× Nigeria\'s.',
    views: '7.1k',
    shares: '160',
    chartConfig: barCfg(
      ['Japan', 'Germany', 'Italy', 'Finland', 'India', 'Nigeria'],
      [48, 47, 46, 43, 28, 18],
      C.yellow,
    ),
  },
];
