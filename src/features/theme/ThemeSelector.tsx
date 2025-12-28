import './theme-transition.css';

import clsx from 'clsx';
import { Check, Moon, Sun } from 'lucide-react';

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
  const IconComponent = isLightTheme ? Sun : Moon;

  return (
    <button
      tabIndex={0}
      className="btn btn-circle btn-ghost transition-transform duration-200 hover:rotate-12"
      aria-label="테마 선택"
    >
      <IconComponent size={16} />
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

  return (
    <li key={themeName}>
      <button
        onClick={() => setTheme(themeName)}
        className={clsx({ active: isActive })}
      >
        <span className="flex-1">{makeThemeNameReadable(themeName)}</span>
        {isActive && <Check size={16} className="text-primary" />}
      </button>
    </li>
  );
}
