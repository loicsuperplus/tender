export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
  const safeFields = ['publication-number', 'notice-title', 'buyer-name'];
  const pcFilter = '(PC=79340000 OR PC=79341000 OR PC=79342000 OR PC=79400000 OR PC=79410000 OR PC=79411000 OR PC=79416000 OR PC=79950000)';
  // Today's date for deadline filter
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  const bodyVariants = [
    // 1: Belgian communication CPV — deadline still in the future
    {
      query: q
        ? `${pcFilter} AND organisation-country-buyer IN (BEL) AND DT>${today} AND "${q}"`
        : `${pcFilter} AND organisation-country-buyer IN (BEL) AND DT>${today}`,
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: Belgian communication CPV — try deadline-receipt-tender-date-lot field
    {
      query: q
        ? `${pcFilter} AND organisation-country-buyer IN (BEL) AND deadline-receipt-tender-date-lot>${today} AND "${q}"`
        : `${pcFilter} AND organisation-country-buyer IN (BEL) AND deadline-receipt-tender-date-lot>${today}`,
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Belgian communication CPV — very recent publication (last 30 days likely still open)
    {
      query: q
        ? `${pcFilter} AND organisation-country-buyer IN (BEL) AND PD>20250301 AND "${q}"`
        : `${pcFilter} AND organisation-country-buyer IN (BEL) AND PD>20250301`,
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 4: Belgian services — very recent
    {
      query: q
        ? `NC=services AND organisation-country-buyer IN (BEL) AND PD>20250301 AND "${q}"`
        : 'NC=services AND organisation-country-buyer IN (BEL) AND PD>20250301',
      fields: safeFields,
      limit: 20,
      scope: 'ACTIVE',
      checkQuerySyntax: false,
    },
  ];

  for (let i = 0; i < bodyVariants.length; i++) {
    try {
      if (i > 0) await new Promise(r => setTimeout(r, 1500));

      const response = await fetch(TED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bodyVariants[i]),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 429) {
        await new Promise(r => setTimeout(r, 3000));
        const retry = await fetch(TED_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(bodyVariants[i]),
          signal: AbortSignal.timeout(15000),
        });
        if (retry.ok) {
          const data = await retry.json();
          const notices = data.notices || [];
          if (notices.length > 0) {
            const tenders = notices.map((n, idx) => parseNotice(n, idx)).filter(Boolean);
            return res.status(200).json({ tenders, total: data.totalNoticeCount || tenders.length, source: 'live' });
          }
        }
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const notices = data.notices || [];
        if (Array.isArray(notices) && notices.length > 0) {
          const tenders = notices.map((n, idx) => parseNotice(n, idx)).filter(Boolean);
          return res.status(200).json({ tenders, total: data.totalNoticeCount || tenders.length, source: 'live' });
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
  const commKw = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'publicité', 'branding', 'consulting', 'conseil', 'stratégie', 'digital', 'audit', 'événement', 'relations publiques', 'rédaction', 'agence créative'];
  const relevanceScore = Math.min(95, 50 + commKw.filter(k => allText.includes(k)).length * 7);
  const sector = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'publicité', 'relations publiques', 'agence créative'].some(k => allText.includes(k))
    ? 'Communication & campagnes' : 'Consulting & stratégie';

  const isBelgian = allText.includes('belgique') || allText.includes('belgië');
  const source = isBelgian ? 'Belgique' : 'Europe';

  return {
    id,
    title: title || `Avis TED ${id}`,
    authority: authority || 'Non communiqué',
    source,
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
