import { NavLink, Link } from 'react-router-dom';
import { useWallet } from '../lib/WalletContext.jsx';
import WalletMenu from './WalletMenu.jsx';
import Logo from './Logo.jsx';

export default function Nav() {
  const { address } = useWallet();

  return (
    <header className="nav">
      <Link to="/" className="brand brand--link" aria-label="Football OS home">
        <Logo size={32} />
        <span className="brand-text">FOOTBALL · OS</span>
      </Link>
      <nav className="nav-links">
        <NavLink to="/" end>Console</NavLink>
        <NavLink to="/predictions">AI Predictions</NavLink>
        <NavLink to="/signals">Signal Feed</NavLink>
        <NavLink to="/leaderboard">Leaderboard</NavLink>
      </nav>
      <div className="nav-spacer" />
      {address ? (
        <WalletMenu variant="nav" />
      ) : (
        <NavLink to="/wallet" className="btn primary" style={{ textDecoration: 'none' }}>
          Connect Wallet
        </NavLink>
      )}
    </header>
  );
}
