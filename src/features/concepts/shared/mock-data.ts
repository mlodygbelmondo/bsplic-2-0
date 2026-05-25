import type { MockGoalscorer, MockParlay } from '../types';

export const mockGoalscorers: MockGoalscorer[] = [
  {
    id: 'gs-1',
    rank: 1,
    name: 'Lewandowski',
    team: 'Barcelona',
    opponent: 'Betis',
    time: '21:15',
    odds: 2.1,
    accent: '#b91c1c',
  },
  {
    id: 'gs-2',
    rank: 2,
    name: 'Mbappé',
    team: 'Real Madrid',
    opponent: 'Sevilla',
    time: '22:00',
    odds: 1.85,
    accent: '#e11d48',
  },
  {
    id: 'gs-3',
    rank: 3,
    name: 'Haaland',
    team: 'Man City',
    opponent: 'Arsenal',
    time: '18:30',
    odds: 2.35,
    accent: '#6366f1',
  },
  {
    id: 'gs-4',
    rank: 4,
    name: 'Kane',
    team: 'Bayern',
    opponent: 'Dortmund',
    time: '20:45',
    odds: 1.95,
    accent: '#dc2626',
  },
];

export const mockParlays: MockParlay[] = [
  {
    id: 'pl-1',
    label: 'Super piątek',
    legs: ['Barcelona', 'Real Madrid', 'Bayern'],
    odds: 4.82,
    picks: 3,
  },
  {
    id: 'pl-2',
    label: 'Underdogi dnia',
    legs: ['Betis +1', 'Sevilla remis', 'Arsenal gol'],
    odds: 12.4,
    picks: 3,
  },
  {
    id: 'pl-3',
    label: 'Strzelcy combo',
    legs: ['Lewandowski', 'Mbappé', 'Haaland'],
    odds: 8.15,
    picks: 3,
  },
];

export const matchHeroImages = [
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1522778119026-d647f056a1c8?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1508098682722-e99c43aeca06?auto=format&fit=crop&w=800&q=80',
];

export const getHeroImage = (index: number) =>
  matchHeroImages[index % matchHeroImages.length];
