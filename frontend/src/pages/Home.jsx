import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useFetch } from '../lib/useFetch.js';
import { Loading, ErrorState } from '../components/States.jsx';
import FanBadges from '../components/FanBadges.jsx';
import OnchainCard from '../components/OnchainCard.jsx';

export default function Home() {
  const matchesQ = useFetch(api.matches);
  const signalsQ = useFetch(api.signals);
  const leaderboardQ = useFetch(api.leaderboard);

  const allLoading = matchesQ.loading || signalsQ.loading || leaderboardQ.loading;
  const anyError = matchesQ.error || signalsQ.error || leaderboardQ.error;

  function refetchAll() {
    matchesQ.refetch();
    signalsQ.refetch();
    leaderboardQ.refetch();
  }

  return (
    <>
      <section className="card hero">
        <div>
          <div className="eyebrow">Football Intelligence · X Layer</div>
          <h2>The onchain operating system for <span>football alpha</span>.</h2>
          <p>
            Football OS fuses an AI prediction engine, a real-time signal feed, and an onchain
            leaderboard into one console. Every prediction is anchored to X Layer as a
            verifiable proof, so winning calls compound into reputation, not screenshots.
          </p>
          <div className="hero-cta">
            <Link to="/wallet" className="btn primary">Connect Wallet</Link>
            <Link to="/predictions" className="btn">AI Predictions</Link>
            <Link to="/signals" className="btn ghost">Live Signals</Link>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat">
            <div className="v">{matchesQ.loading ? '—' : matchesQ.data?.matches?.length ?? 0}</div>
            <div className="l">Active Matches</div>
          </div>
          <div className="stat">
            <div className="v">{signalsQ.loading ? '—' : signalsQ.data?.signals?.length ?? 0}</div>
            <div className="l">Live Signals</div>
          </div>
          <div className="stat">
            <div className="v">{leaderboardQ.loading ? '—' : leaderboardQ.data?.leaderboard?.length ?? 0}</div>
            <div className="l">Ranked Predictors</div>
          </div>
          <div className="stat"><div className="v">X·196</div><div className="l">X Layer Mainnet</div></div>
        </div>
      </section>

      {anyError && (
        <div style={{ marginBottom: 16 }}>
          <ErrorState error={anyError} onRetry={refetchAll} baseUrl={api.baseUrl} />
        </div>
      )}
      {allLoading && !anyError && (
        <div className="card" style={{ marginBottom: 16 }}>
          <Loading label="Connecting to Football OS API" />
        </div>
      )}

      <section className="section-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3 className="card-title">// Prediction engine</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Ensemble of xG models, lineup signals, and live odds movement. Each call ships with
            confidence, probabilities, and reasoning so you can argue with the model, not just trust it.
          </p>
        </div>
        <OnchainCard />
      </section>

      <section style={{ marginBottom: 16 }}>
        <FanBadges />
      </section>

      <section className="section-grid">
        <div className="card">
          <h3 className="card-title">// Signal feed</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Lineup leaks, sharp odds movement, weather, onchain whale activity — all streamed
            into one dashboard so you see edges the moment they form.
          </p>
        </div>
        <div className="card">
          <h3 className="card-title">// Leaderboard</h3>
          <p style={{ margin: 0, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Top predictors ranked by accuracy and ROI. Every pick is hash-anchored to X Layer,
            so reputation is verifiable and portable.
          </p>
        </div>
      </section>
    </>
  );
}
