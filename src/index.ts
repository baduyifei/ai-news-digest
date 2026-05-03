import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import cron from 'node-cron';
import { fetchAllFeeds } from './fetch.js';
import { parseFeed, filterLast24h } from './parse.js';
import { summarizeArticles } from './summarize.js';
import { renderMarkdown } from './render.js';

async function run() {
  console.log(`[${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}] 正在抓取 RSS 源...`);
  const feeds = await fetchAllFeeds();

  if (feeds.length === 0) {
    console.error('所有源均抓取失败，跳过本次');
    return;
  }

  const allArticles = feeds.flatMap((feed) => parseFeed(feed));
  const seen = new Set<string>();
  const deduped = allArticles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
  const recent = filterLast24h(deduped);

  recent.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  const dupCount = allArticles.length - deduped.length;
  console.log(`共抓取 ${allArticles.length} 篇，去重 ${dupCount} 篇，过滤后保留最近 24 小时 ${recent.length} 篇`);

  await summarizeArticles(recent);

  const markdown = renderMarkdown(recent);

  const outputDir = join(process.cwd(), 'output');
  await mkdir(outputDir, { recursive: true });

  const dateStr = new Date()
    .toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Shanghai',
    })
    .replace(/\//g, '-');

  const outputPath = join(outputDir, `${dateStr}.md`);
  await writeFile(outputPath, markdown, 'utf-8');

  console.log(`日报已写入: ${outputPath}`);
}

const useCron = process.argv.includes('--cron');

if (useCron) {
  console.log('定时模式已启动，每天上午 08:00（北京时间）运行');
  // Run once immediately on startup, then on schedule
  run();
  cron.schedule('0 8 * * *', run, { timezone: 'Asia/Shanghai' });
} else {
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
