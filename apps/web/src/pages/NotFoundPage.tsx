import { Link } from 'react-router';

function NotFoundPage() {
  return (
    <section aria-labelledby="not-found-heading" className="space-y-4">
      <h1 id="not-found-heading" className="text-3xl font-semibold text-brand-900">
        Page Not Found
      </h1>
      <p className="text-ink-muted">
        The page you are looking for does not exist.{' '}
        <Link to="/" className="text-brand-600 underline hover:text-brand-700">
          Return home
        </Link>
        .
      </p>
    </section>
  );
}

export default NotFoundPage;
