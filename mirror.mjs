// Дзеркало останніх записів сайту Української громади (ukrainska-gromada.gov.ua) для ukrainka.top.
// Сервер автозбирання ukrainka.top не має доступу до сайту громади, тому бере записи звідси.
// posts.json — відповідь WordPress REST API як є, лише адреси головних зображень замінено на копії в img/.
// Запуск: node mirror.mjs (без залежностей, Node 20+)
import { writeFile, mkdir, readdir, rm } from 'node:fs/promises';

const API = 'https://ukrainska-gromada.gov.ua/wp-json/wp/v2/posts';
const FIELDS = 'id,date_gmt,link,title,content,categories,_links,_embedded';
const RAW = process.env.MIRROR_RAW ?? 'https://raw.githubusercontent.com/i-stadnyk/ukrainka-gromada-mirror/main';
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

async function get(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res;
    } catch (e) {
      if (attempt >= 3) throw e;
      await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
}

const posts = await (await get(`${API}?per_page=30&page=1&_embed=wp:featuredmedia&_fields=${FIELDS}`)).json();
if (!Array.isArray(posts) || posts.length < 5) throw new Error(`Замало записів: ${posts?.length}`);

await mkdir('img', { recursive: true });
const keep = new Set();
for (const p of posts) {
  const m = p._embedded?.['wp:featuredmedia']?.[0];
  if (!m?.source_url || !/^image\//.test(m.mime_type ?? '')) continue;
  const s = m.media_details?.sizes ?? {};
  // той самий вибір розміру, що й у ukrainka.top: близько 768–1024 px, інакше оригінал
  const src = (s.medium_large ?? s.large ?? s.full)?.source_url ?? m.source_url;
  try {
    const res = await get(src);
    const ext = EXT[(res.headers.get('content-type') ?? '').split(';')[0].trim()];
    if (!ext) continue;
    const name = `${p.id}.${ext}`;
    await writeFile(`img/${name}`, Buffer.from(await res.arrayBuffer()));
    keep.add(name);
    const url = `${RAW}/img/${name}`;
    m.source_url = url;
    for (const size of Object.values(s)) size.source_url = url;
  } catch (e) {
    console.log(`зображення ${p.id}: ${e.message}`);
  }
}
for (const f of await readdir('img')) if (!keep.has(f)) await rm(`img/${f}`);

await writeFile('posts.json', JSON.stringify(posts, null, 1));
await writeFile('meta.json', JSON.stringify({ source: API, posts: posts.length, newest: posts[0]?.date_gmt }, null, 1));
console.log(`OK: ${posts.length} записів, ${keep.size} зображень; найновіший ${posts[0]?.date_gmt}`);
