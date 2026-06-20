#!/usr/bin/env node

"use strict";

const crypto = require("node:crypto");

/**
 * Tomorrow School dashboard test client.
 *
 * Commands:
 *   node dashboard-admin-diagnostics.cjs --info
 *   node dashboard-admin-diagnostics.cjs --start
 *   node dashboard-admin-diagnostics.cjs --heartbeat
 *   node dashboard-admin-diagnostics.cjs --stop
 *
 * --start starts tracking and keeps sending heartbeat requests.
 * Stop it with Ctrl+C, or run --stop from another terminal.
 */

const CONFIG = {
  dashboardBaseUrl: "https://dashboard.tomorrow-school.ai",
  localPairInfoUrl: "http://127.0.0.1:47836/pair-info",

  cookie: "tmr_session=6rsDg....U",

  machineId: "",
  deviceId: "",
  deviceName: "",
  fingerprint: "",

  heartbeatEveryMs: 60_000,
};

const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0";

const STATE = {
  authMe: null,
  csrfToken: "",
  deviceId: crypto.randomUUID(),
  fingerprint: crypto.randomBytes(32).toString("hex"),
};

const API = {
  agentPair: "/api/v1/agent/pair",
  trackingStart: "/api/v1/tracking/start",
  trackingHeartbeat: "/api/v1/tracking/heartbeat",
  trackingStop: "/api/v1/tracking/stop",
  authMe: "/api/v1/auth/me",
  leaveRequests: "/api/v1/leave-requests",
};

function usage() {
  console.log("Usage:");
  console.log("  node dashboard-admin-diagnostics.cjs --info");
  console.log("  node dashboard-admin-diagnostics.cjs --start");
  console.log("  node dashboard-admin-diagnostics.cjs --heartbeat");
  console.log("  node dashboard-admin-diagnostics.cjs --stop");
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function nowIso() {
  return new Date().toISOString();
}

function generateDeviceName() {
  return `MacIntel · ${USER_AGENT.slice(0, 48)}`;
}

function buildDevicePayload() {
  return {
    deviceId: cleanText(CONFIG.deviceId) || STATE.deviceId,
    deviceName: cleanText(CONFIG.deviceName) || generateDeviceName(),
    fingerprint: cleanText(CONFIG.fingerprint) || STATE.fingerprint,
  };
}

function dashboardUrl(path) {
  return `${CONFIG.dashboardBaseUrl}${path}`;
}

function dashboardHeaders(extraHeaders = {}) {
  const headers = {
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    Prefer: "safe",
    Origin: CONFIG.dashboardBaseUrl,
    Referer: `${CONFIG.dashboardBaseUrl}/`,
    "User-Agent": USER_AGENT,
    Cookie: CONFIG.cookie,
    ...extraHeaders,
  };

  if (STATE.csrfToken) {
    headers["x-csrf-token"] = STATE.csrfToken;
  }

  return headers;
}

async function readResponse(response) {
  const text = await response.text();

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    body,
  };
}

async function getLocalPairInfo() {
  const response = await fetch(CONFIG.localPairInfoUrl, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      Prefer: "safe",
    },
  });

  return readResponse(response);
}

async function getDashboard(path) {
  const response = await fetch(dashboardUrl(path), {
    method: "GET",
    headers: dashboardHeaders(),
  });

  return readResponse(response);
}

function findCsrfToken(value) {
  if (!value || typeof value !== "object") return "";

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.toLowerCase();
    if (
      typeof item === "string" &&
      (normalizedKey === "csrftoken" || normalizedKey === "csrf_token")
    ) {
      return item;
    }

    const nestedToken = findCsrfToken(item);
    if (nestedToken) return nestedToken;
  }

  return "";
}

async function loadAuthMe() {
  const result = await getDashboard(API.authMe);
  STATE.authMe = result;

  const csrfToken = findCsrfToken(result.body);
  if (csrfToken) {
    STATE.csrfToken = csrfToken;
  }

  return result;
}

async function ensureCsrfToken() {
  if (!STATE.csrfToken) {
    await loadAuthMe();
  }
}

