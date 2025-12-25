import './theme-transition.css';

import clsx from 'clsx';

import MoonIcon from '../../assets/icons/moon.svg?react';
import SunIcon from '../../assets/icons/sun.svg?react';
import { LIGHT_THEMES, Theme } from './config';
import { useTheme } from './useTheme';
import { makeThemeNameReadable } from './util';

export const ThemeSelector = () => {
  const { theme, setTheme, availableThemes } = useTheme();

  return (
    <div className="dropdown-end dropdown">
      <ThemeSelectorButton theme={theme} />
      <ThemeList
        availableThemes={availableThemes}
        currentTheme={theme}
        setTheme={setTheme}
      />
    </div>
  );
};
interface ThemeSelectorButtonProps {
  theme: Theme;
}

function ThemeSelectorButton({ theme }: ThemeSelectorButtonProps) {
  const isLightTheme = LIGHT_THEMES.includes(theme);
  const IconComponent = isLightTheme ? SunIcon : MoonIcon;

  return (
    <button
      tabIndex={0}
      className="btn btn-circle btn-ghost transition-transform duration-200 hover:rotate-12"
      aria-label="테마 선택"
    >
      <IconComponent className="h-6 w-6" />
    </button>
  );
}

interface ThemeListProps {
  availableThemes: readonly Theme[];
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}

function ThemeList({
  availableThemes,
  currentTheme,
  setTheme,
}: ThemeListProps) {
  return (
    <ul
      tabIndex={0}
      className="menu dropdown-content rounded-box z-[1] mt-3 max-h-96 w-[400px] overflow-y-auto bg-base-200 p-2 shadow"
    >
      {availableThemes.map((themeName) => (
        <ThemeListItem
          key={themeName}
          themeName={themeName}
          currentTheme={currentTheme}
          setTheme={setTheme}
        />
      ))}
    </ul>
  );
}

interface ThemeListItemProps {
  themeName: Theme;
  currentTheme: Theme;
  setTheme: (theme: Theme) => void;
}

function ThemeListItem({
  themeName,
  currentTheme,
  setTheme,
}: ThemeListItemProps) {
  const isActive = currentTheme === themeName;
  console.log(themeName, '=> isActive', isActive, currentTheme);

  return (
    <li key={themeName}>
      <button
        onClick={() => setTheme(themeName)}
        className={clsx({ active: isActive })}
      >
        <span className="flex-1">{makeThemeNameReadable(themeName)}</span>
        {isActive && <span className="text-primary">✓</span>}
      </button>
    </li>
  );
}
