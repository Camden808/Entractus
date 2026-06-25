import { useEffect, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../lib/auth';

/**
 * Gate any subtree (typically a route element) on the current user being
 * an admin. Behavior by auth state:
 *
 *   loading         → show a brief "Checking your access…" placeholder
 *   unauthenticated → redirect to /login (user can return after signing in)
 *   user (non-admin) → redirect to /
 *   admin           → render `children`
 */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (state.status === 'unauthenticated') {
      navigate('/login', { replace: true });
      return;
    }
    if (state.status === 'authenticated' && state.user.role !== 'admin') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status === 'loading') {
    return (
      <section aria-labelledby="admin-gate-heading" className="mx-auto max-w-3xl space-y-4">
        <h1 id="admin-gate-heading" className="text-2xl font-semibold text-brand-900">
          Admin
        </h1>
        <p role="status" className="text-sm text-ink-muted">
          Checking your access…
        </p>
      </section>
    );
  }

  if (state.status === 'unauthenticated' || state.user.role !== 'admin') {
    // The effect handles the redirect; render nothing while we wait for it.
    return null;
  }

  return <>{children}</>;
}

export default RequireAdmin;
