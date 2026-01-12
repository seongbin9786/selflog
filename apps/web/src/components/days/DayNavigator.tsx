import { useDispatch } from 'react-redux';

import { goToNextDate, goToPrevDate, goToToday } from '../../store/logs';

const PREV_DAY_BUTTON_TEXT = '←';
const TODAY_BUTTON_TEXT = '오늘';
const NEXT_DAY_BUTTON_TEXT = '→';

export const DayNavigator = () => {
  const dispatch = useDispatch();
  const handleTodayButton = () => dispatch(goToToday());
  const handleYesterdayButton = () => dispatch(goToPrevDate());
  const handleTomorrowButton = () => dispatch(goToNextDate());

  return (
    <div className="flex gap-1">
      <button className="btn btn-xs sm:btn-sm" onClick={handleYesterdayButton}>
        <span className="sm:text-lg">{PREV_DAY_BUTTON_TEXT}</span>
      </button>
      <button
        className="btn btn-primary btn-xs sm:btn-sm"
        onClick={handleTodayButton}
      >
        <span className="sm:text-lg">{TODAY_BUTTON_TEXT}</span>
      </button>
      <button className="btn btn-xs sm:btn-sm" onClick={handleTomorrowButton}>
        <span className="sm:text-lg">{NEXT_DAY_BUTTON_TEXT}</span>
      </button>
    </div>
  );
};
