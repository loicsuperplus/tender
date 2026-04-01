export default async function handler(req, res) {
  const { q = '' } = req.query;

  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79416000] AND TD=[7]';
  const fullQuery = q ? `${baseQuery} AND "${q}"` : baseQuery;

  const urls = [
    `https://ted.europa.eu/api/v3.0/notices/search?query=${encodeURIComponent(fullQuery)}&fields=ND,PD,CONTENT&pageSize=20&pageNum=1&sortField=PD&reverseOrder=true`,
    `https://api.ted.europa.eu/v3/notices/search?query=${encodeURIComponent(fullQuery)}&fields=ND,PD,CONTENT&pageSize=20&page=1`,
    `https://ted.europa.eu/api/v3.0/notices/search?q=${encodeURIComponent(fullQuery)}&fields=ND,PD,CONTENT&pageSize=20&pageNum=1`,
  ];

  const postBodies = [
    { url: 'https://ted.europa.eu/api/v3.0/notices/search', body: { query: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, pageNum: 1 } },
    { url: 'https://api.ted.europa.eu/v3/notices/search', body: { query: fullQuery, fields: ['ND', 'PD', 'CONTENT'], pageSize: 20, page: 1 } },
    { url: 'https://ted.europa.eu/api/v3.0/notices/search', body: { q: fullQuery, fields: ['ND', 'PD', 'CONTENT'], scope: 3, pageSize: 20, pageNum: 1 } },
  ];

  const debugInfo = [];

  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(8000) });
      debugInfo.push({ method: 'GET', status: response.status });
      if (response.ok) {
        const data = await response.json();
        const results = data.results || data.notices || [];
        if (Array.isArray(results) && results.length > 0) {
          const winners = results.map((n, i) => parseAward(n, i)).filter(Boolean);
          return res.status(200).json({ winners, total: data.total || winners.length, source: 'live' });
        }
      }
    } catch (e) { debugInfo.push({ method: 'GET', error: e.message }); }
  }

  for (const { url, body } of postBodies) {
    try {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) });
      debugInfo.push({ method: 'POST', status: response.status });
      if (response.ok) {
        const data = await response.json();
        const results = data.results || data.notices || [];
        if (Array.isArray(results) && results.length > 0) {
          const winners = results.map((n, i) => parseAward(n, i)).filter(Boolean);
          return res.status(200).json({ winners, total: data.total || winners.length, source: 'live' });
        }
      }
    } catch (e) { debugInfo.push({ method: 'POST', error: e.message }); }
  }

  return res.status(200).json({ winners: [], total: 0, source: 'api_unavailable', debug: debugInfo });
}

function parseAward(notice, index) {
  const noticeId = notice.ND || notice.noticeId || notice.id || '';
  const pubDate = notice.PD || '';

  let name = '', amount = 0, tender = '', authority = '';

  if (notice.content || notice.CONTENT) {
    try {
      const xml = Buffer.from(notice.content || notice.CONTENT, 'base64').toString('utf-8');
      const officials = xml.match(/<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/g) || [];
      if (officials.length > 1) {
        authority = officials[0].replace(/<\/?OFFICIALNAME>/g, '').trim();
        name = officials[1].replace(/<\/?OFFICIALNAME>/g, '').trim();
      } else if (officials.length === 1) {
        authority = officials[0].replace(/<\/?OFFICIALNAME>/g, '').trim();
      }
      const contractorMatch = xml.match(/<CONTRACTOR[\s\S]*?<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/);
      if (contractorMatch) name = contractorMatch[1].trim();
      const titleMatch = xml.match(/<TITLE[^>]*>\s*<P>(.*?)<\/P>/s);
      tender = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const valMatch = xml.match(/<VAL_TOTAL[^>]*>(.*?)<\/VAL_TOTAL>/);
      amount = valMatch ? parseFloat(valMatch[1]) || 0 : 0;
    } catch { /* ignore */ }
  }

  if (!tender && !noticeId) return null;

  let formattedPubDate = pubDate;
  if (pubDate && pubDate.length === 8) formattedPubDate = `${pubDate.slice(0,4)}-${pubDate.slice(4,6)}-${pubDate.slice(6,8)}`;

  return {
    id: noticeId || `win-${index}`,
    name: name || 'Non communiqué',
    amount, tender: tender || `Attribution TED ${noticeId}`, authority,
    date: formattedPubDate, website: '', linkedin: '', email: '', speciality: '',
    collaborationScore: Math.floor(Math.random() * 30) + 60,
    noticeUrl: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
  };
}
