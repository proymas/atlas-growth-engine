import { oauth1Header, xCredentials } from './oauth1.js';

const creds = xCredentials();
const createUrl = 'https://api.x.com/2/tweets';
const text = `Atlas API connectivity test ${new Date().toISOString()}`;

const createRes = await fetch(createUrl, {
  method: 'POST',
  headers: {
    Authorization: oauth1Header('POST', createUrl, creds.X_API_KEY, creds.X_API_KEY_SECRET, creds.X_ACCESS_TOKEN, creds.X_ACCESS_TOKEN_SECRET),
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ text }),
});

const createBody = await createRes.json().catch(async () => ({ raw: await createRes.text() }));
if (!createRes.ok || !createBody?.data?.id) {
  console.log(JSON.stringify({ phase: 'create', ok: false, status: createRes.status, body: createBody }, null, 2));
  process.exit(1);
}

const postId = String(createBody.data.id);
const deleteUrl = `https://api.x.com/2/tweets/${postId}`;
const deleteRes = await fetch(deleteUrl, {
  method: 'DELETE',
  headers: {
    Authorization: oauth1Header('DELETE', deleteUrl, creds.X_API_KEY, creds.X_API_KEY_SECRET, creds.X_ACCESS_TOKEN, creds.X_ACCESS_TOKEN_SECRET),
  },
});
const deleteBody = await deleteRes.json().catch(async () => ({ raw: await deleteRes.text() }));

console.log(JSON.stringify({
  create: { ok: true, status: createRes.status, id: postId },
  delete: { ok: deleteRes.ok, status: deleteRes.status, body: deleteBody },
}, null, 2));

if (!deleteRes.ok || deleteBody?.data?.deleted !== true) process.exitCode = 2;
