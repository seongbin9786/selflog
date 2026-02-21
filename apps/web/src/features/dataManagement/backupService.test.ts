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
      expect(filename).toMatch(
        /my-commit-server-backup-\d{4}-\d{2}-\d{2}\.json/,
      );

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

    it('should omit empty-date logs when exporting server backup json', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { date: '2024-01-01', content: '' },
            { date: '2024-01-02', content: 'log2' },
          ],
        }),
      } as Response);

      await fetchAndDownloadServerBackup(mockToken);

      const [blob] = vi.mocked(saveAs).mock.calls[0];
      const text = await (blob as Blob).text();
      const data = JSON.parse(text);

      expect(data.logs).toEqual({
        '2024-01-02': 'log2',
      });
    });
  });

  describe('createBackup', () => {
    const mockStorage: Record<string, string> = {};
    const storageMock = {
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value;
      }),
      getItem: vi.fn((key) => mockStorage[key] || null),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      key: vi.fn((i) => Object.keys(mockStorage)[i] || null),
      length: 0,
    };

    beforeEach(() => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      vi.clearAllMocks();
      Object.defineProperty(storageMock, 'length', {
        get: () => Object.keys(mockStorage).length,
        configurable: true,
      });
      vi.stubGlobal('localStorage', storageMock);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should sort log dates in ascending order when exporting', async () => {
      storageMock.setItem(
        '2026-01-12',
        JSON.stringify({
          content: 'second',
          contentHash: 'hash-2',
          parentHash: null,
          localUpdatedAt: '2026-01-12T00:00:00Z',
        }),
      );
      storageMock.setItem(
        '2026-01-10',
        JSON.stringify({
          content: 'first',
          contentHash: 'hash-1',
          parentHash: null,
          localUpdatedAt: '2026-01-10T00:00:00Z',
        }),
      );

      const { createBackup } = await import('./backupService');
      const backup = createBackup();

      expect(Object.keys(backup.logs)).toEqual(['2026-01-10', '2026-01-12']);
    });

    it('should unwrap storage wrapper content when exporting', async () => {
      storageMock.setItem(
        '2026-01-12',
        JSON.stringify({
          content: JSON.stringify({
            content: '[09:00] + 작업',
            contentHash: 'inner-hash',
            parentHash: null,
            localUpdatedAt: '2026-01-12T00:00:00Z',
          }),
          contentHash: 'outer-hash',
          parentHash: null,
          localUpdatedAt: '2026-01-12T00:00:00Z',
        }),
      );

      const { createBackup } = await import('./backupService');
      const backup = createBackup();

      expect(backup.logs['2026-01-12']).toBe('[09:00] + 작업');
    });

    it('should omit empty-date logs when exporting json backup', async () => {
      storageMock.setItem(
        '2026-01-12',
        JSON.stringify({
          content: '',
          contentHash: 'hash-empty',
          parentHash: null,
          localUpdatedAt: '2026-01-12T00:00:00Z',
        }),
      );
      storageMock.setItem(
        '2026-01-13',
        JSON.stringify({
          content: 'not empty',
          contentHash: 'hash-value',
          parentHash: null,
          localUpdatedAt: '2026-01-13T00:00:00Z',
        }),
      );

      const { createBackup } = await import('./backupService');
      const backup = createBackup();

      expect(backup.logs).toEqual({
        '2026-01-13': 'not empty',
      });
    });

    it('should keep default sound option and remove custom audio data in backup', async () => {
      storageMock.setItem(
        'soundSettings',
        JSON.stringify({
          selectedSound: 'custom',
          customSoundData: 'data:audio/mp3;base64,AAAABBBBCCCC',
          customSoundName: 'my-custom.mp3',
          infiniteRepeat: false,
        }),
      );

      const { createBackup } = await import('./backupService');
      const backup = createBackup();
      const soundSettings = JSON.parse(backup.settings.soundSettings!);

      expect(soundSettings).toEqual({
        selectedSound: 'beep',
        customSoundData: null,
        customSoundName: null,
        infiniteRepeat: false,
      });
    });

    it('should preserve non-custom sound option in backup', async () => {
      storageMock.setItem(
        'soundSettings',
        JSON.stringify({
          selectedSound: 'bell',
          customSoundData: null,
          customSoundName: null,
          infiniteRepeat: true,
        }),
      );

      const { createBackup } = await import('./backupService');
      const backup = createBackup();
      const soundSettings = JSON.parse(backup.settings.soundSettings!);

      expect(soundSettings).toEqual({
        selectedSound: 'bell',
        customSoundData: null,
        customSoundName: null,
        infiniteRepeat: true,
      });
    });
  });

  describe('importBackup', () => {
    const mockStorage: Record<string, string> = {};
    const storageMock = {
      setItem: vi.fn((key, value) => {
        mockStorage[key] = value;
      }),
      getItem: vi.fn((key) => mockStorage[key] || null),
      removeItem: vi.fn((key) => {
        delete mockStorage[key];
      }),
      clear: vi.fn(() => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      }),
      key: vi.fn((i) => Object.keys(mockStorage)[i] || null),
      length: 0,
    };

    beforeEach(() => {
      Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      vi.clearAllMocks();

      Object.defineProperty(storageMock, 'length', {
        get: () => Object.keys(mockStorage).length,
        configurable: true,
      });

      vi.stubGlobal('localStorage', storageMock);

      // Mock FileReader to run synchronously for easier testing
      class MockFileReader {
        onload: (e: Partial<ProgressEvent<FileReader>>) => void = () => {};
        readAsText(file: File & { _content?: string }) {
          // Sync call to avoid promise race in tests
          this.onload({ target: { result: file._content || '' } } as Partial<
            ProgressEvent<FileReader>
          >);
        }
      }
      vi.stubGlobal('FileReader', MockFileReader);
      global.fetch = vi.fn();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const createMockFile = (content: Record<string, unknown>, name: string) => {
      const json = JSON.stringify(content);
      const file = new File([json], name, { type: 'application/json' });
      // @ts-expect-error - 로컬 환경 FileReader 모킹을 위해 내용 직접 주입
      file._content = json;
      return file;
    };

    it('should import new format backup', async () => {
      const mockBackup = {
        logs: { '2025-12-25': 'log content' },
        settings: { 'app-theme': 'forest' },
      };
      const file = createMockFile(mockBackup, 'backup.json');

      const { importBackup } = await import('./backupService');
      await importBackup(file);

      expect(storageMock.setItem).toHaveBeenCalledWith('app-theme', 'forest');
      expect(storageMock.setItem).toHaveBeenCalledWith(
        '2025-12-25',
        expect.stringContaining('log content'),
      );
    });

    it('should normalize wrapped content from backup on import', async () => {
      const wrapped = JSON.stringify({
        content: '[09:00] + 작업',
        contentHash: 'old-hash',
        parentHash: null,
        localUpdatedAt: '2026-01-12T00:00:00Z',
      });
      const mockBackup = {
        logs: { '2025-12-25': wrapped },
        settings: {},
      };
      const file = createMockFile(mockBackup, 'backup.json');

      const { importBackup } = await import('./backupService');
      await importBackup(file);

      const stored = mockStorage['2025-12-25'];
      const parsed = JSON.parse(stored);
      expect(parsed.content).toBe('[09:00] + 작업');
    });

    it('should import legacy format backup and sync to server', async () => {
      const legacyBackup = {
        '2025-12-20': 'legacy log',
        'app-theme': 'dark',
      };
      const file = createMockFile(legacyBackup, 'legacy.json');

      // Mock token for sync
      storageMock.setItem('token', 'mock-token');

      // Mock bulkSaveLogsToServer
      const mockSavedLogs = [
        {
          date: '2025-12-20',
          content: 'legacy log',
          contentHash: 'hash-123',
          parentHash: null,
          updatedAt: '2026-01-12T00:00:00Z',
        },
      ];
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockSavedLogs }),
      } as Response);

      const { importBackup } = await import('./backupService');
      await importBackup(file);

      // Verify server sync
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/raw-logs/bulk'),
        expect.objectContaining({ method: 'POST' }),
      );

      // Verify localStorage (server-provided data should be stored)
      expect(storageMock.setItem).toHaveBeenCalledWith(
        '2025-12-20',
        expect.stringContaining('hash-123'),
      );
    });

    it('should clear existing logs before applying backup', async () => {
      const backup = { logs: { '2025-12-25': 'new log' }, settings: {} };
      const file = createMockFile(backup, 'backup.json');

      // Setup existing logs
      storageMock.setItem('2025-12-24', 'old log');

      const { importBackup } = await import('./backupService');
      await importBackup(file);

      expect(storageMock.removeItem).toHaveBeenCalledWith('2025-12-24');
      expect(storageMock.setItem).toHaveBeenCalledWith(
        '2025-12-25',
        expect.stringContaining('new log'),
      );
      // Ensure old log is gone from mockStorage
      expect(mockStorage['2025-12-24']).toBeUndefined();
    });
  });
});
