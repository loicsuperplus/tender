export default async function handler(req, res) {
  const { q = '' } = req.query;

  // Try multiple TED API formats
  const endpoints = [
    // v3 POST format (current documented format)
    {
      url: 'https://api.ted.europa.eu/v3/notices/search',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: q || 'communication OR consulting OR marketing OR stratégie',
        fields: ['title', 'buyer-name', 'submission-deadline', 'publication-date', 'estimated-value', 'notice-id', 'short-description', 'buyer-country', 'cpv-code'],
        pageSize: 20,
        page: 1,
        sortField: 'publication-date',
        sortOrder: 'DESC',
      }),
    },
    // v3 GET format
    {
      url: `https://api.ted.europa.eu/v3/notices/search?query=${encodeURIComponent(q || 'cpv=79340000 OR cpv=79400000')}&pageSize=20&sortField=PUBLICATION_DATE&sortOrder=DESC`,
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    },
    // Search API with expert query
    {
      url: `https://api.ted.europa.eu/v1/notices/search?q=${encodeURIComponent(q || 'communication consulting')}&scope=3&pageSize=20`,
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
        const tenders = transformTedResponse(data);
        if (tenders.length > 0) {
          return res.status(200).json({ tenders, total: tenders.length, source: 'live' });
        }
      }
    } catch {
      // Try next endpoint
    }
  }

  // All endpoints failed — return mock with flag
  return res.status(200).json({ tenders: [], total: 0, source: 'api_unavailable' });
}

function transformTedResponse(data) {
  // Handle various TED API response shapes
  const notices = data.notices || data.results || data.links || data.noticeList || [];
  if (!Array.isArray(notices)) return [];

  return notices.map((notice, index) => {
    const title = notice.title?.text || notice.title || notice['title-text'] || notice.TI || 'Titre non disponible';
    const authority = notice.buyerName?.text || notice.buyerName || notice['buyer-name'] || notice.AA || '';
    const deadline = notice.submissionDeadline || notice['submission-deadline'] || notice.DT || null;
    const published = notice.publicationDate || notice['publication-date'] || notice.PD || '';
    const budget = notice.estimatedValue?.amount || notice.estimatedValue || notice['estimated-value'] || notice.VA || 0;
    const noticeId = notice.noticeId || notice['notice-id'] || notice.tedNoticeId || notice.id || '';
    const description = notice.shortDescription?.text || notice.shortDescription || notice['short-description'] || notice.RC || '';
    const country = notice.buyerCountry || notice['buyer-country'] || notice.CY || 'EU';

    const source = (country === 'BEL' || country === 'BE') ? 'e-Procurement' : 'TED';

    const allText = `${title} ${description} ${authority}`.toLowerCase();
    const relevantKeywords = ['communication', 'campagne', 'consulting', 'stratégie', 'digital', 'marketing', 'audit', 'conseil'];
    const matchCount = relevantKeywords.filter(kw => allText.includes(kw)).length;
    const relevanceScore = Math.min(95, 50 + matchCount * 8);

    const commKeywords = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'relations publiques', 'branding'];
    const isComm = commKeywords.some(kw => allText.includes(kw));
    const sector = isComm ? 'Communication & campagnes' : 'Consulting & stratégie';

    let status = 'open';
    if (deadline) {
      const daysLeft = Math.ceil((new Date(deadline) - new Date()) / 86400000);
      if (daysLeft <= 7 && daysLeft > 0) status = 'closing_soon';
      if (daysLeft <= 0) status = 'closed';
    }

    return {
      id: noticeId || `ted-${index}`,
      title,
      authority,
      source,
      sector,
      budget: typeof budget === 'number' ? budget : parseFloat(budget) || 0,
      deadline: deadline || '',
      published,
      description: description || title,
      keywords: [],
      relevanceScore,
      status,
      referenceNumber: noticeId,
      url: noticeId
        ? `https://ted.europa.eu/en/notice/-/detail/${noticeId}`
        : 'https://ted.europa.eu/en/search/result',
    };
  });
}
