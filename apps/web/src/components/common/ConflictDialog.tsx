import { AlertTriangle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';

import { RootState } from '../../store';
import { resolveConflict, setConflict } from '../../store/logs';

export const ConflictDialog = () => {
  const dispatch = useDispatch();
  const conflict = useSelector((state: RootState) => state.logs.conflict);

  if (!conflict) return null;

  const handleChoice = (choice: 'local' | 'server') => {
    dispatch(resolveConflict({ choice }));
  };

  const handleCancel = () => {
    dispatch(setConflict(null));
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle className="text-error" size={24} />
          <h3 className="text-lg font-bold">동시 수정 충돌 감지</h3>
        </div>

        <p className="mb-4">
          이 날짜의 로그가 로컬과 서버에서 동시에 수정되었습니다. 어느 버전을
          사용할지 선택해주세요.
        </p>

        <div className="mb-4 grid grid-cols-2 gap-4">
          {/* 로컬 버전 */}
          <div className="rounded-lg border border-base-300 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">로컬 버전</h4>
              <div className="badge badge-info">
                {new Date(conflict.localUpdatedAt).toLocaleString()}
              </div>
            </div>
            <textarea
              className="textarea textarea-bordered h-64 w-full font-mono text-xs"
              value={conflict.localContent}
              readOnly
            />
          </div>

          {/* 서버 버전 */}
          <div className="rounded-lg border border-base-300 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="font-semibold">서버 버전</h4>
              <div className="badge badge-success">
                {new Date(conflict.serverUpdatedAt).toLocaleString()}
              </div>
            </div>
            <textarea
              className="textarea textarea-bordered h-64 w-full font-mono text-xs"
              value={conflict.serverContent}
              readOnly
            />
          </div>
        </div>

        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleCancel}
          >
            취소
          </button>
          <button
            type="button"
            className="btn btn-info"
            onClick={() => handleChoice('local')}
          >
            로컬 버전 사용
          </button>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => handleChoice('server')}
          >
            서버 버전 사용
          </button>
        </div>
      </div>
    </div>
  );
};
