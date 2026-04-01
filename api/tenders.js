export default async function handler(req, res) {
  const { q = '' } = req.query;

  // TED API — confirmed working endpoint
  const TED_URL = 'https://ted.europa.eu/api/v3.0/notices/search';

  // Expert query: CPV codes for communication & consulting in Belgium/EU
  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79411000 OR 79416000 OR 79950000]';
  const fullQuery = q ? `${baseQuery} AND "${q}"` : baseQuery;

  try {
    const response = await fetch(TED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: fullQuery,
        fields: ['ND', 'PD', 'CONTENT'],
        scope: 3,
        pageNum: 1,
        pageSize: 20,
        sortField: 'PD',
        reverseOrder: true,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(200).json({
        tenders: [],
        total: 0,
        source: 'api_error',
        debug: { status: response.status, body: errText.substring(0, 500) },
      });
    }

    const data = await response.json();
    const results = data.results || [];

    const tenders = results
      .map((notice, index) => parseNotice(notice, index))
      .filter((t) => t !== null);

    return res.status(200).json({
      tenders,
      total: data.total || tenders.length,
      source: 'live',
    });
  } catch (error) {
    return res.status(200).json({
      tenders: [],
      total: 0,
      source: 'api_error',
      debug: { message: error.message },
    });
  }
}

function parseNotice(notice, index) {
  const noticeId = notice.ND || '';
  const pubDate = notice.PD || '';

  // Content is base64-encoded XML — parse key fields
  let title = '';
  let authority = '';
  let description = '';
  let deadline = '';
  let budget = 0;
  let country = '';

  if (notice.content || notice.CONTENT) {
    try {
      const xml = Buffer.from(notice.content || notice.CONTENT, 'base64').toString('utf-8');

      // Extract title
      const titleMatch = xml.match(/<TITLE[^>]*>\s*<P>(.*?)<\/P>/s) || xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      title = titleMatch ? cleanXml(titleMatch[1]) : '';

      // Extract contracting authority
      const authMatch = xml.match(/<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/);
      authority = authMatch ? cleanXml(authMatch[1]) : '';

      // Extract short description
      const descMatch = xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      description = descMatch ? cleanXml(descMatch[1]) : '';

      // Extract deadline
      const deadlineMatch = xml.match(/<DATE_RECEIPT_TENDERS>(.*?)<\/DATE_RECEIPT_TENDERS>/) || xml.match(/<DT_DATE_FOR_SUBMISSION>(.*?)<\/DT_DATE_FOR_SUBMISSION>/);
      deadline = deadlineMatch ? deadlineMatch[1] : '';

      // Extract estimated value
      const valueMatch = xml.match(/<VAL_ESTIMATED_TOTAL[^>]*>(.*?)<\/VAL_ESTIMATED_TOTAL>/) || xml.match(/<VAL_TOTAL[^>]*>(.*?)<\/VAL_TOTAL>/);
      budget = valueMatch ? parseFloat(valueMatch[1]) || 0 : 0;

      // Extract country
      const countryMatch = xml.match(/<COUNTRY VALUE="(.*?)"/);
      country = countryMatch ? countryMatch[1] : '';
    } catch {
      // XML parsing failed, use basic fields
    }
  }

  if (!title && !noticeId) return null;

  const source = (country === 'BE') ? 'e-Procurement' : 'TED';

  const allText = `${title} ${description} ${authority}`.toLowerCase();
  const relevantKeywords = ['communication', 'campagne', 'consulting', 'stratégie', 'digital', 'marketing', 'audit', 'conseil', 'campaign', 'strategy'];
  const matchCount = relevantKeywords.filter((kw) => allText.includes(kw)).length;
  const relevanceScore = Math.min(95, 50 + matchCount * 7);

  const commKeywords = ['communication', 'campagne', 'campaign', 'marketing', 'média', 'media', 'public relations', 'branding', 'événement', 'advertising'];
  const isComm = commKeywords.some((kw) => allText.includes(kw));
  const sector = isComm ? 'Communication & campagnes' : 'Consulting & stratégie';

  let status = 'open';
  if (deadline) {
    const daysLeft = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (daysLeft <= 7 && daysLeft > 0) status = 'closing_soon';
    if (daysLeft <= 0) status = 'closed';
  }

  // Format publication date from YYYYMMDD to YYYY-MM-DD
  let formattedPubDate = pubDate;
  if (pubDate && pubDate.length === 8) {
    formattedPubDate = `${pubDate.slice(0, 4)}-${pubDate.slice(4, 6)}-${pubDate.slice(6, 8)}`;
  }

  return {
    id: noticeId || `ted-${index}`,
    title: title || `Avis TED ${noticeId}`,
    authority,
    source,
    sector,
    budget,
    deadline,
    published: formattedPubDate,
    description: description || title || 'Description non disponible',
    keywords: [],
    relevanceScore,
    status,
    referenceNumber: noticeId,
    url: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
  };
}

function cleanXml(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
