# Precision Mobile

Mobile web app (PWA) for Precision Drilling rig crews. On a phone, a user signs in with Auth0, picks a
rig, and then can:

- **Alerts**: see the rig's smart alerts and acknowledge them, and get them as push notifications.
- **Logbook**: add a mud pump logbook entry (Inspection, Repair or Dampener pre-charge).
- **History**: browse the logbook entries of the last 14 days.
- **Settings**: switch rigs, change light/dark mode, sign out.

Built with React 19 on Create React App (`react-scripts` 5). There is no router and no state library:
`App.js` switches tabs, and shared state lives in small modules with React hooks.

---

## Contents

1. [Quick start](#quick-start)
2. [Scripts](#scripts)
3. [Configuration](#configuration)
4. [Project layout](#project-layout)
5. [How the app works](#how-the-app-works)
6. [Backend APIs](#backend-apis)
7. [What the app keeps in the browser](#what-the-app-keeps-in-the-browser)
8. [Testing](#testing)
9. [Code conventions](#code-conventions)
10. [Build and deploy](#build-and-deploy)
11. [Troubleshooting](#troubleshooting)

---

## Quick start

Requirements: Node.js 18 or newer and npm.

```bash
npm install
# Create .env.local (git-ignored) with your settings; see "Configuration" below
npm start
```

The app opens on **http://localhost:3001** (`PORT` is set in `.env`).

To try the screens without an Auth0 account, add this to `.env.local`. It works under `npm start` only:

```bash
REACT_APP_AUTH_BYPASS=true
```

Sign-in is then skipped, and you get a test user with access to every rig.

---

## Scripts

| Command                                           | What it does                                                                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm start`                                       | Development server on port 3001. Runs [scripts/start.js](scripts/start.js), which hides three known react-scripts deprecation warnings |
| `npm test`                                        | Jest in watch mode                                                                                                                     |
| `CI=true npx react-scripts test --watchAll=false` | All tests once (as in CI)                                                                                                              |
| `npm run build`                                   | Production build in `build/`                                                                                                           |
| `npm run serve`                                   | Serves `build/` on port 3001 with the production headers from [public/serve.json](public/serve.json)                                   |
| `npm run format` / `npm run format:check`         | Prettier: format, or check formatting                                                                                                  |
| `npx eslint src --max-warnings=0`                 | Lint (CRA ESLint rules + Testing Library rules)                                                                                        |

---

## Configuration

Settings come from environment files that are read **at build time**:

| File               | In git | Purpose                                                              |
| ------------------ | ------ | -------------------------------------------------------------------- |
| `.env`             | yes    | Shared defaults (`PORT=3001`)                                        |
| `.env.development` | yes    | `npm start` only (source map settings)                               |
| `.env.production`  | yes    | `npm run build` only (no source maps, no inline scripts for the CSP) |
| `.env.local`       | **no** | Your own values and keys. Never commit it                            |

> Every `REACT_APP_*` value is built into the JavaScript bundle and visible to anyone using the app.
> Never put a real secret in one.

### Variables

| Variable                                                            | Needed | Meaning                                                                                       |
| ------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `REACT_APP_AUTH0_DOMAIN`                                            | no     | Auth0 tenant. Default `prescient-pd.us.auth0.com`                                             |
| `REACT_APP_AUTH0_CLIENT_ID`                                         | no     | Auth0 SPA client id. A default is set in [authConfig.js](src/auth/authConfig.js)              |
| `REACT_APP_AUTH0_AUDIENCE`                                          | no     | API audience. Default `https://precision-designers.prescientdevices.com`                      |
| `REACT_APP_AUTH_BYPASS`                                             | no     | `true` skips sign-in. **Development only**; production builds ignore it                       |
| `REACT_APP_DIGITAL_TWIN_ID`                                         | yes    | Digital twin id sent with logbook and alert calls                                             |
| `REACT_APP_USER_TOKEN`                                              | yes    | Legacy user token sent with logbook and alert calls                                           |
| `REACT_APP_USER_LOGIN`, `REACT_APP_USER_ID`, `REACT_APP_USER_EMAIL` | dev    | Fallback user details for new logbook entries when the token lacks them                       |
| `REACT_APP_LOGBOOK_BASE_URL`                                        | no     | Logbook / rig / push Designer. Default `/rwhitney-pc1f13f` (same origin)                      |
| `REACT_APP_RULE_ENGINE_BASE_URL`                                    | no     | Smart alert Designer. Default `/precisionRuleEngine-p64c1a8`                                  |
| `REACT_APP_LOGBOOK_AUTH_KEY`, `REACT_APP_RULE_ENGINE_AUTH_KEY`      | dev    | Legacy `authentication` header. **Development only**; production uses the Auth0 token         |
| `REACT_APP_RIGS`                                                    | no     | Rigs offered in Switch Rigs when the user's token has access to every rig, e.g. `001,575,875` |
| `REACT_APP_MUD_PUMPS`                                               | no     | Mud pumps used by the **History** tab only, e.g. `1,2,3`. The Logbook gets pumps from the API |
| `REACT_APP_VERSION`                                                 | no     | Version shown in Settings. Default `0.1.0`                                                    |
| `DESIGNER_PROXY_TARGET`                                             | no     | Where `npm start` forwards Designer calls. Default `https://designer3.prescientdevices.com`   |

All settings are read in [src/config/appConfig.js](src/config/appConfig.js) and
[src/auth/authConfig.js](src/auth/authConfig.js). `REACT_APP_API_DOMAIN` in `.env` is not used by the code.

---

## Project layout

### At a glance

```text
my-legacy-app/
├── public/              Static files served as-is: page shell, service worker, PWA manifest, headers
├── scripts/             npm start wrapper
├── docs/                Specs from the backend team (push alarm contract)
└── src/
    ├── App.js           Sign-in gate → rig gate → tabs
    ├── api/             One module per backend service
    ├── auth/            Auth0 sign-in, session, sign-out
    ├── config/          App settings and the active rig
    ├── notification/    Firebase push registration
    └── components/      Screens and shared UI, one folder each
```

> **Where data comes from:** screens read data through hooks and `api/` modules. The `api/` modules
> take settings from `config/` and the login token from `auth/`. The one exception is
> `Logbook/useBrandLists.js`, which still calls `fetch` itself.

### App shell — `src/`

| File                                                                               | Purpose                                                                 |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [index.js](src/index.js)                                                           | Entry point: loads the Roboto font and global CSS, renders `<App />`    |
| [App.js](src/App.js)                                                               | Sign-in gate, rig gate, tab switching, bottom navigation, push start-up |
| [index.css](src/index.css) · [theme.css](src/theme.css) · [theme.js](src/theme.js) | Global styles, light/dark colour tokens, theme switch                   |
| [setupTests.js](src/setupTests.js)                                                 | Jest setup: mocks Auth0 so every test runs signed in                    |
| [setupProxy.js](src/setupProxy.js)                                                 | `npm start` only: forwards Designer paths to the Designer host          |

### Backend calls — `src/api/`

| File                                           | Purpose                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| [designerFetch.js](src/api/designerFetch.js)   | **Every call goes through here.** Adds the Auth0 Bearer token; retries once after a 401 |
| [rigApi.js](src/api/rigApi.js)                 | Rigs by country, rig layout (pumps and other equipment)                                 |
| [rigLayoutCache.js](src/api/rigLayoutCache.js) | Rig layouts cached in localStorage, refreshed in the background                         |
| [logbookApi.js](src/api/logbookApi.js)         | Pump logbook: read and create entries                                                   |
| [smartAlertApi.js](src/api/smartAlertApi.js)   | Smart alerts: list and acknowledge                                                      |
| [pushTokenApi.js](src/api/pushTokenApi.js)     | Push device registration: GET / PUT / DELETE                                            |

### Sign-in — `src/auth/`

| File                                                | Purpose                                                                     |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| [auth.js](src/auth/auth.js)                         | Auth0 client, session, `getToken()`, `signIn()` / `signOut()`, `canWrite()` |
| [AuthProvider.js](src/auth/AuthProvider.js)         | React context with the session state; runs the sign-out flow                |
| [authConfig.js](src/auth/authConfig.js)             | Auth0 domain, client id, audience                                           |
| [clearBrowserData.js](src/auth/clearBrowserData.js) | Clears storage and cookies on sign-out (keeps the push device id)           |

### Settings and state — `src/config/` · `src/notification/`

| File                                                        | Purpose                                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [appConfig.js](src/config/appConfig.js)                     | Every `REACT_APP_*` setting in one frozen object                                   |
| [activeRig.js](src/config/activeRig.js)                     | The active rig, the rigs the user may pick, `useActiveRig()`, `useAvailableRigs()` |
| [firebase.js](src/notification/firebase.js)                 | Firebase project, Web Push key, service worker registration                        |
| [pushRegistration.js](src/notification/pushRegistration.js) | Device id, "registered" flag, register / unregister flow                           |

### Screens — `src/components/`

| Folder                                          | Tab / screen    | Main files                                                                                                                                                                                                                                                                             |
| ----------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Notifications/](src/components/Notifications/) | **Alerts**      | `Notifications.js` page · `useSmartAlerts.js` loads alerts · `notificationsData.js` maps API data                                                                                                                                                                                      |
| [Logbook/](src/components/Logbook/)             | **Logbook**     | `Logbook.js` steps · `useRigLayout.js` mud pumps · `logbookConfig.js` purposes and fields · `repairRules.js` Repair show/hide and checks · `logbookOptions.js` option lists · `LogbookField.js` · `ComponentSelector.js` · `OptionPicker.js` · `LogbookReview.js` · `useBrandLists.js` |
| [History/](src/components/History/)             | **History**     | `History.js` page · `useLogbookHistory.js` loads 14 days · `historyData.js` maps API data                                                                                                                                                                                              |
| [More/](src/components/More/)                   | **Settings**    | `More.js` page · `RigPicker.js` rig tiles with search · `RigSetup.js` first-time rig page                                                                                                                                                                                              |
| [Login/](src/components/Login/)                 | Before the app  | `Login.js` "Signing in…" · `NoRigAccess.js` "Rig Access Restricted"                                                                                                                                                                                                                    |
| [PushPrompt/](src/components/PushPrompt/)       | Alerts tab card | "Get alarms on this device" with Turn on / Not now                                                                                                                                                                                                                                     |

### Shared UI — `src/components/`

| Folder                                          | Used for                                            |
| ----------------------------------------------- | --------------------------------------------------- |
| [BottomNav/](src/components/BottomNav/)         | Tab bar: Alerts, Logbook, History, Settings         |
| [MobileHeader/](src/components/MobileHeader/)   | Page header with an optional Back button and action |
| [BottomSheet/](src/components/BottomSheet/)     | Sliding sheet on phones, centred dialog on tablets  |
| [ConfirmDialog/](src/components/ConfirmDialog/) | "Are you sure?" dialog (e.g. Logout)                |
| [SkeletonCard/](src/components/SkeletonCard/)   | Loading placeholders                                |
| [Icon/](src/components/Icon/)                   | All SVG icons, by name: `<Icon name="bell" />`      |

### Static files — `public/` · `scripts/` · `docs/`

| File                                                                                   | Purpose                                                                           |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [public/index.html](public/index.html)                                                 | Page shell; loads `boot.js` before the app                                        |
| [public/boot.js](public/boot.js)                                                       | Applies the saved dark theme before first paint (a file, not inline, for the CSP) |
| [public/firebase-messaging-sw.js](public/firebase-messaging-sw.js)                     | Push service worker: shows alarms while the app is closed                         |
| [public/manifest.json](public/manifest.json)                                           | PWA manifest; `"display": "standalone"` is needed for iPhone push                 |
| [public/serve.json](public/serve.json)                                                 | Production headers: Content-Security-Policy, caching, rewrites                    |
| [scripts/start.js](scripts/start.js)                                                   | `npm start` wrapper that hides three known react-scripts warnings                 |
| [docs/firebase-push-notifications/SKILL.md](docs/firebase-push-notifications/SKILL.md) | Push alarm contract with the server                                               |

> **Convention:** each component folder holds its `.js`, its `.css` and, where present, its `.test.js`
> side by side.

---

## How the app works

### Start-up and sign-in

On start, [AuthProvider](src/auth/AuthProvider.js) restores the Auth0 session and checks the saved rig.
Then [App.js](src/App.js) shows one of:

| Situation     | Screen                      |
| ------------- | --------------------------- |
| Not signed in | Auth0 login page (redirect) |
| No rig access | Rig Access Restricted       |
| No rig picked | Select Rig                  |
| Ready         | The app (tabs)              |

Call `getToken()` (or use `designerFetch()`) for every API call; never store the token. Users without
`write:digital_twin` are read-only. Sign-in needs HTTPS or `localhost`.

### Which rigs a user may pick

The Auth0 access token has a `rig_access` claim. [activeRig.js](src/config/activeRig.js) reads it:

| `rig_access`                             | Rigs offered                                              |
| ---------------------------------------- | --------------------------------------------------------- |
| missing, or `all: true`                  | `REACT_APP_RIGS`                                          |
| `rigs: [575, 875]`                       | exactly those rigs                                        |
| `rigs: []` and `countries: ["US", "CA"]` | `GET /rigs/bycountry` for each country, merged and sorted |
| no rigs and no countries                 | none: the "Rig Access Restricted" page                    |

- With exactly one rig, it's picked automatically.
- A saved rig the user can no longer see is dropped, so they pick again.
- The active rig is saved in localStorage (`activeRig`).
- Every API call reads it through `getActiveRig()`, and components use `useActiveRig()`, which
  re-renders when the rig changes.

### Tabs

| Tab              | Component                                                      | What it does                                                                                                                               |
| ---------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Alerts (default) | [Notifications](src/components/Notifications/Notifications.js) | Unacknowledged and acknowledged smart alerts with filters (All, Unacknowledged, Critical, Warning), Acknowledge, and the push prompt card  |
| Logbook          | [Logbook](src/components/Logbook/Logbook.js)                   | 4 steps: start (pump, date, purpose) → form → review → result                                                                              |
| History          | [History](src/components/History/History.js)                   | Entries of the last 14 days for every pump in `REACT_APP_MUD_PUMPS`. **Delete only hides the entry on screen**: there is no delete API yet |
| Settings         | [More](src/components/More/More.js)                            | Active rig, Switch Rigs (with search), light/dark mode, signed-in user, Logout                                                             |

Tapping a tab again resets that page to its first view: `App.js` remounts it with a new `key`.

### Logbook entry

1. **Start step:** the mud pumps come from the rig layout (`GET /rig/layout`, `pumps.ids`).
   - The layout is cached in localStorage per rig, so the pumps show at once. The cache refreshes in
     the background, and `App.js` pre-fetches it after sign-in and on every rig switch.
   - A rig without pumps shows a message and keeps **Next** disabled.
   - On a network error the cached pumps stay. On 403 or 404 the cache is dropped and the error is
     shown.
2. **Form:**
   - Inspection and Dampener have fixed fields, defined in [logbookConfig.js](src/components/Logbook/logbookConfig.js).
   - Repair fields show and hide by rule ([repairRules.js](src/components/Logbook/repairRules.js)).
     For example, liner hours appear only when liners are re-used.
   - Missing required fields are listed in a bar above the button.
3. **Review**, then **Submit**: `createLogbookEntry()`. Only HTTP 200 means saved; the service
   reports validation errors with other 2xx/3xx codes and a text message, which the result screen
   shows.

### Push alarms

The server sends every alarm. The app only registers the device. Full contract:
[docs/firebase-push-notifications/SKILL.md](docs/firebase-push-notifications/SKILL.md).

```text
After sign-in and at every app start (App.js -> syncPushRegistration):
  notifications not allowed yet           -> nothing (the Alerts tab shows "Turn on")
  "pushRegistration" flag matches         -> nothing, no request
  token changed                           -> PUT /push/tokens/{deviceId}
  no flag (first sign-in on this device)  -> GET; if 404 -> PUT; then save the flag
  PUT answers 409                         -> new device id, PUT once more

Logout (AuthProvider -> unregisterPushDevice, before Auth0 sign-out):
  DELETE /push/tokens/{deviceId}, remove the flag (never blocks logout; at most 4 s)
```

- **Device id:** random (UUID), made once per device, saved as `pushDeviceId`, and **kept across
  sign-out**.
- **Permission:** the browser asks only from a tap (iPhone refuses otherwise). That's why the
  [PushPrompt](src/components/PushPrompt/PushPrompt.js) card has a **Turn on** button.
- **iPhone:** push works only on iOS 16.4+ with the app added to the home screen and opened from
  there. In Safari, the card shows those steps instead.
- **Open app:** foreground messages are shown by `onMessage` in `App.js`. With the app closed, the
  service worker shows them, and tapping one opens the app.
- **Firebase project:** `precision-mobile-push`, set in [firebase.js](src/notification/firebase.js) and
  [firebase-messaging-sw.js](public/firebase-messaging-sw.js). **Keep the two in sync.**

### Sign-out

Settings → Logout → confirm dialog, then:

1. `DELETE` the push device.
2. Clear localStorage (except `pushDeviceId`), sessionStorage and the cookies JavaScript can see
   ([clearBrowserData.js](src/auth/clearBrowserData.js)).
3. Auth0 logout, which leaves the app.

The next sign-in starts in light mode and asks for a rig again.

### Theme

- **Tokens:** colours are CSS variables in [theme.css](src/theme.css); `<html data-theme="dark">`
  switches them.
- **Saving:** [theme.js](src/theme.js) saves the choice, and [boot.js](public/boot.js) applies it
  before first paint, so there is no light flash.
- **Font:** Roboto, self-hosted through `@fontsource-variable/roboto`, because the CSP allows fonts
  from the app's own origin only.

---

## Backend APIs

All calls go to "Designer" services **on the app's own host**, so the browser needs no CORS:

- In production, the load balancer forwards these paths.
- Under `npm start`, [setupProxy.js](src/setupProxy.js) does.

Every call sends `Authorization: Bearer <Auth0 access token>` through
[designerFetch.js](src/api/designerFetch.js). A 401 gets a new token and is tried once more. A 403
means the user has no access to that rig.

| Module             | Method and path                                                           | Purpose                                                                                      |
| ------------------ | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `rigApi.js`        | `GET /rwhitney-pc1f13f/api/private/rigs/bycountry?country=US`             | User's rigs in a country (`US`, `CA`, `ME`, `AR`)                                            |
| `rigApi.js`        | `GET /rwhitney-pc1f13f/api/private/rig/layout?rig=575`                    | Rig equipment: pumps, gensets, top drive, units… (503 is retried twice)                      |
| `logbookApi.js`    | `GET /rwhitney-pc1f13f/api/private/pump/logbook?…&from&to`                | Logbook entries of one pump (range of 14 days at most)                                       |
| `logbookApi.js`    | `POST /rwhitney-pc1f13f/api/private/pump/logbook?…`                       | New logbook entry                                                                            |
| `smartAlertApi.js` | `GET / POST /precisionRuleEngine-p64c1a8/api/private/rig/smartAlert/v2`   | List and acknowledge smart alerts                                                            |
| `pushTokenApi.js`  | `GET / PUT / DELETE /rwhitney-pc1f13f/api/private/push/tokens/{deviceId}` | Push device registration                                                                     |
| `useBrandLists.js` | `GET …/api/private/pump/logbook/brandlist`                                | Brand lists for Repair; used only when an API config is passed, otherwise the built-in lists |

- **No trailing `/`:** never end a route with `/`, because the Designers refuse the token on such
  routes.
- **Base paths:** they're listed once, in `DESIGNER_PATHS` in `appConfig.js` and `setupProxy.js`.

**Adding a call:**

1. Put it in the matching `src/api/` module and use `designerFetch()`.
2. Throw the module's `*ApiError` with a message a user can read.
3. Add tests that mock `global.fetch`.

---

## What the app keeps in the browser

| Key                   | Where          | Set by                                    | Cleared on sign-out           |
| --------------------- | -------------- | ----------------------------------------- | ----------------------------- |
| `@@auth0spajs@@::…`   | localStorage   | Auth0 SDK (tokens)                        | yes                           |
| `activeRig`           | localStorage   | `activeRig.js`                            | yes                           |
| `rigLayout:<rig>`     | localStorage   | `rigLayoutCache.js`                       | yes                           |
| `theme`               | localStorage   | `theme.js`                                | yes                           |
| `pushRegistration`    | localStorage   | `pushRegistration.js` ("registered" flag) | yes                           |
| `pushDeviceId`        | localStorage   | `pushRegistration.js`                     | **no**: belongs to the device |
| `pushPromptDismissed` | sessionStorage | `PushPrompt.js` ("Not now")               | yes                           |

---

## Testing

- **Tools:** Jest + React Testing Library (via `react-scripts`). 16 test files, 128 tests.
- **Coverage:** about 93% of lines.

```bash
CI=true npx react-scripts test --watchAll=false            # run once
npx react-scripts test src/components/Logbook               # watch one folder
CI=true npx react-scripts test --watchAll=false --coverage \
  --collectCoverageFrom='src/**/*.js' --collectCoverageFrom='!src/index.js' \
  --collectCoverageFrom='!src/setupTests.js' --collectCoverageFrom='!src/setupProxy.js'
```

Things to know when writing tests:

- **Signed in by default:** [setupTests.js](src/setupTests.js) mocks `src/auth/auth.js`, so every test
  runs as `TEST_USER` with the token `test-access-token`. To test the real module, use
  `jest.requireActual` (see `auth.test.js`).
- **Mocks are reset before every test** (CRA `resetMocks`). Set mock return values in `beforeEach`,
  not in the `jest.mock()` factory.
- **Mock the network with `global.fetch = jest.fn(...)`.** API modules read responses with
  `response.text()` or `response.json()`; give the mock whichever the module uses.
- **jsdom gaps:** jsdom has no Web Crypto, no service worker and no `Notification`. Tests that need
  them define them (see `pushRegistration.test.js`, `firebase.test.js`).
- **Settle async work:** if a step starts async work, wait for it (`findBy…`, `waitFor`) before the
  test ends. Otherwise React prints `act(...)` warnings. The suite runs with no warnings; keep it
  that way.
- **Query by role and name** (`getByRole('button', { name: 'Save' })`). ESLint enforces the Testing
  Library rules.

---

## Code conventions

- **Prettier** ([.prettierrc](.prettierrc)): 120 columns, single quotes, semicolons. Run
  `npm run format` before committing.
- **File header and JSDoc:** every file starts with a header comment
  (`Copyright 2026-present Prescient Devices, Inc.`). Every function has a JSDoc block with
  `@param` / `@returns`.
- **Imports** are grouped under `// npm imports` and `// Prescient Devices imports`. Module-level
  values go under `// Constants`.
- **Exports:** named exports collected at the end of the file (`export { a, b };`). Components use a
  default export.
- **CSS:** one CSS file per component, with class prefixes per area (`lb-` Logbook, `mr-` Settings,
  `nt-` Alerts, `bs-` BottomSheet). Use the colour tokens from `theme.css`, never fixed colours, so
  dark mode works.
- **Accessibility:** real buttons and inputs, labels on every control, `role="alert"` for errors and
  `role="status"` for progress.
- **Browser storage:** always wrap `localStorage` / `sessionStorage` in `try/catch`, because they
  can be unavailable (private mode).

---

## Build and deploy

```bash
npm run build      # build/ ready to deploy
npm run serve      # try the build locally with the production headers
```

- **Headers:** the production server must send the headers in [public/serve.json](public/serve.json):
  - The Content-Security-Policy. When you add a new external host (API, font, script), add it there
    too, or the browser blocks it.
  - `Cache-Control: no-cache` for `index.html`, `boot.js` and `firebase-messaging-sw.js`, so updates
    reach users.
- **Rewrites:** every unknown path must serve `index.html` (single-page app).
- **Paths:** the Designer paths (`/rwhitney-pc1f13f/…`, `/precisionRuleEngine-p64c1a8/…`) must be
  forwarded to the Designer services on the same host.
- **Firebase Hosting:** [firebase.json](firebase.json) and [.firebaserc](.firebaserc) deploy `build/`.
  `.firebaserc` still points to the old `pushnotification-6f823` project; push itself now uses
  `precision-mobile-push`.

---

## Troubleshooting

| Problem                                                              | Cause and fix                                                                                                                           |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| "Sign-in needs HTTPS"                                                | Opened over plain HTTP (e.g. by IP). Use `https://` or `localhost`                                                                      |
| Every page says "You have no access to this rig" (403)               | The user's Auth0 `rig_access` doesn't include the rig. Pick another rig or ask an admin                                                 |
| "Rig Access Restricted" after sign-in                                | The token has no rigs and no countries                                                                                                  |
| Logbook says "There are no mud pumps on rig X"                       | The rig layout has `pumps.present: false`. Check `GET /rig/layout?rig=X`                                                                |
| No "Turn on" card for push                                           | Already allowed or blocked in the browser, or the browser has no web push. On iPhone, open the app from the home screen                 |
| Push alarms never arrive                                             | Check in DevTools → Network for a `PUT /push/tokens/…` with 200/201, and that `firebase.js` and the service worker use the same project |
| `npm start` doesn't reload on file changes (WSL2 on a Windows drive) | Set `WATCHPACK_POLLING=true` (already in `.env`)                                                                                        |
| Designer calls fail under `npm start`                                | Check `DESIGNER_PROXY_TARGET` and that the path is listed in `setupProxy.js`                                                            |
