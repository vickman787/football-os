export function Loading({ label = 'Loading' }) {
  return (
    <div className="loading">
      <span className="spinner" />
      <span className="loading-label">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry, baseUrl }) {
  const message = error?.message || String(error || 'Unknown error');
  return (
    <div className="card error-state">
      <div className="error-head">
        <span className="chip bad">CONNECTION ERROR</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-dim)' }}>
          {baseUrl}
        </span>
      </div>
      <p style={{ margin: '12px 0 4px', color: 'var(--text)' }}>Could not reach the Football OS API.</p>
      <p style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-dim)' }}>
        {message}
      </p>
      <p style={{ margin: '12px 0 16px', fontSize: 13, color: 'var(--text-dim)' }}>
        Check that the backend is running on <strong style={{ color: 'var(--accent)' }}>{baseUrl}</strong>{' '}
        and that <code>VITE_API_URL</code> in <code>.env</code> matches.
      </p>
      {onRetry && (
        <button className="btn primary" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

export function Skeleton({ height = 80, count = 1 }) {
  return (
    <div className="skeleton-stack">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}
