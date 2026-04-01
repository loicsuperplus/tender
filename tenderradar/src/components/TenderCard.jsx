import { Calendar, Euro, Building2, Clock, Tag } from 'lucide-react';

const sourceBadge = {
  TED: 'bg-red-50 text-red-700 border-red-200',
  'e-Procurement': 'bg-teal-50 text-teal-700 border-teal-200',
  Bulletin: 'bg-orange-50 text-orange-700 border-orange-200',
};

function ScoreBadge({ score }) {
  const color =
    score >= 85 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    score >= 70 ? 'bg-blue-50 text-blue-700 border-blue-200' :
    'bg-gray-50 text-gray-600 border-gray-200';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${color}`}>
      {score}/100
    </span>
  );
}

function StatusBadge({ status }) {
  if (status === 'closing_soon') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
        <Clock size={12} />
        Clôture proche
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-green-50 text-green-700 border border-green-200">
      Ouvert
    </span>
  );
}

export default function TenderCard({ tender, index }) {
  const daysLeft = Math.ceil((new Date(tender.deadline) - new Date()) / (1000 * 60 * 60 * 24));

  return (
    <div className={`animate-fade-in-up stagger-${index + 1} bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg border ${sourceBadge[tender.source]}`}>
            {tender.source}
          </span>
          <StatusBadge status={tender.status} />
        </div>
        <ScoreBadge score={tender.relevanceScore} />
      </div>

      {/* Title */}
      <h3 className="text-base font-bold text-gray-900 mb-2 text-left leading-snug">
        {tender.title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 mb-4 text-left leading-relaxed line-clamp-2">
        {tender.description}
      </p>

      {/* Meta */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          <Building2 size={14} className="text-gray-400" />
          {tender.authority}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Euro size={14} className="text-gray-400" />
          {tender.budget.toLocaleString('fr-BE')} €
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} className="text-gray-400" />
          {new Date(tender.deadline).toLocaleDateString('fr-BE')} ({daysLeft > 0 ? `J-${daysLeft}` : 'Expiré'})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Tag size={14} className="text-gray-400" />
          {tender.sector}
        </span>
      </div>

      {/* Reference */}
      <div className="mt-3 pt-3 border-t border-gray-50 text-left">
        <span className="text-xs text-gray-400 font-mono">{tender.referenceNumber}</span>
      </div>
    </div>
  );
}
