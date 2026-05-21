import Anthropic from '@anthropic-ai/sdk';
import type { Article } from './parse.js';

const CONCURRENCY = 5;

const SYSTEM_PROMPT =
  'You are a news summarizer. Given an article title and description, write exactly one concise sentence (under 60 words) in the same language as the title that captures the key point. Output only the sentence, no quotes, no labels.';

async function summarizeOne(
  client: Anthropic,
  article: Article
): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 120,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Title: ${article.title}\nDescription: ${article.summary}`,
      },
    ],
  });

  const block = response.content[0];
  return block.type === 'text' ? block.text.trim() : article.summary;
}

export async function summarizeArticles(articles: Article[]): Promise<void> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];
  if (!apiKey) {
    console.log('[summarize] 未设置 ANTHROPIC_API_KEY，跳过 AI 摘要');
    return;
  }

  const client = new Anthropic({ apiKey });

  let done = 0;
  const total = articles.length;

  // Worker-pool concurrency limit
  async function worker(queue: Article[]): Promise<void> {
    while (queue.length > 0) {
      const article = queue.shift()!;
      try {
        article.summary = await summarizeOne(client, article);
      } catch (e) {
        // Keep existing summary on failure
        console.warn(`[summarize] ${article.title.slice(0, 40)}… 失败: ${e}`);
      }
      done++;
      if (done % 10 === 0 || done === total) {
        process.stdout.write(`\r[summarize] ${done}/${total}`);
      }
    }
  }

  const queue = [...articles];
  const workers = Array.from({ length: Math.min(CONCURRENCY, articles.length) }, () =>
    worker(queue)
  );
  await Promise.all(workers);
  process.stdout.write('\n');
}
