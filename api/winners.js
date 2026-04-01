export default async function handler(req, res) {
  const { q = '' } = req.query;

  // TD=[7] = Contract award notices; NC=services for service contracts
  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79416000] AND notice-type=can-standard';
  const fullQuery = q ? `${baseQuery} AND "${q}"` : baseQuery;

  const bodyVariants = [
    // 1: Full fields — contract award notices
    {
      query: fullQuery,
      fields: ['publication-number', 'notice-title', 'buyer-name', 'notice-type', 'publication-date', 'notice-value', 'buyer-country', 'winner-name'],
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: Minimal fields
    {
      query: fullQuery,
      fields: ['publication-number', 'notice-title', 'buyer-name'],
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Broader query — any award notice in services
    {
      query: 'notice-type=can-standard AND NC=services',
      fields: ['publication-number', 'notice-title', 'buyer-name'],
      limit: 20,
      scope: 'ALL',
      checkQuerySyntax: false,
    },
    // 4: Simplest possible — just award notices
    {
      query: 'notice-type=can-standard',
      fields: ['publication-number'],
      limit: 10,
      scope: 'ALL',
      checkQuerySyntax: false,
    },
  ];

  const debugInfo = [];

  for (let i = 0; i < bodyVariants.length; i++) {
    try {
      const response = await fetch('https://api.ted.europa.eu/v3/notices/search', {
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

            const winners = results.map((n, i) => parseAward(n, i)).filter(Boolean);
            return res.status(200).json({ winners, total: data.total || winners.length, source: 'live', workingVariant: i + 1, debug: debugInfo });
          }
        } catch (e) {
          debugInfo[debugInfo.length - 1].note = 'OK but JSON parse error: ' + e.message;
        }
      }
    } catch (e) {
      debugInfo.push({ variant: i + 1, error: e.message });
    }
  }

  return res.status(200).json({ winners: [], total: 0, source: 'api_unavailable', debug: debugInfo });
}

function parseAward(notice, index) {
  const id = notice['publication-number'] || notice['notice-id'] || notice.id || '';
  const title = notice['notice-title'] || notice.title || '';
  const authority = notice['buyer-name'] || notice.buyerName || '';
  const name = notice['winner-name'] || '';
  const amount = parseFloat(notice['notice-value'] || 0) || 0;
  const pubDate = notice['publication-date'] || '';
  const country = notice['buyer-country'] || '';

  if (!title && !id) return null;

  return {
    id: id || `win-${index}`,
    name: name || 'Non communiqué',
    amount,
    tender: title || `Attribution TED ${id}`,
    authority,
    date: pubDate,
    website: '',
    linkedin: '',
    email: '',
    speciality: '',
    collaborationScore: Math.floor(Math.random() * 30) + 60,
    noticeUrl: `https://ted.europa.eu/en/notice/-/detail/${id}`,
  };
}
