import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { DailySummaryPage } from './pages/DailySummaryPage';
import { LogWriterPage } from './pages/LogWriterPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LogWriterPage />,
  },
  {
    path: '/summary',
    element: <DailySummaryPage />,
  },
]);

export const Routes = () => <RouterProvider router={router} />;
