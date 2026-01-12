import { useEffect, useState } from 'react';

import { AVAILABLE_THEMES, Theme, THEME_STORAGE_KEY } from './config';
import { loadSavedTheme, setDaisyUiThemeCssVariable } from './util';

// WARNING: Context로 구현되지 않았음에 주의 - 추후 한 페이지를 벗어나면 Context로 이관 예정
export const useTheme = () => {
  const [theme, setTheme] = useState<Theme>(loadSavedTheme);

  useEffect(() => {
    setDaisyUiThemeCssVariable(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return { theme, setTheme, availableThemes: AVAILABLE_THEMES };
};
