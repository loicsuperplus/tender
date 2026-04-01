export default async function handler(req, res) {
  const { q = '' } = req.query;

  const endpoints = [
    {
      url: 'https://api.ted.europa.eu/v3/notices/search',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: `(${q || 'communication OR consulting OR marketing'}) AND (TD=7)`,
        pageSize: 20,
        page: 1,
        sortField: 'publication-date',
        sortOrder: 'DESC',
      }),
    },
    {
      url: `https://api.ted.europa.eu/v3/notices/search?query=${encodeURIComponent('(cpv=79340000 OR cpv=79400000) AND TD=7')}&pageSize=20&sortField=PUBLICATION_DATE&sortOrder=DESC`,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    },
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: endpoint.headers,
        body: endpoint.body || undefined,
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const data = await response.json();
        const winners = transformAwardResponse(data);
        if (winners.length > 0) {
          return res.status(200).json({ winners, total: winners.length, source: 'live' });
        }
      }
    } catch {
      // Try next
    }
  }

  return res.status(200).json({ winners: [], total: 0, source: 'api_unavailable' });
}

function transformAwardResponse(data) {
  const notices = data.notices || data.results || data.links || data.noticeList || [];
  if (!Array.isArray(notices)) return [];

  return notices.map((notice, index) => {
    const name = notice.winnerName?.text || notice.winnerName || notice['winner-name'] || notice.WIN || 'Non communiqué';
    const amount = notice.awardedValue?.amount || notice.awardedValue || notice['awarded-value'] || notice.VA || 0;
    const tender = notice.title?.text || notice.title || notice['title-text'] || notice.TI || '';
    const authority = notice.buyerName?.text || notice.buyerName || notice['buyer-name'] || notice.AA || '';
    const date = notice.publicationDate || notice['publication-date'] || notice.PD || '';
    const noticeId = notice.noticeId || notice['notice-id'] || notice.id || '';

    return {
      id: noticeId || `win-${index}`,
      name,
      amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
      tender,
      authority,
      date,
      website: '',
      linkedin: '',
      email: '',
      speciality: '',
      collaborationScore: Math.floor(Math.random() * 30) + 60,
      noticeUrl: noticeId
        ? `https://ted.europa.eu/en/notice/-/detail/${noticeId}`
        : 'https://ted.europa.eu/en/search/result',
    };
  });
}
