export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';
  const safeFields = ['publication-number', 'notice-title', 'buyer-name'];

  const bodyVariants = [
    // 1: Award notices for communication/consulting CPV codes
    {
      query: 'notice-type=can-standard AND (cpv=79340000 OR cpv=79400000 OR cpv=79410000 OR cpv=79416000)',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 2: Award notices — PC field
    {
      query: 'notice-type=can-standard AND PC IN (79340000,79400000,79410000)',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 3: Award notices in Belgium
    {
      query: q
        ? `notice-type=can-standard AND organisation-country-buyer IN (BEL) AND "${q}"`
        : 'notice-type=can-standard AND organisation-country-buyer IN (BEL) AND PD>20250101',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      paginationMode: 'PAGE_NUMBER',
      page: 1,
      checkQuerySyntax: false,
    },
    // 4: Recent award notices with communication keywords
    {
      query: 'notice-type=can-standard AND PD>20250101 AND (communication OR marketing OR consulting)',
      fields: safeFields,
      limit: 20,
      scope: 'ALL',
      checkQuerySyntax: false,
    },
    // 5: Broadest — recent award notices
    {
      query: 'notice-type=can-standard AND PD>20250301',
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
          const winners = notices.map((n, idx) => parseAward(n, idx)).filter(Boolean);
          return res.status(200).json({
            winners,
            total: data.totalNoticeCount || winners.length,
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

  return res.status(200).json({ winners: [], total: 0, source: 'api_unavailable', debug: debugInfo });
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
    speciality: '',
    collaborationScore: Math.floor(Math.random() * 30) + 60,
    noticeUrl: `https://ted.europa.eu/en/notice/-/detail/${id}`,
  };
}
