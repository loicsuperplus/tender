export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79411000 OR 79416000 OR 79950000]';
  const fullQuery = q ? `${baseQuery} AND "${q}"` : baseQuery;

  const bodyVariants = [
    // 1: Official format from TED reusers workshop
    {
      query: fullQuery,
      fields: ['publication-number', 'notice-title', 'buyer-name', 'notice-type', 'publication-date', 'deadline-receipt-tenders', 'place-of-performance', 'notice-value', 'buyer-country'],
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: Minimal fields
    {
      query: fullQuery,
      fields: ['publication-number', 'notice-title', 'buyer-name'],
      limit: 20,
      scope: 'ACTIVE',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Just publication-number (known valid from docs)
    {
      query: fullQuery,
      fields: ['publication-number'],
      limit: 20,
      scope: 'ACTIVE',
      checkQuerySyntax: false,
    },
    // 4: Broader query with just publication-number
    {
      query: 'NC=services',
      fields: ['publication-number'],
      limit: 10,
      scope: 'ACTIVE',
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
        sent: bodyVariants[i],
        response: responseBody.substring(0, 1500),
      });

      if (response.ok) {
        try {
          const data = JSON.parse(responseBody);
          const results = data.results || data.notices || [];
          debugInfo[debugInfo.length - 1].note = `OK — ${results.length} results, keys: ${Object.keys(data).join(',')}`;

          if (Array.isArray(results) && results.length > 0) {
            debugInfo[debugInfo.length - 1].firstResultKeys = Object.keys(results[0]);
            debugInfo[debugInfo.length - 1].firstResult = JSON.stringify(results[0]).substring(0, 500);

            const tenders = results.map((n, idx) => parseNotice(n, idx)).filter(Boolean);
            return res.status(200).json({ tenders, total: data.total || tenders.length, source: 'live', workingVariant: i + 1, debug: debugInfo });
          }
        } catch (e) {
          debugInfo[debugInfo.length - 1].note = 'OK but JSON parse error: ' + e.message;
        }
      }
    } catch (e) {
      debugInfo.push({ variant: i + 1, error: e.message });
    }
  }

  return res.status(200).json({ tenders: [], total: 0, source: 'api_unavailable', debug: debugInfo });
}

function parseNotice(notice, index) {
  // Try all known field patterns (eForms + legacy)
  const id = notice['publication-number'] || notice['notice-id'] || notice.noticeId || notice.id || `ted-${index}`;
  const title = notice['notice-title'] || notice['BT-21-Procedure'] || notice.title || '';
  const authority = notice['buyer-name'] || notice['tendering-party-name'] || notice.buyerName || '';
  const description = notice['notice-description'] || notice.description || '';
  const deadline = notice['deadline-receipt-tenders'] || notice['BT-131-Lot'] || notice.submissionDeadline || '';
  const budget = parseFloat(notice['notice-value'] || notice['BT-27-Procedure'] || notice.estimatedValue || 0) || 0;
  const country = notice['buyer-country'] || notice['organisation-country-buyer'] || notice.buyerCountry || '';
  const pubDate = notice['publication-date'] || notice.publicationDate || '';
  const noticeType = notice['notice-type'] || '';

  if (!title && !id) return null;

  const source = (country === 'BE' || country === 'BEL') ? 'e-Procurement' : 'TED';
  const allText = `${title} ${description} ${authority}`.toLowerCase();
  const kw = ['communication', 'campagne', 'consulting', 'stratégie', 'digital', 'marketing', 'audit', 'conseil'];
  const relevanceScore = Math.min(95, 50 + kw.filter(k => allText.includes(k)).length * 7);
  const commKw = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'advertising', 'branding'];
  const sector = commKw.some(k => allText.includes(k)) ? 'Communication & campagnes' : 'Consulting & stratégie';

  let status = 'open';
  if (deadline) {
    const dl = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (dl <= 7 && dl > 0) status = 'closing_soon';
    if (dl <= 0) status = 'closed';
  }

  return {
    id, title: title || `Avis TED ${id}`, authority, source, sector, budget, deadline,
    published: pubDate, description: description || title || 'Description non disponible',
    keywords: [], relevanceScore, status, referenceNumber: id,
    url: `https://ted.europa.eu/en/notice/-/detail/${id}`,
  };
}
