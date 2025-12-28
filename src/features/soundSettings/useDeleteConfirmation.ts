import { useState } from 'react';

/**
 * 삭제 확인 dialog 상태를 관리하는 Hook
 */
export const useDeleteConfirmation = () => {
  const [showConfirm, setShowConfirm] = useState(false);

  const requestDelete = () => {
    setShowConfirm(true);
  };

  const confirmDelete = (onConfirm: () => void) => {
    onConfirm();
    setShowConfirm(false);
  };

  const cancelDelete = () => {
    setShowConfirm(false);
  };

  return {
    showConfirm,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
};
