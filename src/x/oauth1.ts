import crypto from 'node:crypto';

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function oauth1Header(method: string, url: string, consumerKey: string, consumerSecret: string, accessToken: string, accessTokenSecret: string): string {
  const params: Record<string, string> = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const parameterString = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .join('&');

  const signatureBase = [method.toUpperCase(), encode(url), encode(parameterString)].join('&');
  const signingKey = `${encode(consumerSecret)}&${encode(accessTokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');

  return 'OAuth ' + Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encode(key)}="${encode(value)}"`)
    .join(', ');
}

export function xCredentials() {
  const names = ['X_API_KEY', 'X_API_KEY_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'] as const;
  const values = Object.fromEntries(names.map((name) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`Missing ${name}`);
    return [name, value];
  }));
  return values as Record<(typeof names)[number], string>;
}
