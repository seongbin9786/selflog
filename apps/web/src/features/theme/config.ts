// DaisyUI의 모든 기본 테마
export const AVAILABLE_THEMES = [
  'light',
  'dark',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'synthwave',
  'retro',
  'cyberpunk',
  'valentine',
  'halloween',
  'garden',
  'forest',
  'aqua',
  'lofi',
  'pastel',
  'fantasy',
  'wireframe',
  'black',
  'luxury',
  'dracula',
  'cmyk',
  'autumn',
  'business',
  'acid',
  'lemonade',
  'night',
  'coffee',
  'winter',
] as const;

export type Theme = (typeof AVAILABLE_THEMES)[number];

// 라이트 계열 테마 목록
export const LIGHT_THEMES: Theme[] = [
  'light',
  'cupcake',
  'bumblebee',
  'emerald',
  'corporate',
  'fantasy',
  'wireframe',
  'cmyk',
  'autumn',
  'acid',
  'lemonade',
  'winter',
];

export const THEME_STORAGE_KEY = 'app-theme';
export const DEFAULT_LIGHT_THEME: Theme = 'cupcake';
export const DEFAULT_DARK_THEME: Theme = 'forest';
