import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getCurrentTimeStringConsideringMaxTime,
  getMaxTimeFromLogs,
  parseTimeInput,
  timeToMinutes,
} from './timeUtils';

describe('parseTimeInput', () => {
  it('유효한 시간 입력(HH:mm)을 파싱한다', () => {
    expect(parseTimeInput('10:30')).toBe('10:30');
    expect(parseTimeInput('09:00')).toBe('09:00');
    expect(parseTimeInput('9:00')).toBe('09:00'); // 1자리 시간도 허용
  });

  it('24시간을 넘어가는 시간을 파싱한다', () => {
    expect(parseTimeInput('25:00')).toBe('25:00');
    expect(parseTimeInput('26:30')).toBe('26:30');
    expect(parseTimeInput('48:59')).toBe('48:59');
  });

  it('잘못된 형식에 대해 null을 반환한다', () => {
    expect(parseTimeInput('invalid')).toBeNull();
    expect(parseTimeInput('25:60')).toBeNull(); // 60분은 유효하지 않음
    expect(parseTimeInput('')).toBeNull();
  });

  it('콜론 없이 숫자만 입력해도 파싱한다', () => {
    expect(parseTimeInput('0025')).toBe('00:25');
    expect(parseTimeInput('1230')).toBe('12:30');
    expect(parseTimeInput('930')).toBe('09:30');
    expect(parseTimeInput('000')).toBe('00:00');
  });

  it('콜론 없이 24시간을 넘어가는 시간을 파싱한다', () => {
    expect(parseTimeInput('2530')).toBe('25:30');
    expect(parseTimeInput('26000')).toBe('260:00');
  });

  it('1~2자리 숫자는 시간으로 인식한다', () => {
    expect(parseTimeInput('9')).toBe('09:00');
    expect(parseTimeInput('12')).toBe('12:00');
    expect(parseTimeInput('25')).toBe('25:00');
  });

  it('숫자만 입력 시 잘못된 형식에 대해 null을 반환한다', () => {
    expect(parseTimeInput('1260')).toBeNull(); // 60분은 유효하지 않음
  });
});

describe('timeToMinutes', () => {
  it('시간을 분 단위로 변환한다', () => {
    expect(timeToMinutes('10:30')).toBe(630); // 10*60 + 30
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('24시간을 넘어가는 시간을 처리한다', () => {
    expect(timeToMinutes('25:00')).toBe(1500); // 25*60
    expect(timeToMinutes('26:30')).toBe(1590); // 26*60 + 30
    expect(timeToMinutes('48:59')).toBe(2939); // 48*60 + 59
  });
});

describe('getMaxTimeFromLogs', () => {
  it('빈 로그에 대해 -1을 반환한다', () => {
    expect(getMaxTimeFromLogs('')).toBe(-1);
    expect(getMaxTimeFromLogs('   ')).toBe(-1);
  });

  it('로그에서 최대 시간을 추출한다', () => {
    const logs = `[10:00] + 작업 시작
[12:30] - 점심
[15:00] + 작업 재개`;
    expect(getMaxTimeFromLogs(logs)).toBe(900); // 15*60
  });

  it('24시간을 넘어가는 시간을 처리한다', () => {
    const logs = `[23:00] + 작업 시작
[25:30] - 늦은 작업
[26:00] + 계속`;
    expect(getMaxTimeFromLogs(logs)).toBe(1560); // 26*60
  });

  it('1자리와 2자리 시간 형식이 섞여있어도 처리한다', () => {
    const logs = `[09:00] + 시작
[23:30] - 늦은 작업
[25:00] + 새벽 작업`;
    expect(getMaxTimeFromLogs(logs)).toBe(1500); // 25*60
  });
});

describe('getCurrentTimeStringConsideringMaxTime', () => {
  beforeEach(() => {
    // 매 테스트 전에 시간 mock 초기화
    vi.restoreAllMocks();
  });

  it('maxTime이 -1인 경우 현재 시각을 그대로 반환한다', () => {
    // 현재 시각을 14:30으로 mock
    vi.setSystemTime(new Date(2024, 0, 1, 14, 30));

    const result = getCurrentTimeStringConsideringMaxTime(-1);
    expect(result).toBe('14:30');
  });

  it('최대 시간보다 현재 시각이 큰 경우 그대로 반환한다', () => {
    // 현재 시각을 16:00으로 mock
    vi.setSystemTime(new Date(2024, 0, 1, 16, 0));

    const maxTime = 14 * 60 + 30; // 14:30
    const result = getCurrentTimeStringConsideringMaxTime(maxTime);
    expect(result).toBe('16:00'); // 16:00 > 14:30이므로 그대로
  });

  it('자정을 넘어간 경우 24시간을 더한다', () => {
    // 현재 시각을 01:30으로 mock (새벽)
    vi.setSystemTime(new Date(2024, 0, 1, 1, 30));

    const maxTime = 23 * 60 + 45; // 23:45
    const result = getCurrentTimeStringConsideringMaxTime(maxTime);
    expect(result).toBe('25:30'); // 01:30 + 24 = 25:30
  });

  it('이미 24시간을 넘긴 기록이 있는 경우 적절히 처리한다', () => {
    // 현재 시각을 02:00으로 mock
    vi.setSystemTime(new Date(2024, 0, 1, 2, 0));

    const maxTime = 25 * 60 + 30; // 25:30
    const result = getCurrentTimeStringConsideringMaxTime(maxTime);
    expect(result).toBe('26:00'); // 02:00 + 24 = 26:00 (25:30보다 커야 함)
  });
});
