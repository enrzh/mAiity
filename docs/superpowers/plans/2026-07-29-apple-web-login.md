# Apple Web Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure Sign in with Apple to the mAiity website and share accounts with the native app.

**Architecture:** Apple redirects through a backend OAuth callback. The backend owns state validation, code exchange, identity-token verification, account merging, and session cookie issuance; the web client only starts login and resumes the issued session.

**Tech Stack:** Fastify, Bun, jose, React 19, TypeScript, Apple Developer portal.

## Global Constraints

- Services ID: `de.aiity.maps.web`.
- Domain: `maps.aiity.de`.
- Callback: `https://maps.aiity.de/maps/api/auth/apple/callback`.
- Preserve email/password authentication and native Apple login.
- Never expose the Apple private key or client secret to the browser.

---

### Task 1: Backend OAuth flow

**Files:**
- Modify: `server/src/social.ts`
- Modify: `server/src/server.ts`
- Modify: `server/src/index.ts`
- Test: `server/test/api.test.ts`

**Interfaces:**
- Produces: `GET /auth/apple/start` and `POST /auth/apple/callback`.
- Consumes: existing `SocialVerifier`, `makeSessionIssuer`, and user upsert.

- [ ] Write failing tests for redirect parameters, one-time state validation, callback rejection, account merge, and web cookie issuance.
- [ ] Run `cd server && bun test` and confirm the new tests fail.
- [ ] Add server-only Apple OAuth configuration, signed client-secret generation, state cookie handling, code exchange, and callback session issuance.
- [ ] Run `cd server && bun test` and confirm all tests pass.

### Task 2: Web login integration

**Files:**
- Modify: `web/src/components/AuthModal.tsx`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/state.tsx`
- Modify: `web/src/lib/i18n.ts`
- Test: existing web test suite or a focused auth regression test.

**Interfaces:**
- Consumes: `GET /maps/api/auth/apple/start` and the existing refresh-cookie session.
- Produces: official Apple login action and localized OAuth errors.

- [ ] Add a failing regression test for Apple button rendering and callback completion.
- [ ] Add the Apple button, OAuth start navigation, completion handling, and localized errors.
- [ ] Run web typecheck/tests/build and confirm they pass.

### Task 3: Apple portal and deployment

**Files:**
- Modify: deployment environment only; no secrets committed.

**Interfaces:**
- Configures: Services ID `de.aiity.maps.web`, primary App ID association, domain, callback, and backend environment.

- [ ] Create and configure the Services ID in Apple Developer.
- [ ] Add the web audience and Apple key configuration to the NAS runtime environment.
- [ ] Build and restart the maps API and web services.
- [ ] Verify API health, web rendering, Apple redirect parameters, successful real login, and shared account identity.
- [ ] Commit and push source changes.
