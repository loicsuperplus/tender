export default async function handler(req, res) {
  const { q = '', page = '1' } = req.query;

  // Search for contract award notices in TED
  const cpvCodes = [
    '79340000', '79341000', '79342000', '79400000',
    '79410000', '79411000', '79416000', '79950000',
  ];

  const cpvQuery = cpvCodes.map(c => `cpv = "${c}"`).join(' OR ');
  // TD = 7 means "Contract award notice"
  const searchQuery = `(${cpvQuery}) AND (TD = "7" OR TD = "Contract award") AND (TD-COUNTRY = "BEL" OR TD-COUNTRY = "EUR")`;

  try {
    const tedUrl = new URL('https://api.ted.europa.eu/v3/notices/search');
    tedUrl.searchParams.set('query', q ? `${searchQuery} AND ("${q}")` : searchQuery);
    tedUrl.searchParams.set('pageSize', '20');
    tedUrl.searchParams.set('page', page);
    tedUrl.searchParams.set('sortField', 'PUBLICATION_DATE');
    tedUrl.searchParams.set('sortOrder', 'DESC');

    const response = await fetch(tedUrl.toString(), {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({
        error: 'TED API error',
        details: errText,
      });
    }

    const data = await response.json();
    const notices = data.notices || data.results || [];

    const winners = (Array.isArray(notices) ? notices : []).map((notice, index) => {
      const winnerName = notice.winnerName?.text || notice['winner-name'] || notice.WIN || '';
      const amount = notice.awardedValue?.amount || notice['awarded-value'] || notice.VA || 0;
      const tender = notice.title?.text || notice['title-text'] || notice.TI || '';
      const authority = notice.buyerName?.text || notice['buyer-name'] || notice.AA || '';
      const date = notice.publicationDate || notice['publication-date'] || notice.PD || '';
      const noticeId = notice.noticeId || notice['notice-id'] || notice.id || '';

      return {
        id: noticeId || `win-${index}`,
        name: winnerName || 'Non communiqué',
        amount: typeof amount === 'number' ? amount : parseFloat(amount) || 0,
        tender,
        authority,
        date,
        website: '',
        linkedin: '',
        email: '',
        speciality: '',
        collaborationScore: Math.floor(Math.random() * 30) + 60,
        noticeUrl: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
      };
    });

    return res.status(200).json({
      winners,
      total: data.totalNoticeCount || data.total || winners.length,
      page: data.page || 1,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Failed to fetch from TED API',
      message: error.message,
    });
  }
}