async function postDashboard(path, body = {}) {
  await ensureCsrfToken();

  const response = await fetch(dashboardUrl(path), {
    method: "POST",
    headers: dashboardHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(body),
  });

  return readResponse(response);
}

function printResult(label, result) {
  console.log(`\n${label}`);

  if (!result) {
    console.log("FAILED");
    return;
  }

  console.log(`${result.status} ${result.statusText}`);
  console.log(JSON.stringify(result.body, null, 2));
}

async function tryRequest(label, request) {
  try {
    const result = await request();
    printResult(label, result);
    return result;
  } catch (error) {
    console.log(`\n${label}`);
    console.log("FAILED");
    console.log(error.message);
    return null;
  }
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function randomMachineId() {
  return crypto.randomBytes(6).toString("hex").toUpperCase();
}

function resolveMachineId(pairInfoResult) {
  const configuredMachineId = cleanText(CONFIG.machineId);
  const pairInfoMachineId = cleanText(pairInfoResult?.body?.machineId);

  return configuredMachineId || pairInfoMachineId || randomMachineId();
}

function heartbeatBody() {
  return {
    ...buildDevicePayload(),
    idle: false,
  };
}

async function pairMachine() {
  const pairInfo = await tryRequest("Local agent pair-info", getLocalPairInfo);
  const machineId = resolveMachineId(pairInfo);

  console.log("\nResolved machineId");
  console.log(machineId);

  await tryRequest("Pair account with machine", () =>
    postDashboard(API.agentPair, { machineId }),
  );
}

async function showBasicInformation() {
  console.log("Tomorrow School dashboard test client");
  console.log(`Dashboard: ${CONFIG.dashboardBaseUrl}`);
  console.log(`Local agent: ${CONFIG.localPairInfoUrl}`);
  console.log(`Heartbeat interval: ${CONFIG.heartbeatEveryMs / 1000}s`);
  console.log(`Configured machineId: ${cleanText(CONFIG.machineId) || "(auto)"}`);
  console.log("Device payload:");
  console.log(JSON.stringify(buildDevicePayload(), null, 2));

  await tryRequest("Local agent pair-info", getLocalPairInfo);
  await tryRequest("Current authenticated user", loadAuthMe);
  console.log(`CSRF token loaded: ${STATE.csrfToken ? "yes" : "no"}`);
  await tryRequest("Leave requests", () => getDashboard(API.leaveRequests));
}

async function sendHeartbeat() {
  const result = await postDashboard(API.trackingHeartbeat, heartbeatBody());
  const status = `${result.status} ${result.statusText}`;
  console.log(`[${nowIso()}] heartbeat -> ${status}`);

  if (result.body) {
    console.log(JSON.stringify(result.body, null, 2));
  }

  return result;
}

async function runHeartbeatLoop() {
  await sendHeartbeat();

  console.log(`\nHeartbeat running every ${CONFIG.heartbeatEveryMs / 1000}s.`);
  console.log("Press Ctrl+C to stop this process.");

  setInterval(() => {
    sendHeartbeat().catch((error) => {
      console.log(`[${nowIso()}] heartbeat -> FAILED`);
      console.log(error.message);
    });
  }, CONFIG.heartbeatEveryMs);
}

async function startTrackingWithHeartbeat() {
  await pairMachine();

  await tryRequest("Start tracking", () =>
    postDashboard(API.trackingStart, buildDevicePayload()),
  );

  await runHeartbeatLoop();
}

async function stopTracking() {
  await tryRequest("Stop tracking", () =>
    postDashboard(API.trackingStop),
  );
}

async function main() {
  if (hasFlag("--info")) {
    await showBasicInformation();
    return;
  }

  if (hasFlag("--start")) {
    await startTrackingWithHeartbeat();
    return;
  }

  if (hasFlag("--heartbeat")) {
    await runHeartbeatLoop();
    return;
  }

  if (hasFlag("--stop")) {
    await stopTracking();
    return;
  }

  usage();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
