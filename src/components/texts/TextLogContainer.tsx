import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useShake } from '../../hooks/useShake';
import { RootState } from '../../store';
import { updateRawLog } from '../../store/logs';
import { StorageListener } from '../../utils/StorageListener';
import { ProductiveToggle } from './ProductiveToggle';

const storageListener = new StorageListener();

export const TextLogContainer = () => {
  const checkboxRef = useRef<HTMLInputElement>(null); // NOTE: +/- 여부를 스페이스바로 쉽게 토글하고, 탭으로 곧장 quick input으로 이동 가능하므로, checkbox에 focus 둠.
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [quickInput, setQuickInput] = useState('');
  const [isProductive, setIsProductive] = useState(true);
  const { isShaking, shake } = useShake();

  const { currentDate, rawLogs } = useSelector(
    (state: RootState) => state.logs,
  );
  const dispatch = useDispatch();
  const setRawLogs = (nextRawLog: string) => dispatch(updateRawLog(nextRawLog));

  useEffect(
    function updateChartEvery30Seconds() {
      const timer = setInterval(() => {
        dispatch(updateRawLog(rawLogs));
      }, 30_000);
      return () => clearInterval(timer);
    },
    [rawLogs, dispatch],
  );

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
    const isInputEmpty = !quickInput.trim();
    if (isInputEmpty) {
      shake();
      inputRef.current?.focus();
      return;
    }

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;

    const plusMinus = isProductive ? '+' : '-';
    const newLogItem = `[${timeStr}] ${plusMinus} ${quickInput.trim()}`;
    const updatedRawLog = rawLogs.trimEnd().concat(`\n${newLogItem}`);

    setRawLogs(updatedRawLog);
    resetInputs();
    textareaRef.current?.focus();
  };

  const resetInputs = () => {
    setQuickInput('');
    setIsProductive(true);
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
        <ProductiveToggle
          isProductive={isProductive}
          setIsProductive={setIsProductive}
          onKeyDown={handleEnterOnCheckbox}
          checkboxRef={checkboxRef}
        />
        <input
          ref={inputRef}
          type="text"
          className={`input input-bordered flex-1 text-xs ${
            isShaking ? 'shake-animation' : ''
          }`}
          placeholder="Enter 키를 눌러 활동 내역 추가"
          value={quickInput}
          onChange={handleQuickInputChange}
          onKeyDown={handleEnterOnTextInput}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={appendLog}
        >
          추가
        </button>
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
