import { loadSavedTheme } from './util';

// NOTE: 앱 로드 전에 저장된 테마를 적용하여 깜빡임 방지 (preference를 기본값으로 첫 렌더링을 수행하게 되므로)
loadSavedTheme();
