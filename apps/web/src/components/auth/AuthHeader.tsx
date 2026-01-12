import { LogIn, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { RootState } from '../../store';
import { logout } from '../../store/auth';
import { AuthModal } from './AuthModal';

type AuthModalMode = 'login' | 'signup';

export const AuthHeader = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, username } = useSelector(
    (state: RootState) => state.auth,
  );

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<AuthModalMode>('login');

  const openModal = (mode: AuthModalMode) => {
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  if (!isAuthenticated) {
    return (
      <>
        <button
          type="button"
          onClick={() => openModal('login')}
          className="btn btn-ghost btn-sm gap-1.5 rounded-lg font-medium text-base-content/70 transition-colors hover:bg-base-content/10 hover:text-base-content"
        >
          <LogIn size={15} />
        </button>

        <AuthModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          initialMode={modalMode}
        />
      </>
    );
  }

  return (
    <div className="dropdown dropdown-end">
      <button
        type="button"
        tabIndex={0}
        className="btn btn-ghost btn-sm gap-2 rounded-lg font-medium text-base-content/70 transition-colors hover:bg-base-content/10 hover:text-base-content"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User size={14} />
        </div>
        <span className="hidden sm:inline">{username}</span>
      </button>
      <ul
        tabIndex={0}
        className="menu dropdown-content z-[1] mt-2 w-48 rounded-xl border border-base-content/5 bg-base-100 p-2 shadow-xl"
      >
        <li>
          <button
            type="button"
            onClick={handleLogout}
            className="gap-2.5 rounded-lg text-error/80 hover:bg-error/10 hover:text-error"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </li>
      </ul>
    </div>
  );
};
