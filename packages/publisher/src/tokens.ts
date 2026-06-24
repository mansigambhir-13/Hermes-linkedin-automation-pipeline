/**
 * LinkedIn + Meta access-token refresh helpers. LinkedIn access tokens expire ~60d (refresh token ~365d);
 * Meta long-lived tokens are ~60d. Run periodically (cron / weekly) to keep publishing alive — see
 * `packages/publisher/scripts/refresh-tokens.ts` which calls these and updates root .env in place.
 *
 * No fragile 401-retry inside the adapters — keep refresh as an ops concern so failures are visible.
 */

export interface LinkedInRefreshResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
}

/** POST https://www.linkedin.com/oauth/v2/accessToken grant_type=refresh_token. */
export async function refreshLinkedInToken(): Promise<LinkedInRefreshResponse> {
  const refreshToken = process.env.LINKEDIN_REFRESH_TOKEN;
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error('LinkedIn refresh requires LINKEDIN_REFRESH_TOKEN + LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET.');
  }
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`LinkedIn refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as LinkedInRefreshResponse;
}

export interface MetaRefreshResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

/** GET {graph}/oauth/access_token grant_type=fb_exchange_token — exchange a short-lived token for a long-lived ~60d one. */
export async function refreshMetaToken(): Promise<MetaRefreshResponse> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const current = process.env.META_ACCESS_TOKEN;
  if (!appId || !appSecret || !current) {
    throw new Error('Meta refresh requires META_APP_ID + META_APP_SECRET + META_ACCESS_TOKEN.');
  }
  const base = process.env.META_GRAPH_BASE ?? 'https://graph.facebook.com/v25.0';
  const url =
    `${base}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(appId)}` +
    `&client_secret=${encodeURIComponent(appSecret)}` +
    `&fb_exchange_token=${encodeURIComponent(current)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Meta refresh failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as MetaRefreshResponse;
}
