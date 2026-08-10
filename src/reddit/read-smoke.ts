import { getAppOnlyToken, redditApi } from './oauth.js';

const token = await getAppOnlyToken();
const listing = await redditApi<any>('/r/SideProject/new?limit=5&raw_json=1', token.access_token);
const children = listing?.data?.children ?? [];
console.log(
  JSON.stringify(
    {
      ok: true,
      count: children.length,
      posts: children.map((child: any) => ({
        id: child?.data?.name,
        title: child?.data?.title,
        author: child?.data?.author,
        permalink: child?.data?.permalink,
      })),
    },
    null,
    2,
  ),
);
