const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const API_BASE = 'https://oauth.reddit.com';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function basicAuth(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

export type RedditToken = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

async function tokenRequest(body: URLSearchParams): Promise<RedditToken> {
  const clientId = requireEnv('REDDIT_CLIENT_ID');
  const clientSecret = requireEnv('REDDIT_CLIENT_SECRET');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.REDDIT_USER_AGENT ?? 'linux:atlas-growth-engine:v0.1 (by /u/atlas)',
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) throw new Error(`Reddit token request failed ${response.status}: ${text}`);
  return JSON.parse(text) as RedditToken;
}

export function getAppOnlyToken(): Promise<RedditToken> {
  return tokenRequest(new URLSearchParams({ grant_type: 'client_credentials' }));
}

export function getUserToken(): Promise<RedditToken> {
  const refreshToken = requireEnv('REDDIT_REFRESH_TOKEN');
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  );
}

export async function redditApi<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': process.env.REDDIT_USER_AGENT ?? 'linux:atlas-growth-engine:v0.1 (by /u/atlas)',
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Reddit API failed ${response.status} ${path}: ${text}`);
  return JSON.parse(text) as T;
}
