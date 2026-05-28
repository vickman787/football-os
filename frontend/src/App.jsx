import { Routes, Route } from 'react-router-dom';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import LoadingScreen from './components/LoadingScreen.jsx';
import Home from './pages/Home.jsx';
import Predictions from './pages/Predictions.jsx';
import Signals from './pages/Signals.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import Wallet from './pages/Wallet.jsx';

export default function App() {
  return (
    <div className="app">
      <LoadingScreen />
      <Nav />
      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/wallet" element={<Wallet />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
