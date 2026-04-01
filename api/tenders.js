export default async function handler(req, res) {
  const { q = '' } = req.query;

  const TED_URL = 'https://api.ted.europa.eu/v3/notices/search';

  // Try different body formats to find the one that works
  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79411000 OR 79416000 OR 79950000]';
  const fullQuery = q ? `${baseQuery} AND "${q}"` : baseQuery;

  const bodyVariants = [
    // Format 1: query + fields as documented
    { query: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, page: 1 },
    // Format 2: q instead of query (like tap-eu-ted)
    { q: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, pageNum: 1, scope: 3, sortField: 'PD', reverseOrder: true },
    // Format 3: minimal
    { query: fullQuery, pageSize: 20 },
    // Format 4: just q
    { q: fullQuery, pageSize: 20 },
    // Format 5: with scope
    { query: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, page: 1, scope: 3 },
    // Format 6: simple text search
    { query: 'communication consulting', pageSize: 20, page: 1 },
    // Format 7: empty to see what happens
    { query: '*', pageSize: 5 },
  ];

  const debugInfo = [];

  for (let i = 0; i < bodyVariants.length; i++) {
    try {
      const response = await fetch(TED_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(bodyVariants[i]),
        signal: AbortSignal.timeout(10000),
      });

      let responseBody = '';
      try { responseBody = await response.text(); } catch { responseBody = 'unreadable'; }

      debugInfo.push({
        variant: i + 1,
        status: response.status,
        sentBody: bodyVariants[i],
        response: responseBody.substring(0, 500),
      });

      if (response.ok) {
        try {
          const data = JSON.parse(responseBody);
          const results = data.results || data.notices || [];
          if (Array.isArray(results) && results.length > 0) {
            const tenders = results.map((n, idx) => parseNotice(n, idx)).filter(Boolean);
            return res.status(200).json({ tenders, total: data.total || tenders.length, source: 'live', workingVariant: i + 1 });
          }
          // OK but empty — note it
          debugInfo[debugInfo.length - 1].note = 'OK but empty results';
        } catch {
          debugInfo[debugInfo.length - 1].note = 'OK but invalid JSON';
        }
      }
    } catch (e) {
      debugInfo.push({ variant: i + 1, error: e.message });
    }
  }

  return res.status(200).json({ tenders: [], total: 0, source: 'api_unavailable', debug: debugInfo });
}

function parseNotice(notice, index) {
  const noticeId = notice.ND || notice.noticeId || notice.id || '';
  const pubDate = notice.PD || notice.publicationDate || '';

  let title = '', authority = '', description = '', deadline = '', budget = 0, country = '';

  if (notice.content || notice.CONTENT) {
    try {
      const xml = Buffer.from(notice.content || notice.CONTENT, 'base64').toString('utf-8');
      const titleMatch = xml.match(/<TITLE[^>]*>\s*<P>(.*?)<\/P>/s) || xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      title = titleMatch ? cleanXml(titleMatch[1]) : '';
      const authMatch = xml.match(/<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/);
      authority = authMatch ? cleanXml(authMatch[1]) : '';
      const descMatch = xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      description = descMatch ? cleanXml(descMatch[1]) : '';
      const dlMatch = xml.match(/<DATE_RECEIPT_TENDERS>(.*?)<\/DATE_RECEIPT_TENDERS>/);
      deadline = dlMatch ? dlMatch[1] : '';
      const valMatch = xml.match(/<VAL_ESTIMATED_TOTAL[^>]*>(.*?)<\/VAL_ESTIMATED_TOTAL>/) || xml.match(/<VAL_TOTAL[^>]*>(.*?)<\/VAL_TOTAL>/);
      budget = valMatch ? parseFloat(valMatch[1]) || 0 : 0;
      const cyMatch = xml.match(/<COUNTRY VALUE="(.*?)"/);
      country = cyMatch ? cyMatch[1] : '';
    } catch { /* ignore */ }
  }

  title = title || notice.title || notice.TI || '';
  authority = authority || notice.buyerName || notice.AA || '';
  if (!title && !noticeId) return null;

  const source = (country === 'BE') ? 'e-Procurement' : 'TED';
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

  let fmtDate = pubDate;
  if (pubDate && pubDate.length === 8) fmtDate = `${pubDate.slice(0,4)}-${pubDate.slice(4,6)}-${pubDate.slice(6,8)}`;

  return {
    id: noticeId || `ted-${index}`, title: title || `Avis TED ${noticeId}`,
    authority, source, sector, budget, deadline, published: fmtDate,
    description: description || title || 'Description non disponible',
    keywords: [], relevanceScore, status, referenceNumber: noticeId,
    url: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
  };
}

function cleanXml(t) { return t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
