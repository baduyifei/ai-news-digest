import { XMLParser } from 'fast-xml-parser';
import type { RawFeed } from './fetch.js';

export interface Article {
  title: string;
  link: string;
  pubDate: Date;
  source: string;
  summary: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  // Preserve CDATA sections as text
  cdataPropName: '#cdata',
});

function stripHtml(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#?\w+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractText(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'number') return String(val);
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // CDATA or mixed content
    return String(obj['#cdata'] ?? obj['#text'] ?? '');
  }
  return '';
}

function extractLink(item: Record<string, unknown>): string | null {
  const raw = item['link'];

  // RSS 2.0: <link>https://...</link>
  if (typeof raw === 'string' && raw.startsWith('http')) return raw;

  // Atom: <link href="..." rel="alternate"/>
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (typeof obj['@_href'] === 'string') return obj['@_href'];
  }

  // Atom: multiple <link> elements as array
  if (Array.isArray(raw)) {
    const links = raw as Record<string, unknown>[];
    const alternate = links.find(
      (l) => !l['@_rel'] || l['@_rel'] === 'alternate'
    );
    if (alternate && typeof alternate['@_href'] === 'string') {
      return alternate['@_href'];
    }
  }

  // Fallback: guid or id
  const guid = item['guid'];
  if (typeof guid === 'string' && guid.startsWith('http')) return guid;
  if (guid && typeof guid === 'object') {
    const text = extractText(guid);
    if (text.startsWith('http')) return text;
  }
  const id = item['id'];
  if (typeof id === 'string' && id.startsWith('http')) return id;

  return null;
}

function extractPubDate(item: Record<string, unknown>): Date | null {
  const raw =
    item['pubDate'] ??
    item['published'] ??
    item['updated'] ??
    item['dc:date'];
  if (!raw) return null;
  const date = new Date(extractText(raw));
  return isNaN(date.getTime()) ? null : date;
}

function extractSummary(item: Record<string, unknown>): string {
  const raw =
    item['description'] ??
    item['summary'] ??
    item['content'] ??
    item['content:encoded'];
  if (!raw) return '';

  const text = stripHtml(extractText(raw));
  if (!text) return '';
  // Keep up to 500 chars so the AI summarizer has enough context
  return text.length > 500 ? text.slice(0, 500).trimEnd() + '…' : text;
}

function toItems(channel: Record<string, unknown>): unknown[] {
  const rssItems = channel['item'];
  if (rssItems) {
    return Array.isArray(rssItems) ? rssItems : [rssItems];
  }
  const atomEntries = channel['entry'];
  if (atomEntries) {
    return Array.isArray(atomEntries) ? atomEntries : [atomEntries];
  }
  return [];
}

export function parseFeed(feed: RawFeed): Article[] {
  try {
    const doc = parser.parse(feed.xml) as Record<string, unknown>;
    const rss = doc['rss'] as Record<string, unknown> | undefined;
    const atom = doc['feed'] as Record<string, unknown> | undefined;
    const channel = (rss?.['channel'] ?? atom) as
      | Record<string, unknown>
      | undefined;

    if (!channel) return [];

    return toItems(channel)
      .map((raw) => {
        const item = raw as Record<string, unknown>;
        const title = stripHtml(extractText(item['title'])).trim();
        const link = extractLink(item);
        const pubDate = extractPubDate(item);
        if (!title || !link || !pubDate) return null;
        return {
          title,
          link,
          pubDate,
          source: feed.name,
          summary: extractSummary(item),
        } satisfies Article;
      })
      .filter((a): a is Article => a !== null);
  } catch (e) {
    console.error(`[warn] ${feed.name} 解析失败: ${e}`);
    return [];
  }
}

export function filterLast24h(articles: Article[]): Article[] {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return articles.filter((a) => a.pubDate >= cutoff);
}
