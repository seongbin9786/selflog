import {
  AlertTriangle,
  Check,
  Download,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { AuthModal } from '../../components/auth/AuthModal';
import { RootState } from '../../store';
import {
  createBackup,
  downloadBackupInfo,
  exportLogsToExcel,
  fetchAndDownloadServerBackup,
  importBackup,
} from './backupService';
import { LogHistoryView } from './LogHistoryView';

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export const DataManagementDialog = ({ isOpen, onClose }: Props) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'sync' | 'backup'>('sync');
  const [importStatus, setImportStatus] = useState<string>('');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>(
    'login',
  );

  const openAuthModal = (mode: 'login' | 'signup') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const { isAuthenticated, token } = useSelector(
    (state: RootState) => state.auth,
  );
  const { currentDate } = useSelector((state: RootState) => state.logs);

  if (!isOpen) return null;

  const handleServerExport = async () => {
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      await fetchAndDownloadServerBackup(token);
    } catch (e) {
      console.error(e);
      alert('서버 백업 다운로드 실패');
    }
  };

  const handleExportJson = () => {
    const backup = createBackup();
    downloadBackupInfo(backup);
  };

  const handleExportExcel = () => {
    exportLogsToExcel();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await importBackup(file);
      setImportStatus('복구 성공! 페이지를 새로고침합니다...');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch {
      setImportStatus(
        '복구 실패: 올바르지 않은 파일 형식이거나 오류가 발생했습니다.',
      );
    }
  };

  return (
    <div className="modal modal-open modal-bottom sm:modal-middle">
      <div className="modal-box flex h-[600px] max-h-[80vh] w-full max-w-2xl flex-col">
        <h3 className="text-lg font-bold">백업</h3>

        <div className="my-4 flex gap-1 border-b border-base-300">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'sync'
                ? 'border-b-2 border-base-content text-base-content'
                : 'text-base-content/50 hover:text-base-content/70'
            }`}
            onClick={() => setActiveTab('sync')}
          >
            자동 서버 백업
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'backup'
                ? 'border-b-2 border-base-content text-base-content'
                : 'text-base-content/50 hover:text-base-content/70'
            }`}
            onClick={() => setActiveTab('backup')}
          >
            수동 백업
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {activeTab === 'backup' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-2 rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  서버 백업을 사용하지 않으면 브라우저 저장소(LocalStorage)에만
                  데이터가 보관됩니다. 데이터가 사라질 위험에 대비해 주기적으로
                  백업해주세요.
                </span>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-base-content">
                  클라이언트 데이터 내보내기
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    className="btn btn-ghost gap-2 border border-base-300 hover:bg-base-200"
                    onClick={handleExportJson}
                  >
                    <Download size={16} />
                    JSON 파일로 내보내기
                  </button>

                  <button
                    className="btn btn-ghost gap-2 border border-base-300 hover:bg-base-200"
                    onClick={handleExportExcel}
                  >
                    <FileSpreadsheet size={16} />
                    CSV 파일로 내보내기
                  </button>
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-base-content">
                  서버 데이터 내보내기
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    className="btn btn-ghost gap-2 border border-base-300 hover:bg-base-200"
                    onClick={handleServerExport}
                    disabled={!isAuthenticated}
                  >
                    <Download size={16} />
                    JSON 파일로 내보내기
                  </button>
                  {!isAuthenticated && (
                    <p className="text-xs text-error">
                      * 로그인이 필요한 기능입니다.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-base-content">
                  복구
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <button
                    className="btn btn-ghost gap-2 border border-base-300 hover:bg-base-200"
                    onClick={handleImportClick}
                  >
                    <Upload size={16} />
                    JSON 파일에서 복구하기
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".json"
                    onChange={handleFileChange}
                  />
                  {importStatus && (
                    <p className="text-sm font-bold text-base-content">
                      {importStatus}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sync' && (
            <div className="flex flex-col gap-4">
              {!isAuthenticated ? (
                <>
                  <div className="rounded-lg border border-base-300 bg-base-200 p-4 text-sm text-base-content/70">
                    <p className="mb-2 font-semibold text-base-content">
                      로그인이 필요합니다
                    </p>
                    <p className="mb-4">
                      안전한 서버 동기화를 위해 로그인해주세요.
                      <br />
                      로그인하면 여러 기기에서 데이터를 안전하게 동기화할 수
                      있습니다.
                    </p>
                    <button
                      className="btn btn-primary btn-sm w-full"
                      onClick={() => openAuthModal('login')}
                    >
                      로그인
                    </button>

                    <div className="divider my-4"></div>

                    <div className="space-y-2 text-sm text-base-content/60">
                      <h4 className="font-semibold text-base-content">
                        서버 동기화 기능:
                      </h4>
                      <ul className="ml-2 list-inside list-disc space-y-1">
                        <li>실시간 자동 동기화 (2초 디바운스)</li>
                        <li>Git 스타일 충돌 감지 및 해결</li>
                        <li>여러 기기에서 동시 사용 가능</li>
                        <li>오프라인 작업 후 자동 병합</li>
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/20 p-3 text-sm font-medium text-success">
                    <Check size={18} />
                    서버 동기화가 활성화되어 있습니다.
                  </div>
                </>
              )}

              <h4 className="font-semibold text-base-content">
                {currentDate} 수정 내역
              </h4>
              <LogHistoryView onClose={onClose} />
            </div>
          )}
        </div>

        <div className="modal-action mt-4">
          <button
            className="btn btn-ghost border border-base-300 hover:bg-base-200"
            onClick={onClose}
          >
            닫기
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose}></div>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
};
