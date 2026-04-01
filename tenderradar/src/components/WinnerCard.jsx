import { useState } from 'react';
import { Globe, Mail, Euro, Building2, Calendar, MessageSquare } from 'lucide-react';
import MessageGenerator from './MessageGenerator';

function CollaborationScore({ score }) {
  const color =
    score >= 85 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
    score >= 70 ? 'text-blue-700 bg-blue-50 border-blue-200' :
    'text-gray-600 bg-gray-50 border-gray-200';

  const label =
    score >= 85 ? 'Excellent' :
    score >= 70 ? 'Bon' : 'Modéré';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg border ${color}`}>
      {score}/100 — {label}
    </span>
  );
}

export default function WinnerCard({ winner, index }) {
  const [showMessage, setShowMessage] = useState(false);

  return (
    <>
      <div className={`animate-fade-in-up stagger-${index + 1} bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5`}>
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <h3 className="text-base font-bold text-gray-900">{winner.name}</h3>
          <CollaborationScore score={winner.collaborationScore} />
        </div>

        {/* Speciality */}
        <p className="text-sm text-gray-500 mb-1 text-left">{winner.speciality}</p>

        {/* Tender won */}
        <p className="text-sm font-medium text-gray-700 mb-4 text-left">
          🏆 {winner.tender}
        </p>

        {/* Meta */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-500 mb-4">
          <span className="inline-flex items-center gap-1.5">
            <Building2 size={14} className="text-gray-400" />
            {winner.authority}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Euro size={14} className="text-gray-400" />
            {winner.amount.toLocaleString('fr-BE')} €
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400" />
            {new Date(winner.date).toLocaleDateString('fr-BE')}
          </span>
        </div>

        {/* Links & Contact */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-50">
          <a
            href={winner.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Globe size={13} /> Site web
          </a>
          <a
            href={winner.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> LinkedIn
          </a>
          <a
            href={`mailto:${winner.email}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Mail size={13} /> {winner.email}
          </a>
          <button
            onClick={() => setShowMessage(true)}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <MessageSquare size={14} /> Contacter
          </button>
        </div>
      </div>

      {showMessage && (
        <MessageGenerator winner={winner} onClose={() => setShowMessage(false)} />
      )}
    </>
  );
}
