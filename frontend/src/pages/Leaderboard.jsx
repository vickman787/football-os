import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { Loading, ErrorState, Skeleton } from '../components/States.jsx';

export default function Leaderboard() {
  const { data, error, loading, refetch } = useFetch(api.leaderboard);
  const rows = data?.leaderboard ?? [];

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">// Leaderboard · Onchain</span>
        <h1 className="title">Top predictors anchored to X Layer</h1>
        <p className="subtitle">
          Ranked by accuracy and ROI across published predictions. All picks are
          hash-anchored, so reputation is verifiable and portable.
        </p>
      </div>

      {error && <ErrorState error={error} onRetry={refetch} baseUrl={api.baseUrl} />}

      {loading && !error && (
        <>
          <Loading label="Fetching /api/leaderboard" />
          <Skeleton height={48} count={8} />
        </>
      )}

      {!loading && !error && (
        <div className="card" style={{ padding: 0 }}>
          <table className="lb">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Predictor</th>
                <th>Wallet</th>
                <th>Accuracy</th>
                <th>ROI</th>
                <th>Picks</th>
                <th>Streak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.wallet}>
                  <td className={`rank rank-${r.rank}`}>#{r.rank}</td>
                  <td className="handle">{r.handle}</td>
                  <td className="wallet">{r.wallet}</td>
                  <td className="num pos">{Math.round(r.accuracy * 100)}%</td>
                  <td className={`num ${r.roi >= 1 ? 'pos' : 'neg'}`}>{r.roi.toFixed(2)}x</td>
                  <td className="num">{r.picks}</td>
                  <td className="num">{r.streak > 0 ? `W${r.streak}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
