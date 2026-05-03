import type { Article } from './parse.js';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  });
}

function formatDate(date: Date): string {
  return date
    .toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai',
    })
    .replace(/\//g, '-');
}

export function renderMarkdown(articles: Article[]): string {
  const today = formatDate(new Date());
  const sourceNames = [...new Set(articles.map((a) => a.source))];
  const sourceCount = sourceNames.length;
  const totalCount = articles.length;

  const lines: string[] = [
    `# AI 新闻日报 · ${today}`,
    '',
    `> 共收录 **${totalCount}** 篇，来自 **${sourceCount}** 个源：${sourceNames.join(' · ')}`,
    '',
  ];

  // Group by source, preserving original source order
  const grouped = new Map<string, Article[]>();
  for (const article of articles) {
    const group = grouped.get(article.source) ?? [];
    group.push(article);
    grouped.set(article.source, group);
  }

  for (const [source, items] of grouped) {
    lines.push(`## ${source} (${items.length})`);
    lines.push('');
    for (const article of items) {
      lines.push(`- **[${article.title}](${article.link})** · ${formatTime(article.pubDate)}`);
      if (article.summary) {
        lines.push(`  > ${article.summary}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
