import { useState } from 'react';
import { Copy, Check, Mail, X } from 'lucide-react';

function generateLinkedInMessage(winner) {
  return `Bonjour,

J'ai remarqué avec intérêt l'attribution du marché "${winner.tender}" à ${winner.name}. Félicitations pour cette belle réussite !

Chez [Votre entreprise], nous sommes spécialisés en [votre domaine] et nous accompagnons régulièrement des acteurs comme vous sur ce type de projets publics.

Seriez-vous ouvert(e) à un échange pour explorer d'éventuelles synergies en sous-traitance ou partenariat sur vos prochains marchés ?

Au plaisir d'en discuter.

Bien cordialement`;
}

function generateEmail(winner) {
  return `Objet : Proposition de collaboration — ${winner.tender}

Madame, Monsieur,

Nous avons pris connaissance avec intérêt de l'attribution du marché « ${winner.tender} » (${winner.authority}) à votre agence ${winner.name}, pour un montant de ${winner.amount.toLocaleString('fr-BE')} €.

Nous souhaitons vous féliciter pour cette attribution et nous permettons de vous contacter car nous pensons que nos compétences en [votre domaine d'expertise] pourraient constituer un renfort précieux pour la réalisation de cette mission.

Notre équipe dispose d'une expérience significative dans :
• [Compétence 1 pertinente]
• [Compétence 2 pertinente]
• [Compétence 3 pertinente]

Nous serions ravis de convenir d'un entretien à votre meilleure convenance pour explorer les possibilités de collaboration, que ce soit en sous-traitance ou en partenariat.

Dans l'attente de votre retour, nous vous prions d'agréer, Madame, Monsieur, l'expression de nos salutations distinguées.

[Votre nom]
[Votre entreprise]
[Votre téléphone]`;
}

export default function MessageGenerator({ winner, onClose }) {
  const [mode, setMode] = useState('linkedin');
  const [copied, setCopied] = useState(false);

  const message = mode === 'linkedin' ? generateLinkedInMessage(winner) : generateEmail(winner);

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Contacter {winner.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">Message d'approche personnalisé</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-2 p-5 pb-0">
          <button
            onClick={() => setMode('linkedin')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              mode === 'linkedin'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> LinkedIn
          </button>
          <button
            onClick={() => setMode('email')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              mode === 'email'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Mail size={16} /> Email
          </button>
        </div>

        {/* Message */}
        <div className="p-5">
          <textarea
            readOnly
            value={message}
            className="w-full h-72 p-4 text-sm text-gray-700 bg-gray-50 rounded-xl border border-gray-200 resize-none focus:outline-none leading-relaxed"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-5 pt-0">
          <div className="text-xs text-gray-400">
            Personnalisez les champs entre [crochets] avant envoi
          </div>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copié !' : 'Copier le message'}
          </button>
        </div>
      </div>
    </div>
  );
}
