export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
  // Use parentheses for CPV query syntax, sorted by recent publication
  const cpvQuery = 'cpv=(79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79411000 OR 79416000 OR 79950000)';
  const fullQuery = q ? `${cpvQuery} AND "${q}"` : cpvQuery;
  const fields = ['publication-number', 'notice-title', 'buyer-name', 'organisation-country-buyer', 'deadline-receipt-tender-date-lot'];

  const bodyVariants = [
    // 1: CPV filter with validated field names
    {
      query: fullQuery,
      fields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: Broader — services category with CPV
    {
      query: q ? `NC=services AND "${q}"` : 'NC=services AND cpv=(79340000 OR 79400000)',
      fields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Fallback — just services
    {
      query: 'NC=services',
      fields,
      limit: 20,
      scope: 'ACTIVE',
      checkQuerySyntax: false,
    },
  ];

  for (let i = 0; i < bodyVariants.length; i++) {
    try {
      const response = await fetch(TED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bodyVariants[i]),
        signal: AbortSignal.timeout(15000),
      });

      if (response.ok) {
        const data = await response.json();
        const notices = data.notices || [];
        if (Array.isArray(notices) && notices.length > 0) {
          const tenders = notices.map((n, idx) => parseNotice(n, idx)).filter(Boolean);
          return res.status(200).json({
            tenders,
            total: data.totalNoticeCount || tenders.length,
            source: 'live',
          });
        }
      }
    } catch (e) {
      // Try next variant
    }
  }

  return res.status(200).json({ tenders: [], total: 0, source: 'api_unavailable' });
}

function getLocalized(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  // Multilingual object: prefer fra > eng > first available
  if (field.fra) return Array.isArray(field.fra) ? field.fra[0] : field.fra;
  if (field.eng) return Array.isArray(field.eng) ? field.eng[0] : field.eng;
  if (field.nld) return Array.isArray(field.nld) ? field.nld[0] : field.nld;
  if (field.deu) return Array.isArray(field.deu) ? field.deu[0] : field.deu;
  const keys = Object.keys(field);
  if (keys.length > 0) {
    const val = field[keys[0]];
    return Array.isArray(val) ? val[0] : val;
  }
  return '';
}

function parseNotice(notice, index) {
  const id = notice['publication-number'] || `ted-${index}`;
  const title = getLocalized(notice['notice-title']);
  const authority = getLocalized(notice['buyer-name']);
  const country = getLocalized(notice['organisation-country-buyer']);
  const deadline = notice['deadline-receipt-tender-date-lot'] || '';

  const source = (country === 'BEL' || country === 'BE') ? 'e-Procurement' : 'TED';
  const allText = `${title} ${authority}`.toLowerCase();
  const commKw = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'publicité', 'branding', 'consulting', 'conseil', 'stratégie', 'digital', 'audit'];
  const relevanceScore = Math.min(95, 50 + commKw.filter(k => allText.includes(k)).length * 7);
  const sector = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'publicité'].some(k => allText.includes(k))
    ? 'Communication & campagnes' : 'Consulting & stratégie';

  let status = 'open';
  if (deadline) {
    const dl = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (dl <= 7 && dl > 0) status = 'closing_soon';
    if (dl <= 0) status = 'closed';
  }

  return {
    id,
    title: title || `Avis TED ${id}`,
    authority: authority || 'Non communiqué',
    source,
    sector,
    budget: 0,
    deadline: deadline || '',
    published: '',
    description: title || 'Description non disponible',
    keywords: [],
    relevanceScore,
    status,
    referenceNumber: id,
    url: `https://ted.europa.eu/en/notice/-/detail/${id}`,
  };
}
