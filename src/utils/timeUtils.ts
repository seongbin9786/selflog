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
 * 시간 입력 문자열을 파싱하여 유효한 HH:mm 형식으로 반환
 * @param input 사용자 입력 문자열
 * @returns 유효한 시간 문자열 또는 null (유효하지 않은 경우)
 */
export const parseTimeInput = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const timeRegex = /^(\d{1,2}):(\d{2})$/;
  const match = trimmed.match(timeRegex);
  if (!match) return null;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

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
