// ─────────────────────────────────────────────────────────────────────────────
// Football OS · Branded loading screen
//
// Full-bleed splash shown on first paint. Auto-fades out after a minimum
// duration so users always see the brand for at least a moment without
// stalling them on a fast network.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import Logo from './Logo.jsx';

export default function LoadingScreen({ minMs = 700 }) {
  const [phase, setPhase] = useState('shown'); // 'shown' | 'fading' | 'gone'

  useEffect(() => {
    const fadeTimer = setTimeout(() => setPhase('fading'), minMs);
    const goneTimer = setTimeout(() => setPhase('gone'), minMs + 450);
    return () => { clearTimeout(fadeTimer); clearTimeout(goneTimer); };
  }, [minMs]);

  if (phase === 'gone') return null;

  return (
    <div className={`splash ${phase === 'fading' ? 'splash--fading' : ''}`} aria-hidden>
      <div className="splash-orb">
        <Logo size={120} glow />
      </div>
      <div className="splash-meta">
        <div className="splash-eyebrow">FOOTBALL · OS</div>
        <div className="splash-tag">AI · FOOTBALL · ONCHAIN</div>
        <div className="splash-bar"><span /></div>
      </div>
    </div>
  );
}
