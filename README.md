# Tomorrow Dashboard AFK

Small Node.js client for sending Tomorrow School dashboard tracking requests.

## Requirements

- Node.js 18 or newer
- Access to the Tomorrow School dashboard in your browser
- Your dashboard session cookie

## Setup

Open `dashboard.cjs` and find the `CONFIG` block near the top:

```js
const CONFIG = {
  dashboardBaseUrl: "https://dashboard.tomorrow-school.ai",
  localPairInfoUrl: "http://127.0.0.1:47836/pair-info",

  cookie: "tmr_session=6rsDg....U",
};
```

You have to copy and paste your cookie into the config:

```js
cookie: "tmr_session=YOUR_COOKIE_VALUE_HERE",
```

Keep the cookie private. It works like a login session.

## How To Get The Cookie

1. Open [https://dashboard.tomorrow-school.ai](https://dashboard.tomorrow-school.ai) and log in.
2. Open browser developer tools.
3. Go to the `Network` tab.
4. Refresh the dashboard page.
5. Click a dashboard request, for example `/api/v1/auth/me`.
6. In the request headers, find `Cookie`.
7. Copy the full cookie value.
8. Paste it into `dashboard.cjs` in the `CONFIG.cookie` field.

There is also a screenshot in this repo: `how-to-get-cookie.png`.

## How To Run

Show account and connection information:

```sh
node dashboard.cjs --info
```

Start tracking and keep sending heartbeats:

```sh
node dashboard.cjs --start
```

Send heartbeat requests without starting tracking first:

```sh
node dashboard.cjs --heartbeat
```

Before using `--heartbeat`, configure these values in `dashboard.cjs`:

```js
deviceId: "",
deviceName: "",
fingerprint: "",
```

Get them from the browser:

1. Open the dashboard and open browser developer tools.
2. Go to the `Network` tab.
3. Find a request to `/api/v1/tracking/heartbeat`.
4. Open the request payload JSON.
5. Copy `deviceId`, `deviceName`, and `fingerprint`.
6. Paste those values into the `CONFIG` block in `dashboard.cjs`.

Stop tracking:

```sh
node dashboard.cjs --stop
```

When `--start` or `--heartbeat` is running, press `Ctrl+C` to stop the process.
