import type { Page } from 'playwright';
import type { ThreadContext } from './conversation-core.js';

export async function readThreadContext(page: Page, url: string): Promise<ThreadContext | null> {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  if (!response?.ok()) return null;
  await page.waitForTimeout(1800);

  return page.evaluate(() => {
    const href = location.href;
    const m = href.match(/\/comments\/([a-z0-9]+)\//i);
    const id = m?.[1] ?? '';
    const title = (document.querySelector('h1')?.textContent ?? '').trim().replace(/\s+/g, ' ');
    const post = document.querySelector('shreddit-post');
    const postBody = ((post?.shadowRoot?.textContent ?? post?.textContent ?? '') as string).trim().replace(/\s+/g, ' ').slice(0, 12000);
    const author = post?.getAttribute('author') ?? '';
    const subreddit = post?.getAttribute('subreddit-prefixed-name')?.replace(/^r\//, '') ?? '';

    const comments = Array.from(document.querySelectorAll('shreddit-comment')).slice(0, 30).map((el: Element) => ({
      author: el.getAttribute('author') ?? '',
      body: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 2500),
      depth: Number(el.getAttribute('depth') ?? 0),
    })).filter(c => c.body.length > 0);

    return { id, url: href.split('?')[0], subreddit, title, postBody, author, comments };
  }) as Promise<ThreadContext>;
}
