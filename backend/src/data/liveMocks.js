export const mockLiveMatches = [
  {
    id: 9001,
    league: 'Premier League',
    country: 'England',
    kickoff: '2026-05-28T17:30:00Z',
    status: '2H',
    elapsed: 67,
    venue: 'Emirates Stadium',
    home: { id: 42, name: 'Arsenal', logo: null, goals: 2, winner: null },
    away: { id: 50, name: 'Manchester City', logo: null, goals: 1, winner: null },
  },
  {
    id: 9002,
    league: 'La Liga',
    country: 'Spain',
    kickoff: '2026-05-28T18:00:00Z',
    status: '1H',
    elapsed: 32,
    venue: 'Santiago Bernabéu',
    home: { id: 541, name: 'Real Madrid', logo: null, goals: 0, winner: null },
    away: { id: 529, name: 'Barcelona', logo: null, goals: 0, winner: null },
  },
  {
    id: 9003,
    league: 'Serie A',
    country: 'Italy',
    kickoff: '2026-05-28T18:45:00Z',
    status: 'HT',
    elapsed: 45,
    venue: 'Giuseppe Meazza',
    home: { id: 505, name: 'Inter', logo: null, goals: 1, winner: true },
    away: { id: 496, name: 'Juventus', logo: null, goals: 0, winner: false },
  },
];

export const mockTeams = {
  42: {
    id: 42, name: 'Arsenal', code: 'ARS', country: 'England', founded: 1886, national: false, logo: null,
    venue: { name: 'Emirates Stadium', city: 'London', capacity: 60260, image: null },
  },
  541: {
    id: 541, name: 'Real Madrid', code: 'REA', country: 'Spain', founded: 1902, national: false, logo: null,
    venue: { name: 'Santiago Bernabéu', city: 'Madrid', capacity: 81044, image: null },
  },
  505: {
    id: 505, name: 'Inter', code: 'INT', country: 'Italy', founded: 1908, national: false, logo: null,
    venue: { name: 'Giuseppe Meazza', city: 'Milan', capacity: 80018, image: null },
  },
};

export const mockPredictionsFeed = [
  {
    fixtureId: 9101,
    league: 'Premier League',
    home: { id: 42, name: 'Arsenal', logo: null },
    away: { id: 50, name: 'Manchester City', logo: null },
    advice: 'Combo Double chance : Arsenal or draw and -3.5 goals',
    winner: { id: 42, name: 'Arsenal', comment: 'Win or draw' },
    winOrDraw: true,
    underOver: '-3.5',
    goals: { home: '-1.5', away: '-1.5' },
    percent: { home: '54%', draw: '25%', away: '21%' },
  },
  {
    fixtureId: 9102,
    league: 'La Liga',
    home: { id: 541, name: 'Real Madrid', logo: null },
    away: { id: 529, name: 'Barcelona', logo: null },
    advice: 'Goals Over 2.5',
    winner: null,
    winOrDraw: false,
    underOver: '+2.5',
    goals: { home: '+1.5', away: '+1.5' },
    percent: { home: '45%', draw: '24%', away: '31%' },
  },
];
