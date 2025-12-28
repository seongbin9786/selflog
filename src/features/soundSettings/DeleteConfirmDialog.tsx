import React from 'react';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 삭제 확인 Dialog 컴포넌트
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  isOpen,
  fileName,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal modal-open" onClick={onCancel}>
      <div className="modal-box max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold">커스텀 사운드 삭제</h3>
        <p className="py-4">
          커스텀 사운드 파일을 삭제하시겠습니까?
          <br />
          <span className="text-sm text-gray-500">파일명: {fileName}</span>
        </p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn btn-error" onClick={onConfirm}>
            삭제
          </button>
        </div>
      </div>
    </div>
  );
};
