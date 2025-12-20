import { useState } from 'react';

export const SHAKE_DURATION = 600;

export const useShake = () => {
  const [isShaking, setIsShaking] = useState(false);

  const shake = () => {
    setIsShaking(true);

    setTimeout(() => {
      setIsShaking(false);
    }, SHAKE_DURATION);
  };

  return { isShaking, shake };
};
