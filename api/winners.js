export default async function handler(req, res) {
  const { q = '' } = req.query;

  // TED API — search for contract award notices (document type 7 = Contract award)
  const TED_URL = 'https://ted.europa.eu/api/v3.0/notices/search';

  const baseQuery = 'cpv=[79340000 OR 79341000 OR 79342000 OR 79400000 OR 79410000 OR 79411000 OR 79416000] AND TD=[7]';
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
        winners: [],
        total: 0,
        source: 'api_error',
        debug: { status: response.status, body: errText.substring(0, 500) },
      });
    }

    const data = await response.json();
    const results = data.results || [];

    const winners = results
      .map((notice, index) => parseAwardNotice(notice, index))
      .filter((w) => w !== null);

    return res.status(200).json({
      winners,
      total: data.total || winners.length,
      source: 'live',
    });
  } catch (error) {
    return res.status(200).json({
      winners: [],
      total: 0,
      source: 'api_error',
      debug: { message: error.message },
    });
  }
}

function parseAwardNotice(notice, index) {
  const noticeId = notice.ND || '';
  const pubDate = notice.PD || '';

  let name = '';
  let amount = 0;
  let tender = '';
  let authority = '';

  if (notice.content || notice.CONTENT) {
    try {
      const xml = Buffer.from(notice.content || notice.CONTENT, 'base64').toString('utf-8');

      // Winner name
      const winnerMatch = xml.match(/<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/g);
      if (winnerMatch && winnerMatch.length > 1) {
        // Second OFFICIALNAME is usually the winner (first is contracting authority)
        name = winnerMatch[1].replace(/<\/?OFFICIALNAME>/g, '').trim();
        authority = winnerMatch[0].replace(/<\/?OFFICIALNAME>/g, '').trim();
      } else if (winnerMatch) {
        authority = winnerMatch[0].replace(/<\/?OFFICIALNAME>/g, '').trim();
      }

      // Also try CONTRACTOR tag
      const contractorMatch = xml.match(/<CONTRACTOR[^>]*>[\s\S]*?<OFFICIALNAME>(.*?)<\/OFFICIALNAME>/);
      if (contractorMatch) {
        name = contractorMatch[1].trim();
      }

      // Title
      const titleMatch = xml.match(/<TITLE[^>]*>\s*<P>(.*?)<\/P>/s) || xml.match(/<SHORT_DESCR[^>]*>\s*<P>(.*?)<\/P>/s);
      tender = titleMatch ? cleanXml(titleMatch[1]) : '';

      // Awarded value
      const valueMatch = xml.match(/<VAL_TOTAL[^>]*>(.*?)<\/VAL_TOTAL>/) || xml.match(/<VAL_ESTIMATED_TOTAL[^>]*>(.*?)<\/VAL_ESTIMATED_TOTAL>/);
      amount = valueMatch ? parseFloat(valueMatch[1]) || 0 : 0;
    } catch {
      // XML parsing failed
    }
  }

  if (!tender && !noticeId) return null;

  let formattedPubDate = pubDate;
  if (pubDate && pubDate.length === 8) {
    formattedPubDate = `${pubDate.slice(0, 4)}-${pubDate.slice(4, 6)}-${pubDate.slice(6, 8)}`;
  }

  return {
    id: noticeId || `win-${index}`,
    name: name || 'Non communiqué',
    amount,
    tender: tender || `Attribution TED ${noticeId}`,
    authority,
    date: formattedPubDate,
    website: '',
    linkedin: '',
    email: '',
    speciality: '',
    collaborationScore: Math.floor(Math.random() * 30) + 60,
    noticeUrl: `https://ted.europa.eu/en/notice/-/detail/${noticeId}`,
  };
}

function cleanXml(text) {
  return text
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
