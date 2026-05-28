const BADGES = [
  { tier: 'I',   icon: 'R',  name: 'Rookie',          desc: 'First prediction published onchain.', unlocked: true },
  { tier: 'II',  icon: 'S',  name: 'Streaker',        desc: 'Hit 3 predictions in a row.',        unlocked: true },
  { tier: 'III', icon: 'X',  name: 'xG Hunter',       desc: 'Top 25% on xG-aligned picks.',       unlocked: true },
  { tier: 'IV',  icon: 'D',  name: 'Derby Oracle',    desc: 'Called a derby outside consensus.',  unlocked: false },
  { tier: 'V',   icon: 'W',  name: 'Whale Whisperer', desc: 'Front-ran sharp wallet flow.',       unlocked: false },
  { tier: 'VI',  icon: 'L',  name: 'Legend',          desc: 'Top 10 leaderboard for a season.',   unlocked: false },
];

export default function FanBadges() {
  return (
    <div className="card">
      <h3 className="card-title">// Fan Identity · Badges</h3>
      <p style={{ margin: '0 0 14px', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
        Reputation NFTs that unlock as your onchain track record grows. Soulbound, portable across the alpha graph.
      </p>
      <div className="badges">
        {BADGES.map((b) => (
          <div key={b.name} className={`badge ${b.unlocked ? '' : 'locked'}`}>
            <span className="tier">{b.tier}</span>
            <div className="icon">{b.icon}</div>
            <div className="name">{b.name}</div>
            <div className="desc">{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
