import { useState, useMemo, useEffect, useCallback } from 'react';
import { Radar, FileText, Trophy, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import StatsHeader from './components/StatsHeader';
import FilterBar from './components/FilterBar';
import TenderCard from './components/TenderCard';
import WinnerCard from './components/WinnerCard';
import { tenders as mockTenders, winners as mockWinners } from './data/tenders';
import { fetchTenders, fetchWinners } from './services/api';

// Store total counts from API
let apiTotalTenders = 0;
let apiTotalWinners = 0;

const defaultFilters = {
  search: '',
  source: 'Belgique',
  sector: 'Tous les secteurs',
  budget: 'all',
  sort: 'relevance',
};

function applyTenderFilters(items, filters) {
  let result = [...items];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.authority.toLowerCase().includes(q) ||
        (t.keywords || []).some((k) => k.toLowerCase().includes(q))
    );
  }

  if (filters.source !== 'Toutes') {
    result = result.filter((t) => t.source === filters.source);
  }

  if (filters.sector !== 'Tous les secteurs') {
    result = result.filter((t) => t.sector === filters.sector);
  }

  if (filters.budget !== 'all') {
    if (filters.budget === '0-100000') result = result.filter((t) => t.budget < 100000);
    else if (filters.budget === '100000-300000') result = result.filter((t) => t.budget >= 100000 && t.budget <= 300000);
    else if (filters.budget === '300000+') result = result.filter((t) => t.budget > 300000);
  }

  if (filters.sort === 'relevance') result.sort((a, b) => b.relevanceScore - a.relevanceScore);
  else if (filters.sort === 'budget') result.sort((a, b) => b.budget - a.budget);
  else if (filters.sort === 'deadline') result.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  return result;
}

function applyWinnerFilters(items, filters) {
  let result = [...items];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        (typeof w.tender === 'string' ? w.tender.toLowerCase().includes(q) : false) ||
        w.authority.toLowerCase().includes(q) ||
        (w.speciality || '').toLowerCase().includes(q)
    );
  }

  if (filters.sort === 'collaboration') result.sort((a, b) => b.collaborationScore - a.collaborationScore);
  else if (filters.sort === 'amount') result.sort((a, b) => b.amount - a.amount);
  else if (filters.sort === 'date') result.sort((a, b) => new Date(b.date) - new Date(a.date));

  return result;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('tenders');
  const [tenderFilters, setTenderFilters] = useState({ ...defaultFilters });
  const [winnerFilters, setWinnerFilters] = useState({ ...defaultFilters, sort: 'collaboration' });

  const [tenders, setTenders] = useState(mockTenders);
  const [winners, setWinners] = useState(mockWinners);
  const [dataSource, setDataSource] = useState('mock');
  const [loading, setLoading] = useState(false);

  const loadLiveData = useCallback(async () => {
    setLoading(true);
    try {
      // Load sequentially to avoid 429 rate limiting from TED API
      const tenderResult = await fetchTenders();
      if (tenderResult.source === 'live') {
        setTenders(tenderResult.tenders);
        apiTotalTenders = tenderResult.total || tenderResult.tenders.length;
      }

      const winnerResult = await fetchWinners();
      if (winnerResult.source === 'live') {
        setWinners(winnerResult.winners);
        apiTotalWinners = winnerResult.total || winnerResult.winners.length;
      }

      setDataSource(tenderResult.source === 'live' || winnerResult.source === 'live' ? 'live' : 'mock');
    } catch {
      setDataSource('mock');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadLiveData();
  }, [loadLiveData]);

  const filteredTenders = useMemo(() => applyTenderFilters(tenders, tenderFilters), [tenders, tenderFilters]);
  const filteredWinners = useMemo(() => applyWinnerFilters(winners, winnerFilters), [winners, winnerFilters]);

  const totalAvailable = apiTotalTenders + apiTotalWinners;

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 text-white p-2 rounded-xl">
              <Radar size={22} />
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">TenderRadar</span>
            {/* Data source indicator */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
              dataSource === 'live'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-amber-50 text-amber-700'
            }`}>
              {dataSource === 'live' ? <Wifi size={10} /> : <WifiOff size={10} />}
              {dataSource === 'live' ? 'Live TED' : 'Mock'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadLiveData}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors ${loading ? 'opacity-50' : ''}`}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              {loading ? 'Chargement...' : 'Actualiser'}
            </button>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setActiveTab('tenders')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'tenders'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <FileText size={16} />
                Appels d'offres
              </button>
              <button
                onClick={() => setActiveTab('winners')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeTab === 'winners'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Trophy size={16} />
                Adjudicataires
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsHeader
          tenderCount={tenders.length}
          winnerCount={winners.length}
          totalVolume={totalAvailable}
        />

        {activeTab === 'tenders' ? (
          <>
            <FilterBar filters={tenderFilters} setFilters={setTenderFilters} mode="tenders" />
            {loading ? (
              <div className="text-center py-16 text-gray-400">
                <RefreshCw size={36} className="mx-auto mb-4 animate-spin opacity-50" />
                <p className="text-lg font-medium">Chargement des appels d'offres TED...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredTenders.map((tender, i) => (
                    <TenderCard key={tender.id} tender={tender} index={i} />
                  ))}
                </div>
                {filteredTenders.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucun appel d'offres trouvé</p>
                    <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <FilterBar filters={winnerFilters} setFilters={setWinnerFilters} mode="winners" />
            {loading ? (
              <div className="text-center py-16 text-gray-400">
                <RefreshCw size={36} className="mx-auto mb-4 animate-spin opacity-50" />
                <p className="text-lg font-medium">Chargement des attributions TED...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredWinners.map((winner, i) => (
                    <WinnerCard key={winner.id} winner={winner} index={i} />
                  ))}
                </div>
                {filteredWinners.length === 0 && (
                  <div className="text-center py-16 text-gray-400">
                    <Trophy size={48} className="mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">Aucun adjudicataire trouvé</p>
                    <p className="text-sm mt-1">Essayez de modifier vos filtres</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-400">
          TenderRadar — Veille marchés publics belges & européens ·
          {dataSource === 'live' ? ' Données en direct via TED API' : ' Données de démonstration (fallback mock)'}
          {' · '}Source : publications.europa.eu
        </div>
      </footer>
    </div>
  );
}
