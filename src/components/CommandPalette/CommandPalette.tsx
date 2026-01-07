import clsx from 'clsx';
import { Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 검색어로 커맨드 필터링
  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;

    const query = searchQuery.toLowerCase();
    return commands.filter((command) => {
      const labelMatch = command.label.toLowerCase().includes(query);
      const descriptionMatch = command.description
        ?.toLowerCase()
        .includes(query);
      const keywordMatch = command.keywords?.some((keyword) =>
        keyword.toLowerCase().includes(query),
      );
      return labelMatch || descriptionMatch || keywordMatch;
    });
  }, [commands, searchQuery]);

  // 팔레트가 열릴 때 상태 초기화 및 포커스
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, selectedIndex, filteredCommands]);

  // 선택된 항목이 보이도록 스크롤
  useEffect(() => {
    if (listRef.current && filteredCommands.length > 0) {
      const selectedElement = listRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, filteredCommands.length]);

  // 검색어 변경 시 선택 인덱스 초기화
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="modal modal-open">
      {/* 배경 클릭 시 닫기 */}
      <div className="modal-backdrop" onClick={onClose} />

      <div className="modal-box relative max-w-lg overflow-hidden p-0">
        {/* 검색 입력 */}
        <div className="flex items-center gap-3 border-b border-base-300 px-4 py-3">
          <Search className="h-5 w-5 text-base-content/50" />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-base-content/40"
            placeholder="명령어 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <kbd className="kbd kbd-sm">ESC</kbd>
        </div>

        {/* 커맨드 목록 */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-base-content/50">
              검색 결과가 없습니다
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <button
                key={command.id}
                type="button"
                className={clsx(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
                  index === selectedIndex
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-base-200',
                )}
                onClick={() => {
                  command.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                {command.icon && (
                  <span className="flex-shrink-0">{command.icon}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{command.label}</div>
                  {command.description && (
                    <div className="truncate text-sm text-base-content/60">
                      {command.description}
                    </div>
                  )}
                </div>
                {index === selectedIndex && <kbd className="kbd kbd-sm">↵</kbd>}
              </button>
            ))
          )}
        </div>

        {/* 도움말 */}
        <div className="flex items-center justify-between border-t border-base-300 bg-base-200/50 px-4 py-2 text-xs text-base-content/60">
          <div className="flex items-center gap-4">
            <span>
              <kbd className="kbd kbd-xs">↑</kbd>
              <kbd className="kbd kbd-xs">↓</kbd> 이동
            </span>
            <span>
              <kbd className="kbd kbd-xs">↵</kbd> 실행
            </span>
          </div>
          <span>
            <kbd className="kbd kbd-xs">ESC</kbd> 닫기
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
