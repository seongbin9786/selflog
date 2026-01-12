import { saveAs } from 'file-saver';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAndDownloadServerBackup } from './backupService';

// Mock file-saver
vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

// Mock Vite env
vi.stubGlobal('import', {
  meta: { env: { VITE_API_URL: 'http://localhost:3000' } },
});

describe('backupService', () => {
  describe('fetchAndDownloadServerBackup', () => {
    const mockToken = 'mock-token';
    const mockLogs = [
      { date: '2024-01-01', content: 'log1' },
      { date: '2024-01-02', content: 'log2' },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should fetch server logs and trigger download', async () => {
      // Mock successful fetch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockLogs }),
      } as Response);

      await fetchAndDownloadServerBackup(mockToken);

      // Verify fetch call
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/raw-logs'),
        {
          headers: {
            Authorization: `Bearer ${mockToken}`,
          },
        },
      );

      // Verify saveAs call
      expect(saveAs).toHaveBeenCalledTimes(1);
      const [blob, filename] = vi.mocked(saveAs).mock.calls[0];

      expect(blob as Blob).toBeInstanceOf(Blob);
      expect(filename).toMatch(/my-time-server-backup-\d{4}-\d{2}-\d{2}\.json/);

      // Verify blob content
      const text = await (blob as Blob).text();
      const data = JSON.parse(text);
      expect(data.logs).toEqual({
        '2024-01-01': 'log1',
        '2024-01-02': 'log2',
      });
      expect(data.settings).toEqual({});
    });

    it('should throw error when fetch fails', async () => {
      // Mock failed fetch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
      } as Response);

      await expect(fetchAndDownloadServerBackup(mockToken)).rejects.toThrow(
        'Failed to fetch server logs',
      );

      expect(saveAs).not.toHaveBeenCalled();
    });
  });
});
