import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { DailySummaryPage } from './pages/DailySummaryPage';
import { LogWriterPage } from './pages/LogWriterPage';
import { ReproducedPage } from './pages/ReproducedPage';

const router = createBrowserRouter([
  {
    path: '/',
    element: <LogWriterPage />,
  },

  {
    path: '/summary',
    element: <DailySummaryPage />,
  },
  {
    path: '/reproduced',
    element: <ReproducedPage />,
  },
]);

export const Routes = () => <RouterProvider router={router} />;
