/**
 * 현재 시각을 HH:mm 형식의 문자열로 반환
 */
export const getCurrentTimeString = (): string => {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
};

/**
 * 최대 시간을 고려하여 현재 시각을 반환
 * 현재 시각이 최대 시간보다 작거나 같으면 24시간을 더함
 * @param maxTimeInMinutes 최대 시간 (분 단위), -1이면 조정하지 않음
 * @returns 현재 시각 문자열 (HH:mm 또는 HHH:mm 형식)
 */
export const getCurrentTimeStringConsideringMaxTime = (
  maxTimeInMinutes: number,
): string => {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();

  if (maxTimeInMinutes !== -1) {
    let currentTimeInMinutes = hours * 60 + minutes;
    while (currentTimeInMinutes < maxTimeInMinutes) {
      hours += 24;
      currentTimeInMinutes = hours * 60 + minutes;
    }
  }

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
};

/**
 * 시간 입력 문자열을 파싱하여 유효한 HH:mm 형식으로 반환
 * @param input 사용자 입력 문자열 (예: "00:25", "0025", "1230")
 * @returns 유효한 시간 문자열 또는 null (유효하지 않은 경우)
 */
export const parseTimeInput = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  let hours: number;
  let minutes: number;

  // 콜론 여부에 따라 시간, 분 추출
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length !== 2) return null;
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
  } else {
    // 1~2자리: 시간으로 인식 (분은 00)
    if (trimmed.length <= 2) {
      hours = parseInt(trimmed, 10);
      minutes = 0;
    }
    // 3자리 이상: 뒤 2자리는 분, 나머지는 시간
    else {
      const hoursStr = trimmed.slice(0, -2);
      const minutesStr = trimmed.slice(-2);
      hours = parseInt(hoursStr, 10);
      minutes = parseInt(minutesStr, 10);
    }
  }

  // 유효성 검증
  if (isNaN(hours) || isNaN(minutes)) return null;
  // NOTE: hours 상한이 없는 이유: 자정 넘어서도 기록 가능 (e.g. 24:xx, 25:xx, ...)
  if (hours < 0 || minutes < 0 || minutes > 59) return null;

  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}`;
};

/**
 * HH:mm 형식의 시간 문자열을 분(minutes) 단위로 변환
 * @param timeStr HH:mm 형식의 시간 문자열
 * @returns 자정부터의 경과 시간 (분 단위)
 */
export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * rawLogs에서 최대 시간을 추출
 * @param rawLogs 전체 로그 문자열
 * @returns 최대 시간 (분 단위), 로그가 없으면 -1
 */
export const getMaxTimeFromLogs = (rawLogs: string): number => {
  if (!rawLogs || rawLogs.trim() === '') {
    return -1;
  }

  const lines = rawLogs.split('\n');
  let maxTime = -1;

  for (const line of lines) {
    if (line.trim() === '') continue;

    const timeMatch = line.match(/\[(\d{2}:\d{2})/);
    if (timeMatch) {
      const time = timeToMinutes(timeMatch[1]);
      maxTime = Math.max(maxTime, time);
    }
  }

  return maxTime;
};
