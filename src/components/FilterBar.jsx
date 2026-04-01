import { Search, SlidersHorizontal } from 'lucide-react';
import { sources, sectors } from '../data/tenders';

export default function FilterBar({ filters, setFilters, mode }) {
  const handleChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <SlidersHorizontal size={18} className="text-gray-400" />
        <span className="text-sm font-semibold text-gray-600">Filtres</span>
      </div>

      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={filters.search}
            onChange={(e) => handleChange('search', e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-all"
          />
        </div>

        {/* Source filter */}
        <select
          value={filters.source}
          onChange={(e) => handleChange('source', e.target.value)}
          className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 cursor-pointer"
        >
          {sources.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Sector filter (tenders only) */}
        {mode === 'tenders' && (
          <select
            value={filters.sector}
            onChange={(e) => handleChange('sector', e.target.value)}
            className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 cursor-pointer"
          >
            {sectors.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}

        {/* Budget filter (tenders only) */}
        {mode === 'tenders' && (
          <select
            value={filters.budget}
            onChange={(e) => handleChange('budget', e.target.value)}
            className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 cursor-pointer"
          >
            <option value="all">Tous budgets</option>
            <option value="0-100000">{'< 100 000 €'}</option>
            <option value="100000-300000">100 000 – 300 000 €</option>
            <option value="300000+">{'> 300 000 €'}</option>
          </select>
        )}

        {/* Sort */}
        <select
          value={filters.sort}
          onChange={(e) => handleChange('sort', e.target.value)}
          className="px-4 py-2.5 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 cursor-pointer"
        >
          {mode === 'tenders' ? (
            <>
              <option value="relevance">Tri : Pertinence</option>
              <option value="budget">Tri : Budget</option>
              <option value="deadline">Tri : Deadline</option>
            </>
          ) : (
            <>
              <option value="collaboration">Tri : Score collaboration</option>
              <option value="amount">Tri : Montant</option>
              <option value="date">Tri : Date</option>
            </>
          )}
        </select>
      </div>
    </div>
  );
}
