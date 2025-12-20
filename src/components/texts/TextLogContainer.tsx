import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { RootState } from '../../store';
import { updateRawLog } from '../../store/logs';
import { StorageListener } from '../../utils/StorageListener';

const storageListener = new StorageListener();

export const TextLogContainer = () => {
  const checkboxRef = useRef<HTMLInputElement>(null); // NOTE: +/- 여부를 스페이스바로 쉽게 토글하고, 탭으로 곧장 quick input으로 이동 가능하므로, checkbox에 focus 둠.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [quickInput, setQuickInput] = useState('');
  const [isProductive, setIsProductive] = useState(true);

  const { currentDate, rawLogs } = useSelector(
    (state: RootState) => state.logs,
  );
  const dispatch = useDispatch();
  const setRawLogs = (nextRawLog: string) => dispatch(updateRawLog(nextRawLog));

  // TODO: 이게 무슨 동작인지 확인하기
  // 최근에 닫았던 탭을 다시 살리는 경우, input value가 채워진 상태로 켜짐.
  // 강제로 value를 rawLog로 동기화시킴.
  // 최초 렌더링 직후에 자동으로 채워진 텍스트는 안 보이게 됨.
  const synchronizeInput = () => {
    if (textareaRef.current) {
      textareaRef.current.value = rawLogs;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextRawLog = e.target.value;
    setRawLogs(nextRawLog);
  };

  const handleQuickInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuickInput(e.target.value);
  };

  const appendLog = () => {
    if (!quickInput.trim()) {
      return;
    }

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;

    const plusMinus = isProductive ? '+' : '-';
    const newLog = `[${timeStr}] ${plusMinus} ${quickInput.trim()}`;
    const updatedLogs = rawLogs ? `${rawLogs}\n${newLog}` : newLog;

    setRawLogs(updatedLogs);
    setQuickInput('');
    textareaRef.current?.focus();
  };

  const handleEnterOnTextInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // NOTE: Enter 입력 시 마지막 글자도 함께 입력됨
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      appendLog();
    }
  };

  const handleEnterOnCheckbox = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      appendLog();
    }
  };

  useEffect(() => {
    synchronizeInput();
    checkboxRef.current?.focus();
  }, []);

  // handleDateChange를 하지 말고, 여기서 return을 해서 cleanup을 하도록 하면 prevDate 만들 필요 없음.
  // https://legacy.reactjs.org/docs/hooks-faq.html#how-to-get-the-previous-props-or-state
  useEffect(() => {
    storageListener.install(currentDate, setRawLogs);
    checkboxRef.current?.focus();
  }, [currentDate]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={isProductive}
            onChange={(e) => setIsProductive(e.target.checked)}
            onKeyDown={handleEnterOnCheckbox}
            ref={checkboxRef}
          />
          <span className="text-xs">{isProductive ? '+' : '-'}</span>
        </label>
        <input
          type="text"
          className="input input-bordered flex-1 text-xs"
          placeholder="활동 내용 입력 후 엔터"
          value={quickInput}
          onChange={handleQuickInputChange}
          onKeyDown={handleEnterOnTextInput}
        />
      </div>

      <textarea
        className="textarea textarea-bordered textarea-lg mb-2 aspect-square flex-1 text-xs"
        value={rawLogs}
        ref={textareaRef}
        onChange={handleChange}
      />
    </div>
  );
};
