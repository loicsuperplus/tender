import { useState, useMemo } from 'react';
import { Radar, FileText, Trophy } from 'lucide-react';
import StatsHeader from './components/StatsHeader';
import FilterBar from './components/FilterBar';
import TenderCard from './components/TenderCard';
import WinnerCard from './components/WinnerCard';
import { tenders, winners } from './data/tenders';

const defaultFilters = {
  search: '',
  source: 'Toutes',
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
        t.keywords.some((k) => k.toLowerCase().includes(q))
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
        w.tender.toLowerCase().includes(q) ||
        w.authority.toLowerCase().includes(q) ||
        w.speciality.toLowerCase().includes(q)
    );
  }

  if (filters.source !== 'Toutes') {
    // Winners don't have source in mock data, skip
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

  const filteredTenders = useMemo(() => applyTenderFilters(tenders, tenderFilters), [tenderFilters]);
  const filteredWinners = useMemo(() => applyWinnerFilters(winners, winnerFilters), [winnerFilters]);

  const totalVolume = tenders.reduce((sum, t) => sum + t.budget, 0) + winners.reduce((sum, w) => sum + w.amount, 0);

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
          </div>
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
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <StatsHeader
          tenderCount={tenders.length}
          winnerCount={winners.length}
          totalVolume={totalVolume}
        />

        {activeTab === 'tenders' ? (
          <>
            <FilterBar filters={tenderFilters} setFilters={setTenderFilters} mode="tenders" />
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
        ) : (
          <>
            <FilterBar filters={winnerFilters} setFilters={setWinnerFilters} mode="winners" />
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
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-400">
          TenderRadar — Veille marchés publics belges & européens · Données mock — prêt à connecter TED API & e-Procurement API
        </div>
      </footer>
    </div>
  );
}
