import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-20 text-center">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-ink-100">
        <Compass className="size-6 text-ink-400" />
      </span>
      <h1 className="text-lg font-semibold text-ink-900">Page not found</h1>
      <p className="mt-2 text-sm text-ink-500">
        This route does not exist in the admin console.
      </p>
      <Link to="/" className="mt-5 inline-block text-sm font-medium text-brand-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
