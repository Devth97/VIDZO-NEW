# Google sign-in through Supabase

VIDZO uses Google as the live sign-in provider and Supabase for sessions and workspace identity. No SMTP service, Firebase, Google Drive access or paid Google API is needed for this flow. Local mode keeps its clearly labelled test links; demo mode has no accounts.

## Account ownership

Use a personal account approved by the owner for the Supabase and Google Cloud projects. Do not create or connect VIDZO infrastructure under an `@prorack.ai` company account. Adding the code does not create a Supabase project or configure an account.

## Set up the accounts

1. Create or select the VIDZO Supabase project. Apply only `supabase/migrations`, never `supabase/local`.
2. In Google Cloud / Google Auth Platform, configure VIDZO's branding, audience, support email, home page, terms and privacy URLs. Use only the standard `openid`, email and profile scopes. For a testing audience, add approved test users; publish the audience before public sign-in.
3. Create an OAuth client of type **Web application**. Set authorized JavaScript origins to the actual app origin (for example `https://vidzo.tech`); include the loopback development origin only when needed.
4. In Supabase **Authentication → Sign In / Providers → Google**, copy the callback URL. Add this exact URL to the Google client's authorized redirect URIs. For hosted Supabase it is `https://<project-ref>.supabase.co/auth/v1/callback`.
5. Put the Google client ID and client secret into that Supabase provider panel and enable Google. Keep the secret out of chat, source code and the app's public environment variables. Leave nonce verification enabled.
6. Set Supabase's Site URL to the actual app origin. Allow the app callback under Redirect URLs, including the `next` query parameter used to resume drafts: for example `https://vidzo.tech/auth/callback?next=/**`. Use the real production host and no broad host wildcard. Add separate localhost/127.0.0.1 callback patterns only for development.
7. Disable the Supabase Email provider if Google is the only intended login method. The live VIDZO email-link endpoint is disabled; its local-only replacement never sends email.

## App configuration

Set these privately in the hosting environment (or an ignored `.env.local` for development):

- `VIDZO_MODE=live`
- `APP_ORIGIN`: the public app origin used above
- `NEXT_PUBLIC_SUPABASE_URL`: the project's Supabase URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the project's publishable key
- `DATABASE_URL`: the server-only Postgres connection for the same project

Google client credentials stay in Supabase; the app does not need another Google secret. Other VIDZO services remain separately configured and disabled until ready.

## Flow and verification

The form requires beta terms acceptance and POSTs to `/api/auth/google`. The server always selects the Google provider and builds the callback from `APP_ORIGIN`, with a sanitized internal `next` path. The Supabase SSR client writes a PKCE verifier cookie and returns the authorization URL. Google redirects through Supabase to `/auth/callback`; that route exchanges the one-time code for Supabase session cookies. Workspace access continues to verify users with `getUser()`; first sign-in creates a private workspace with zero credits.

Canceled or failed sign-in returns to the form with a generic error and preserves the draft path. Provider error descriptions and tokens are not rendered. OAuth initiation and callback responses are not cacheable.

Before declaring the integration live, verify against the configured project:

- New Google user → private workspace, zero credits.
- Existing user → same workspace and saved projects.
- Sign in from a studio URL → return to that draft.
- Cancel Google consent → retryable error, draft path preserved.
- Sign out → protected APIs reject access; signing back in restores access.
- Two Google users cannot read each other's workspace, wallet or media.

Automated route tests use the real Supabase SDK to check provider selection, PKCE generation/cookie storage, callback construction, terms gating, origin protection and external-return-path rejection. They do not prove Google consent or hosted Supabase configuration works. No real Google account or hosted Supabase project was used during implementation.

References: [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [redirect allow lists](https://supabase.com/docs/guides/auth/redirect-urls).
