export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
  const safeFields = ['publication-number', 'notice-title', 'buyer-name'];

  // Try different query syntaxes for CPV communication/consulting codes
  const bodyVariants = [
    // 1: CPV codes with OR syntax (no parentheses)
    {
      query: q
        ? `(cpv=79340000 OR cpv=79341000 OR cpv=79342000 OR cpv=79400000 OR cpv=79410000 OR cpv=79411000 OR cpv=79416000 OR cpv=79950000) AND "${q}"`
        : 'cpv=79340000 OR cpv=79341000 OR cpv=79342000 OR cpv=79400000 OR cpv=79410000 OR cpv=79411000 OR cpv=79416000 OR cpv=79950000',
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: Use PC field (old-style CPV) with IN syntax
    {
      query: q
        ? `PC IN (79340000,79400000,79410000,79416000) AND "${q}"`
        : 'PC IN (79340000,79400000,79410000,79416000)',
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Use text search for communication/consulting in Belgium
    {
      query: q
        ? `NC=services AND organisation-country-buyer IN (BEL) AND "${q}"`
        : 'NC=services AND organisation-country-buyer IN (BEL)',
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 4: Belgian services with date filter
    {
      query: 'NC=services AND organisation-country-buyer IN (BEL) AND PD>20250101',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      checkQuerySyntax: false,
    },
    // 5: Communication keyword search — recent
    {
      query: q
        ? `NC=services AND PD>20250101 AND "${q}"`
        : 'NC=services AND PD>20250101 AND (communication OR marketing OR consulting OR conseil)',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      checkQuerySyntax: false,
    },
    // 6: Broadest fallback — recent services
    {
      query: 'NC=services AND PD>20250301',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      checkQuerySyntax: false,
    },
  ];

  const debugInfo = [];

  for (let i = 0; i < bodyVariants.length; i++) {
    try {
      const response = await fetch(TED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bodyVariants[i]),
        signal: AbortSignal.timeout(15000),
      });

      let responseBody = '';
      try { responseBody = await response.text(); } catch { responseBody = 'unreadable'; }

      debugInfo.push({
        variant: i + 1,
        status: response.status,
        query: bodyVariants[i].query,
        responsePreview: responseBody.substring(0, 200),
      });

      if (response.ok) {
        const data = JSON.parse(responseBody);
        const notices = data.notices || [];
        if (Array.isArray(notices) && notices.length > 0) {
          const tenders = notices.map((n, idx) => parseNotice(n, idx)).filter(Boolean);
          return res.status(200).json({
            tenders,
            total: data.totalNoticeCount || tenders.length,
            source: 'live',
            workingVariant: i + 1,
            debug: debugInfo,
          });
        }
      }
    } catch (e) {
      debugInfo.push({ variant: i + 1, error: e.message });
    }
  }

  return res.status(200).json({ tenders: [], total: 0, source: 'api_unavailable', debug: debugInfo });
}

function getLocalized(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
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

  const allText = `${title} ${authority}`.toLowerCase();
  const commKw = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'publicité', 'branding', 'consulting', 'conseil', 'stratégie', 'digital', 'audit', 'événement', 'relations publiques', 'rédaction'];
  const relevanceScore = Math.min(95, 50 + commKw.filter(k => allText.includes(k)).length * 7);
  const sector = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'publicité', 'relations publiques'].some(k => allText.includes(k))
    ? 'Communication & campagnes' : 'Consulting & stratégie';

  return {
    id,
    title: title || `Avis TED ${id}`,
    authority: authority || 'Non communiqué',
    source: 'TED',
    sector,
    budget: 0,
    deadline: '',
    published: '',
    description: title || 'Description non disponible',
    keywords: [],
    relevanceScore,
    status: 'open',
    referenceNumber: id,
    url: `https://ted.europa.eu/en/notice/-/detail/${id}`,
  };
}
