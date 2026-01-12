// Command Palette에서 사용되는 커스텀 이벤트 정의

export const FOCUS_ACTIVITY_INPUT_EVENT = 'focusActivityInput';

/**
 * 신규 활동 입력창으로 focus 이벤트 발생
 */
export const focusActivityInput = () => {
  window.dispatchEvent(new CustomEvent(FOCUS_ACTIVITY_INPUT_EVENT));
};

/**
 * 신규 활동 입력창 focus 이벤트 리스너 등록
 */
export const ADD_PRODUCTION_START_EVENT = 'addProductionStart';
export const ADD_CONSUMPTION_START_EVENT = 'addConsumptionStart';

export const addFocusActivityInputListener = (callback: () => void) => {
  window.addEventListener(FOCUS_ACTIVITY_INPUT_EVENT, callback);
  return () => window.removeEventListener(FOCUS_ACTIVITY_INPUT_EVENT, callback);
};

export const dispatchAddProductionStart = (content?: string) => {
  window.dispatchEvent(
    new CustomEvent(ADD_PRODUCTION_START_EVENT, { detail: { content } }),
  );
};

export const dispatchAddConsumptionStart = (content?: string) => {
  window.dispatchEvent(
    new CustomEvent(ADD_CONSUMPTION_START_EVENT, { detail: { content } }),
  );
};

export const addProductionStartListener = (
  callback: (content?: string) => void,
) => {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent;
    callback(customEvent.detail?.content);
  };
  window.addEventListener(ADD_PRODUCTION_START_EVENT, handler);
  return () => window.removeEventListener(ADD_PRODUCTION_START_EVENT, handler);
};

export const addConsumptionStartListener = (
  callback: (content?: string) => void,
) => {
  const handler = (e: Event) => {
    const customEvent = e as CustomEvent;
    callback(customEvent.detail?.content);
  };
  window.addEventListener(ADD_CONSUMPTION_START_EVENT, handler);
  return () => window.removeEventListener(ADD_CONSUMPTION_START_EVENT, handler);
};
