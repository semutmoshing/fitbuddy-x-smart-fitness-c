import { safeErr } from "./safeErr.js";

function trimSlash(u) {
  u = String(u || "");
  while (u.endsWith("/")) u = u.slice(0, -1);
  return u;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, clear: () => clearTimeout(t) };
}

function pickTimeout(cfg) {
  const v = Number(cfg?.AI_TIMEOUT_MS || 600000);
  return Number.isFinite(v) && v > 0 ? v : 600000;
}

function pickModel(cfg, override) {
  const m = String(override || cfg?.AI_MODEL || "").trim();
  return m || undefined;
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function redact(s) {
  s = String(s || "");
  if (s.length <= 400) return s;
  return s.slice(0, 400) + "…";
}

function notConfigured(message) {
  return { ok: false, status: 412, json: null, error: message };
}

async function readJsonSafe(r) {
  const text = await r.text();
  try {
    return { text, json: JSON.parse(text) };
  } catch {
    return { text, json: null };
  }
}

export async function aiChat(cfg, { messages, model, meta } = {}, opts = {}) {
  const base = trimSlash(cfg?.COOKMYBOTS_AI_ENDPOINT || "");
  const key = String(cfg?.COOKMYBOTS_AI_KEY || "");

  if (!base || !key) return notConfigured("AI_NOT_CONFIGURED");

  const timeoutMs = Number(opts.timeoutMs || pickTimeout(cfg));
  const retries = Number.isFinite(opts.retries) ? Number(opts.retries) : Number(cfg?.AI_MAX_RETRIES || 2);

  const url = base + "/chat";
  const started = Date.now();

  console.log("[ai] chat start", { url: base, hasKey: !!key, meta: meta || {} });

  let attempt = 0;
  while (true) {
    attempt++;
    const { ctrl, clear } = withTimeout(timeoutMs);
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ messages, model: pickModel(cfg, model), meta: meta || undefined }),
        signal: ctrl.signal
      });

      const { text, json } = await readJsonSafe(r);
      if (!r.ok) {
        const err = json?.error || json?.message || text || "AI_ERROR";
        console.warn("[ai] chat fail", { status: r.status, attempt, ms: Date.now() - started, err: redact(err) });
        if (attempt <= retries && isRetryableStatus(r.status)) {
          await sleep(600 * attempt);
          continue;
        }
        return { ok: false, status: r.status, json, error: String(err) };
      }

      console.log("[ai] chat ok", { status: r.status, attempt, ms: Date.now() - started });
      return { ok: true, status: r.status, json, error: null };
    } catch (e) {
      const err = safeErr(e);
      const status = e?.name === "AbortError" ? 408 : 0;
      console.warn("[ai] chat exception", { status, attempt, ms: Date.now() - started, err: redact(err) });
      if (attempt <= retries) {
        await sleep(600 * attempt);
        continue;
      }
      return { ok: false, status, json: null, error: String(err) };
    } finally {
      clear();
    }
  }
}
