# Apple Web Login Design

## Goal

Add Sign in with Apple to the mAiity web application while preserving the
existing email/password login and using the same server-side users and
sessions as the native iOS application.

## Apple Configuration

- Create a Sign in with Apple Services ID named `de.aiity.maps.web`.
- Associate it with the existing primary App ID for `de.aiity.maps`.
- Register `maps.aiity.de` as the web domain.
- Register `https://maps.aiity.de/maps/api/auth/apple/callback` as the return
  URL.
- Add `de.aiity.maps.web` to the backend's accepted Apple audiences alongside
  `de.aiity.maps`.

## Authentication Flow

1. The login dialog opens Apple's authorization endpoint in the current
   browser.
2. Apple posts the authorization response to the backend callback.
3. The backend validates `state`, exchanges the authorization code with Apple,
   and verifies the returned identity token using Apple's JWKS.
4. The existing social-user upsert merges by Apple subject first and verified
   email second, so native and web logins resolve to one mAiity user.
5. The backend creates the existing refresh-token session, sets the secure
   HTTP-only web cookie, and redirects to a short frontend completion route.
6. The frontend receives the short-lived access token through the URL fragment,
   removes the fragment immediately, refreshes application state, and closes
   the login dialog.

## Security

- Apple client secrets are generated and used only by the backend.
- OAuth state is random, short-lived, single-use, and stored in an HTTP-only
  SameSite cookie.
- The callback accepts only Apple's form-post response.
- Return destinations are fixed to the mAiity maps origin; no arbitrary
  redirect is accepted.
- Existing JWT, refresh-token rotation, and logout behavior remain unchanged.

## Web UI

- Add Apple's official black or white Sign in with Apple button above a
  separator in the existing authentication dialog.
- Keep email/password login and registration available.
- Show a localized, readable error if Apple authentication is cancelled,
  unavailable, or rejected.
- Preserve the existing responsive dialog and design tokens.

## Failure Handling

- Missing Apple server configuration returns `apple_not_configured`.
- Invalid or replayed state returns `invalid_oauth_state`.
- Apple token exchange or identity verification failure redirects to the web
  app with a non-sensitive error code.
- Failed Apple login does not alter the current application session.

## Verification

- Backend tests cover start redirects, state validation, callback token
  exchange, account merging, and session issuance.
- Web tests cover button rendering and completion/error handling.
- Run server tests, web typecheck/build, deploy both services, and complete one
  real browser login against `maps.aiity.de`.
