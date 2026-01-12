import { ArrowRight, Loader2, Lock, User as UserIcon, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { login, signup } from '../../services/LogService';
import { loginSuccess } from '../../store/auth';

type AuthMode = 'login' | 'signup';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: AuthMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setMode(initialMode);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialMode]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await login(username, password);
      if (result && result.access_token) {
        dispatch(loginSuccess({ token: result.access_token, username }));
        onClose();
        navigate('/');
      }
    } catch {
      setError('로그인에 실패했습니다. 아이디와 비밀번호를 확인해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await signup(username, password);
      // Auto login after signup
      const result = await login(username, password);
      if (result && result.access_token) {
        dispatch(loginSuccess({ token: result.access_token, username }));
        onClose();
        navigate('/');
      }
    } catch {
      setError('회원가입에 실패했습니다. 이미 사용 중인 아이디일 수 있습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'login') {
      handleLogin();
    } else {
      handleSignup();
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
    setPassword('');
    setConfirmPassword('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="modal-box relative max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-base-100/95 p-0 shadow-2xl backdrop-blur-xl">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="btn btn-circle btn-ghost btn-sm absolute right-4 top-4 z-10 text-base-content/50 hover:text-base-content"
        >
          <X size={18} />
        </button>

        {/* Header Section */}
        <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/10 to-transparent px-8 pb-6 pt-10">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="absolute -left-4 top-12 h-20 w-20 rounded-full bg-secondary/20 blur-xl" />

          <div className="relative">
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === 'login' ? '다시 오셨군요!' : '시작해볼까요?'}
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              {mode === 'login'
                ? '계정에 로그인하세요'
                : '새 계정을 만들어보세요'}
            </p>
          </div>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="px-8 py-6">
          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-xl border border-error/20 bg-error/10 px-4 py-3 text-sm text-error">
              {error}
            </div>
          )}

          {/* Username Input */}
          <div className="form-control mb-4">
            <label className="label pb-1">
              <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                사용자 이름
              </span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <UserIcon size={16} className="text-base-content/30" />
              </div>
              <input
                ref={inputRef}
                type="text"
                placeholder="username"
                className="input input-bordered w-full rounded-xl border-base-content/10 bg-base-200/50 pl-11 transition-all placeholder:text-base-content/30 focus:border-primary focus:bg-base-200"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="form-control mb-4">
            <label className="label pb-1">
              <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                비밀번호
              </span>
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Lock size={16} className="text-base-content/30" />
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="input input-bordered w-full rounded-xl border-base-content/10 bg-base-200/50 pl-11 transition-all placeholder:text-base-content/30 focus:border-primary focus:bg-base-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Confirm Password (Signup only) */}
          {mode === 'signup' && (
            <div className="form-control mb-4">
              <label className="label pb-1">
                <span className="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">
                  비밀번호 확인
                </span>
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <Lock size={16} className="text-base-content/30" />
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="input input-bordered w-full rounded-xl border-base-content/10 bg-base-200/50 pl-11 transition-all placeholder:text-base-content/30 focus:border-primary focus:bg-base-200"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn btn-primary mt-2 w-full rounded-xl shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>처리 중...</span>
              </>
            ) : (
              <>
                <span>{mode === 'login' ? '로그인' : '회원가입'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Footer - Mode Switch */}
        <div className="border-t border-base-content/5 bg-base-200/30 px-8 py-4">
          <p className="text-center text-sm text-base-content/60">
            {mode === 'login' ? (
              <>
                계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-semibold text-primary transition-colors hover:text-primary-focus hover:underline"
                >
                  회원가입
                </button>
              </>
            ) : (
              <>
                이미 계정이 있으신가요?{' '}
                <button
                  type="button"
                  onClick={switchMode}
                  className="font-semibold text-primary transition-colors hover:text-primary-focus hover:underline"
                >
                  로그인
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
