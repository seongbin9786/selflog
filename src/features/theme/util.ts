import {
  AVAILABLE_THEMES,
  DEFAULT_DARK_THEME,
  DEFAULT_LIGHT_THEME,
  Theme,
  THEME_STORAGE_KEY,
} from './config';

export function makeThemeNameReadable(themeName: string) {
  return themeName
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function checkIsValidTheme(theme: string | null): theme is Theme {
  return theme !== null && AVAILABLE_THEMES.includes(theme as Theme);
}

// NOTE: daisy-ui 방식
export function setDaisyUiThemeCssVariable(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function loadSavedTheme(): Theme {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const validTheme = checkIsValidTheme(savedTheme)
    ? savedTheme
    : getIsDarkMode()
      ? DEFAULT_DARK_THEME
      : DEFAULT_LIGHT_THEME;

  setDaisyUiThemeCssVariable(validTheme);

  return validTheme;
}

function getIsDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}
