import { chromium, type BrowserContext } from 'playwright';
import path from 'node:path';

export function getXChromeConfig() {
  const userDataDir = process.env.X_CHROME_USER_DATA_DIR || path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data');
  const profile = process.env.X_CHROME_PROFILE || 'Profile 3';
  return { userDataDir, profile };
}

export async function launchXContext(headless = false): Promise<BrowserContext> {
  const { userDataDir, profile } = getXChromeConfig();
  return chromium.launchPersistentContext(userDataDir, {
    channel: 'chrome',
    headless,
    viewport: null,
    args: [`--profile-directory=${profile}`],
  });
}
