export default async function handler(req, res) {
  const { q = '' } = req.query;

  // Expert query: CPV codes for communication & consulting
  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79411000 OR 79416000 OR 79950000]';
  const fullQuery = q ? `${baseQuery} AND "${q}"` : baseQuery;

  // Try multiple TED API URLs (v3.0 may have migrated to v3)
  const urls = [
    `https://ted.europa.eu/api/v3.0/notices/search?query=${encodeURIComponent(fullQuery)}&fields=ND,PD,CONTENT&pageSize=20&pageNum=1&sortField=PD&reverseOrder=true`,
    `https://api.ted.europa.eu/v3/notices/search?query=${encodeURIComponent(fullQuery)}&fields=ND,PD,CONTENT&pageSize=20&page=1&sortField=PUBLICATION_DATE&sortOrder=DESC`,
    `https://ted.europa.eu/api/v3.0/notices/search?q=${encodeURIComponent(fullQuery)}&fields=ND,PD,CONTENT&pageSize=20&pageNum=1&sortField=PD&reverseOrder=true`,
  ];

  // Also try POST variants
  const postBodies = [
    { url: 'https://ted.europa.eu/api/v3.0/notices/search', body: { query: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, pageNum: 1, sortField: 'PD', reverseOrder: true } },
    { url: 'https://api.ted.europa.eu/v3/notices/search', body: { query: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, page: 1 } },
    { url: 'https://ted.europa.eu/api/v3.0/notices/search', body: { q: fullQuery, fields: ['ND', 'PD', 'CONTENT'], scope: 3, pageSize: 20, pageNum: 1, sortField: 'PD', reverseOrder: false } },
  ];

  const debugInfo = [];

  // Try GET requests
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      debugInfo.push({ method: 'GET', url: url.substring(0, 80), status: response.status });
      if (response.ok) {
        const data = await response.json();
        const results = data.results || data.notices || [];
        if (Array.isArray(results) && results.length > 0) {
          const tenders = results.map((n, i) => parseNotice(n, i)).filter(Boolean);
          return res.status(200).json({ tenders, total: data.total || tenders.length, source: 'live' });
        }
      }
    } catch (e) {
      debugInfo.push({ method: 'GET', url: url.substring(0, 80), error: e.message });
    }
  }

  // Try POST requests
  for (const { url, body } of postBodies) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
      debugInfo.push({ method: 'POST', url: url.substring(0, 80), status: response.status });
      if (response.ok) {
        const data = await response.json();
        const results = data.results || data.notices || [];
        if (Array.isArray(results) && results.length > 0) {
          const tenders = results.map((n, i) => parseNotice(n, i)).filter(Boolean);
          return res.status(200).json({ tenders, total: data.total || tenders.length, source: 'live' });
        }
      }
    } catch (e) {
      debugInfo.push({ method: 'POST', url: url.substring(0, 80), error: e.message });
    }
  }

  // All attempts failed
  return res.status(200).json({ tenders: [], total: 0, source: 'api_unavailable', debug: debugInfo });
}

function parseNotice(notice, index) {
  const noticeId = notice.ND || notice.noticeId || notice.id || '';
  const pubDate = notice.PD || notice.publicationDate || '';

  let title = '';
  let authority = '';
  let description = '';
  let deadline = '';
  let budget = 0;
  let country = '';

  if (notice.content || notice.CONTENT) {
    try {
      const xml = Buffer.from(notice.content || notice.CONTENT, 'base64').toString('utf-8');
      const titleMatch = xml.match(/<TITLE[^>]*>\s*<P>(.*?)<\/P>/s) || xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      title = titleMatch ? cleanXml(titleMatch[1]) : '';
      const authMatch = xml.match(/<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/);
      authority = authMatch ? cleanXml(authMatch[1]) : '';
      const descMatch = xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      description = descMatch ? cleanXml(descMatch[1]) : '';
      const deadlineMatch = xml.match(/<DATE_RECEIPT_TENDERS>(.*?)<\/DATE_RECEIPT_TENDERS>/);
      deadline = deadlineMatch ? deadlineMatch[1] : '';
      const valueMatch = xml.match(/<VAL_ESTIMATED_TOTAL[^>]*>(.*?)<\/VAL_ESTIMATED_TOTAL>/) || xml.match(/<VAL_TOTAL[^>]*>(.*?)<\/VAL_TOTAL>/);
      budget = valueMatch ? parseFloat(valueMatch[1]) || 0 : 0;
      const countryMatch = xml.match(/<COUNTRY VALUE="(.*?)"/);
      country = countryMatch ? countryMatch[1] : '';
    } catch { /* ignore */ }
  }

  // Also try direct fields (non-XML responses)
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

  let formattedPubDate = pubDate;
  if (pubDate && pubDate.length === 8) formattedPubDate = `${pubDate.slice(0,4)}-${pubDate.slice(4,6)}-${pubDate.slice(6,8)}`;

  return {
    id: noticeId || `ted-${index}`,
    title: title || `Avis TED ${noticeId}`,
    authority, source, sector, budget, deadline,
    published: formattedPubDate,
    description: description || title || 'Description non disponible',
    keywords: [], relevanceScore, status,
    referenceNumber: noticeId,
    url: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
  };
}

function cleanXml(t) { return t.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
