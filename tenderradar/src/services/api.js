import { tenders as mockTenders, winners as mockWinners } from '../data/tenders';

const API_BASE = '/api';

export async function fetchTenders(query = '') {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);

    const response = await fetch(`${API_BASE}/tenders?${params}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    if (data.tenders && data.tenders.length > 0) {
      return { tenders: data.tenders, source: 'live', total: data.total };
    }

    // Fallback to mock data if API returns empty
    return { tenders: mockTenders, source: 'mock', total: mockTenders.length };
  } catch (error) {
    console.warn('TED API unavailable, using mock data:', error.message);
    return { tenders: mockTenders, source: 'mock', total: mockTenders.length };
  }
}

export async function fetchWinners(query = '') {
  try {
    const params = new URLSearchParams();
    if (query) params.set('q', query);

    const response = await fetch(`${API_BASE}/winners?${params}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);

    const data = await response.json();

    if (data.winners && data.winners.length > 0) {
      return { winners: data.winners, source: 'live', total: data.total };
    }

    return { winners: mockWinners, source: 'mock', total: mockWinners.length };
  } catch (error) {
    console.warn('TED API unavailable, using mock data:', error.message);
    return { winners: mockWinners, source: 'mock', total: mockWinners.length };
  }
}
