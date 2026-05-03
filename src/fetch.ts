const SOURCES = [
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
  },
  {
    name: 'The Verge',
    url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',
  },
  {
    name: 'Hacker News',
    url: 'https://hnrss.org/newest?q=AI&count=30',
  },
];

export interface RawFeed {
  name: string;
  xml: string;
}

export async function fetchAllFeeds(): Promise<RawFeed[]> {
  const results = await Promise.allSettled(
    SOURCES.map(async ({ name, url }) => {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const xml = await res.text();
      return { name, xml };
    })
  );

  return results
    .map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      console.error(`[warn] ${SOURCES[i].name} 抓取失败: ${result.reason}`);
      return null;
    })
    .filter((r): r is RawFeed => r !== null);
}
