export default async function handler(req, res) {
  const { q = '', page = '1' } = req.query;

  // Build TED API expert search query for communication & consulting tenders in Belgium/EU
  const sectorKeywords = [
    'communication', 'campagne', 'campaign', 'consulting', 'stratégie', 'strategy',
    'audit', 'conseil', 'advisory', 'marketing', 'digital', 'relations publiques',
    'public relations', 'branding', 'média', 'media', 'événement', 'event',
  ];

  // CPV codes for communication & consulting services
  const cpvCodes = [
    '79340000', // Advertising and marketing
    '79341000', // Advertising services
    '79342000', // Marketing services
    '79400000', // Business and management consultancy
    '79410000', // Business and management consultancy services
    '79411000', // General management consultancy
    '79416000', // Public relations services
    '79950000', // Event organisation
    '79800000', // Printing and related services (campaign materials)
    '72000000', // IT services (digital)
  ];

  const cpvQuery = cpvCodes.map(c => `cpv = "${c}"`).join(' OR ');
  const countryQuery = 'TD-COUNTRY = "BEL" OR TD-COUNTRY = "EUR"';

  let searchQuery = `(${cpvQuery}) AND (${countryQuery})`;
  if (q) {
    searchQuery += ` AND ("${q}")`;
  }

  try {
    const tedUrl = new URL('https://api.ted.europa.eu/v3/notices/search');
    tedUrl.searchParams.set('query', searchQuery);
    tedUrl.searchParams.set('pageSize', '20');
    tedUrl.searchParams.set('page', page);
    tedUrl.searchParams.set('sortField', 'PUBLICATION_DATE');
    tedUrl.searchParams.set('sortOrder', 'DESC');

    const response = await fetch(tedUrl.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Try the v2 endpoint as fallback
      const v2Url = `https://api.ted.europa.eu/v2/notices/search?q=${encodeURIComponent(searchQuery)}&pageSize=20&pageNum=${page}&scope=3`;
      const v2Response = await fetch(v2Url, {
        headers: { 'Accept': 'application/json' },
      });

      if (!v2Response.ok) {
        const errText = await v2Response.text();
        return res.status(v2Response.status).json({
          error: 'TED API error',
          details: errText,
          url: v2Url,
        });
      }

      const v2Data = await v2Response.json();
      return res.status(200).json(transformTedResponse(v2Data));
    }

    const data = await response.json();
    return res.status(200).json(transformTedResponse(data));
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch from TED API',
      message: error.message,
    });
  }
}

function transformTedResponse(data) {
  // Handle various TED API response formats
  const notices = data.notices || data.results || data.links || [];

  const tenders = (Array.isArray(notices) ? notices : []).map((notice, index) => {
    const title = notice.title?.text || notice['title-text'] || notice.TI || notice.title || 'Titre non disponible';
    const authority = notice.buyerName?.text || notice['buyer-name'] || notice.AA || notice.authorityName || '';
    const deadline = notice.submissionDeadline || notice['submission-deadline'] || notice.DT || null;
    const published = notice.publicationDate || notice['publication-date'] || notice.PD || '';
    const budget = notice.estimatedValue?.amount || notice['estimated-value'] || notice.VA || 0;
    const noticeId = notice.noticeId || notice['notice-id'] || notice.tedNoticeId || notice.id || '';
    const description = notice.shortDescription?.text || notice['short-description'] || notice.RC || '';
    const country = notice.buyerCountry || notice['buyer-country'] || notice.CY || 'EU';

    // Determine source based on country
    const source = country === 'BEL' || country === 'BE' ? 'e-Procurement' : 'TED';

    // Calculate relevance score based on keyword matching
    const allText = `${title} ${description} ${authority}`.toLowerCase();
    const relevantKeywords = ['communication', 'campagne', 'consulting', 'stratégie', 'digital', 'marketing', 'audit', 'conseil'];
    const matchCount = relevantKeywords.filter(kw => allText.includes(kw)).length;
    const relevanceScore = Math.min(95, 50 + matchCount * 8);

    // Determine sector
    const commKeywords = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'relations publiques', 'branding', 'événement'];
    const isComm = commKeywords.some(kw => allText.includes(kw));
    const sector = isComm ? 'Communication & campagnes' : 'Consulting & stratégie';

    // Determine status
    let status = 'open';
    if (deadline) {
      const daysLeft = Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
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
      url: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
    };
  });

  return {
    tenders,
    total: data.totalNoticeCount || data.total || data.count || tenders.length,
    page: data.page || 1,
  };
}
