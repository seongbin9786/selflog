import { format } from 'date-fns';
import { AlertCircle, Archive, Loader2, RotateCcw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { BackupItem, getLogBackupsFromServer } from '../../services/LogService';
import { RootState } from '../../store';
import { updateRawLog } from '../../store/logs';

interface Props {
  onClose: () => void;
}

export const LogHistoryView = ({ onClose }: Props) => {
  const { currentDate } = useSelector((state: RootState) => state.logs);
  const dispatch = useDispatch();
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false);
  const [pendingRestoreContent, setPendingRestoreContent] = useState<
    string | null
  >(null);

  useEffect(() => {
    const fetchBackups = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getLogBackupsFromServer(currentDate);
        // Sort by backedUpAt desc
        const sorted = data.sort(
          (a, b) =>
            new Date(b.backedUpAt).getTime() - new Date(a.backedUpAt).getTime(),
        );
        setBackups(sorted);
      } catch {
        setError('백업 목록을 불러오는데 실패했습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBackups();
  }, [currentDate]);

  const handleRestoreClick = (content: string) => {
    setPendingRestoreContent(content);
    setRestoreConfirmOpen(true);
  };

  const confirmRestore = () => {
    if (pendingRestoreContent) {
      dispatch(updateRawLog(pendingRestoreContent));
      onClose();
    }
    setRestoreConfirmOpen(false);
    setPendingRestoreContent(null);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/50">
        <Loader2 className="mb-2 animate-spin" size={24} />
        <p className="text-sm">백업 기록을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-base-300 bg-base-200 p-3 text-sm text-base-content/70">
        <AlertCircle size={16} />
        <span>{error}</span>
      </div>
    );
  }

  if (backups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-base-content/50">
        <Archive className="mb-2 opacity-50" size={32} />
        <p>저장된 백업 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="mb-2 text-sm text-base-content/70">
        백업을 선택하여 내용을 복구할 수 있습니다. 복구 이후에도 기존 수정
        내역은 사라지지 않습니다.
      </p>

      {backups.map((backup) => (
        <div
          key={backup.backupId}
          className="rounded-lg border border-base-300 bg-base-100 shadow-sm transition-colors hover:bg-base-200/50"
        >
          <div className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">
                  {format(new Date(backup.backedUpAt), 'a h:mm:ss')}
                </span>
                <span className="text-xs text-base-content/60">
                  version {backup.originalVersion || '?'}
                </span>
              </div>
              <button
                className="btn btn-ghost btn-sm gap-2 border border-base-300 hover:bg-base-200"
                onClick={() => handleRestoreClick(backup.content)}
              >
                <RotateCcw size={14} />
                복구
              </button>
            </div>
            <div className="line-clamp-3 rounded bg-base-200 p-2 font-mono text-xs text-base-content/60">
              {backup.content || '(내용 없음)'}
            </div>
          </div>
        </div>
      ))}

      {/* Restore Confirmation Modal */}
      {restoreConfirmOpen && (
        <dialog className="modal modal-open modal-bottom sm:modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-bold">복구 확인</h3>
            <p className="py-4">
              이 버전으로 복구하시겠습니까?
              <br />
              <span className="text-sm text-base-content/70">
                현재 내용은 새로운 백업 버전으로 저장됩니다.
              </span>
            </p>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setRestoreConfirmOpen(false)}
              >
                취소
              </button>
              <button className="btn btn-primary" onClick={confirmRestore}>
                복구하기
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setRestoreConfirmOpen(false)}
          ></div>
        </dialog>
      )}
    </div>
  );
};
