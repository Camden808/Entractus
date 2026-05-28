import type { RouteObject } from 'react-router';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import EmployersPage from './pages/EmployersPage';
import ContactPage from './pages/ContactPage';
import JobsPage from './pages/JobsPage';
import AboutPage from './pages/AboutPage';
import BlogPage from './pages/BlogPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AccountPage from './pages/AccountPage';
import AdminJobsPage from './pages/AdminJobsPage';
import NotFoundPage from './pages/NotFoundPage';
import RequireAdmin from './components/RequireAdmin';

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'employers', element: <EmployersPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'jobs', element: <JobsPage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'blog', element: <BlogPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'reset-password', element: <ResetPasswordPage /> },
      { path: 'account', element: <AccountPage /> },
      {
        path: 'admin/jobs',
        element: (
          <RequireAdmin>
            <AdminJobsPage />
          </RequireAdmin>
        ),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];
