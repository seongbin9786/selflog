import './App.css';

import { BarChart2, FileText, PlusCircle } from 'lucide-react';
import { useMemo } from 'react';

import { Command, CommandPalette } from './components/CommandPalette';
import { useCommandPalette } from './hooks/useCommandPalette';
import { Routes } from './Routes';
import { focusActivityInput } from './utils/commandEvents';

export const App = () => {
  const { isOpen, close } = useCommandPalette();

  const commands: Command[] = useMemo(
    () => [
      {
        id: 'focus-activity-input',
        label: '신규 활동 추가',
        description: '활동 입력창으로 이동하여 새 활동을 기록합니다',
        icon: <PlusCircle size={18} />,
        action: focusActivityInput,
        keywords: ['활동', '추가', '입력', 'activity', 'add', 'new'],
      },
      {
        id: 'go-to-writer',
        label: '기록지 페이지로 이동',
        description: '오늘의 활동을 기록하는 페이지로 이동합니다',
        icon: <FileText size={18} />,
        action: () => {
          window.location.href = '/';
        },
        keywords: ['기록', '작성', 'writer', 'log'],
      },
      {
        id: 'go-to-summary',
        label: '일일 요약 페이지로 이동',
        description: '오늘의 활동 요약을 확인합니다',
        icon: <BarChart2 size={18} />,
        action: () => {
          window.location.href = '/summary';
        },
        keywords: ['요약', 'summary', '통계', 'stats'],
      },
    ],
    [],
  );

  return (
    <>
      <Routes />
      <CommandPalette isOpen={isOpen} onClose={close} commands={commands} />
    </>
  );
};
