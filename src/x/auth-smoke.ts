import crypto from 'node:crypto';

const required = [
  'X_API_KEY',
  'X_API_KEY_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_TOKEN_SECRET',
] as const;

for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
}

const apiKey = process.env.X_API_KEY!;
const apiKeySecret = process.env.X_API_KEY_SECRET!;
const accessToken = process.env.X_ACCESS_TOKEN!;
const accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET!;

const method = 'GET';
const url = 'https://api.x.com/2/users/me';

const enc = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);

const oauth: Record<string, string> = {
  oauth_consumer_key: apiKey,
  oauth_nonce: crypto.randomBytes(16).toString('hex'),
  oauth_signature_method: 'HMAC-SHA1',
  oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
  oauth_token: accessToken,
  oauth_version: '1.0',
};

const parameterString = Object.entries(oauth)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${enc(k)}=${enc(v)}`)
  .join('&');

const signatureBase = `${method}&${enc(url)}&${enc(parameterString)}`;
const signingKey = `${enc(apiKeySecret)}&${enc(accessTokenSecret)}`;
oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

const authorization = 'OAuth ' + Object.entries(oauth)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `${enc(k)}=\"${enc(v)}\"`)
  .join(', ');

const response = await fetch(url, { headers: { Authorization: authorization } });
const text = await response.text();
let body: unknown;
try { body = JSON.parse(text); } catch { body = text.slice(0, 500); }

console.log(JSON.stringify({ ok: response.ok, status: response.status, body }, null, 2));
if (!response.ok) process.exitCode = 1;
