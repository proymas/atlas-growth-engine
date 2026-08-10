const required = [
  'X_API_KEY',
  'X_API_KEY_SECRET',
  'X_ACCESS_TOKEN',
  'X_ACCESS_TOKEN_SECRET',
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing ${key}`);
  }
}

console.log(JSON.stringify({
  envLoaded: true,
  hasApiKey: Boolean(process.env.X_API_KEY),
  hasApiKeySecret: Boolean(process.env.X_API_KEY_SECRET),
  hasAccessToken: Boolean(process.env.X_ACCESS_TOKEN),
  hasAccessTokenSecret: Boolean(process.env.X_ACCESS_TOKEN_SECRET),
}, null, 2));
