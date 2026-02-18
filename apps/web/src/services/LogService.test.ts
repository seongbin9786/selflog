import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { calculateHashSync } from '../utils/HashUtil';
import { getLogFromServer } from './LogService';

describe('LogService.getLogFromServer', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('서버 기본 빈 응답은 null로 처리해야 함', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          date: '2026-02-18',
          content: '',
        }),
      }),
    );

    const result = await getLogFromServer('2026-02-18');

    expect(result).toBeNull();
  });

  it('레거시 응답(contentHash 없음)에서는 content로 hash를 계산해야 함', async () => {
    const content = '[09:00] legacy log';

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          userId: 'u1',
          date: '2026-02-18',
          content,
          parentHash: null,
          updatedAt: '2026-02-18T10:00:00.000Z',
        }),
      }),
    );

    const result = await getLogFromServer('2026-02-18');

    expect(result).not.toBeNull();
    expect(result?.content).toBe(content);
    expect(result?.contentHash).toBe(calculateHashSync(content));
    expect(result?.parentHash).toBeNull();
  });

  it('data 래퍼 응답도 정상 파싱해야 함', async () => {
    const payload = {
      userId: 'u1',
      date: '2026-02-18',
      content: '[10:00] wrapped response',
      contentHash: 'hash-123',
      parentHash: 'hash-122',
      updatedAt: '2026-02-18T11:00:00.000Z',
      version: 3,
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          data: payload,
        }),
      }),
    );

    const result = await getLogFromServer('2026-02-18');

    expect(result).toEqual(payload);
  });
});
