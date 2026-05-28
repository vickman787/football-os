import { NavLink } from 'react-router-dom';

export default function Nav() {
  return (
    <header className="nav">
      <div className="brand">
        <span className="dot" />
        <span>FOOTBALL · OS</span>
      </div>
      <nav className="nav-links">
        <NavLink to="/" end>Console</NavLink>
        <NavLink to="/predictions">AI Predictions</NavLink>
        <NavLink to="/signals">Signal Feed</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
      </nav>
      <div className="nav-spacer" />
      <NavLink to="/wallet" className="btn primary" style={{ textDecoration: 'none' }}>
        Connect Wallet
      </NavLink>
    </header>
  );
}
