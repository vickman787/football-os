import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="foot">
      <span className="foot-brand">
        <Logo size={18} glow={false} />
        <span>FOOTBALL · OS · MVP</span>
      </span>
      <span>Anchored on X Layer · zkEVM</span>
    </footer>
  );
}
