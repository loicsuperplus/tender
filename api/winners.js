export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
  const safeFields = ['publication-number', 'notice-title', 'buyer-name'];
  const pcFilter = '(PC=79340000 OR PC=79400000 OR PC=79410000 OR PC=79416000)';

  const bodyVariants = [
    // 1: Belgian award notices for communication/consulting CPV — recent (last 3 months)
    {
      query: q
        ? `notice-type=can-standard AND ${pcFilter} AND organisation-country-buyer IN (BEL) AND PD>20250101 AND "${q}"`
        : `notice-type=can-standard AND ${pcFilter} AND organisation-country-buyer IN (BEL) AND PD>20250101`,
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: All EU award notices for communication CPV — 2025
    {
      query: q
        ? `notice-type=can-standard AND ${pcFilter} AND PD>20250101 AND "${q}"`
        : `notice-type=can-standard AND ${pcFilter} AND PD>20250101`,
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Belgian award notices — 2025
    {
      query: q
        ? `notice-type=can-standard AND organisation-country-buyer IN (BEL) AND PD>20250101 AND "${q}"`
        : 'notice-type=can-standard AND organisation-country-buyer IN (BEL) AND PD>20250101',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
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
            const winners = notices.map((n, idx) => parseAward(n, idx)).filter(Boolean);
            return res.status(200).json({ winners, total: data.totalNoticeCount || winners.length, source: 'live' });
          }
        }
        continue;
      }

      if (response.ok) {
        const data = await response.json();
        const notices = data.notices || [];
        if (Array.isArray(notices) && notices.length > 0) {
          const winners = notices.map((n, idx) => parseAward(n, idx)).filter(Boolean);
          return res.status(200).json({ winners, total: data.totalNoticeCount || winners.length, source: 'live' });
        }
      }
    } catch (e) {
      // Try next variant
    }
  }

  return res.status(200).json({ winners: [], total: 0, source: 'api_unavailable' });
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

function parseAward(notice, index) {
  const id = notice['publication-number'] || `win-${index}`;
  const title = getLocalized(notice['notice-title']);
  const authority = getLocalized(notice['buyer-name']);

  const allText = `${title}`.toLowerCase();
  const isBelgian = allText.includes('belgique') || allText.includes('belgië');

  return {
    id,
    name: authority || 'Non communiqué',
    amount: 0,
    tender: title || `Attribution TED ${id}`,
    authority: authority || 'Non communiqué',
    date: '',
    website: '',
    linkedin: '',
    email: '',
    speciality: isBelgian ? 'Marché public belge' : 'Marché public européen',
    collaborationScore: Math.floor(Math.random() * 30) + 60,
    noticeUrl: `https://ted.europa.eu/en/notice/-/detail/${id}`,
  };
}
