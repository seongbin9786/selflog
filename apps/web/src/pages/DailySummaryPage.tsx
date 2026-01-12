import { DailySummaryChart } from '../components/charts/DailySummaryChart';
import { ThemeSelector } from '../features/theme/ThemeSelector';

// TODO: 페이지에 UI 요소 추가하기 (지금은 비어있지만)
export const DailySummaryPage = () => (
  <div className="h-screen w-screen">
    <div className="flex justify-end p-4">
      <ThemeSelector />
    </div>
    <DailySummaryChart />
  </div>
);
