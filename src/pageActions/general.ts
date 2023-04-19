import type { Log } from 'apify';
import type { Page } from 'playwright';

export const generalPageActions = {
  clickAwayCookieConsent: async ({ page, log }: { page: Page; log: Log }) => {
    const allowCookiesBtn = page.locator('#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll');

    log.info('Checking for cookie consent modal');
    const isCookieBtnPresent = await allowCookiesBtn.count();
    if (!isCookieBtnPresent) {
      log.info('No cookie consent modal found');
      return;
    }
    log.info('Clicking away cookie consent modal');
    await allowCookiesBtn.click();
  },
};
