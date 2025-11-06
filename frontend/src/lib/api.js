const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function withTimeout(controller, timeoutMs) {
  if (!timeoutMs) return undefined;
  return setTimeout(() => {
    try { controller.abort(); } catch (_) {}
  }, timeoutMs);
}

async function request(path, { method = "GET", headers = {}, body, timeoutMs, responseType = "json" } = {}) {
  const controller = new AbortController();
  const timeoutId = withTimeout(controller, timeoutMs);
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      let errorText = "";
      try { errorText = await response.text(); } catch (_) {}
      const err = new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      err.status = response.status;
      throw err;
    }

    if (responseType === "blob") {
      return await response.blob();
    }
    if (responseType === "text") {
      return await response.text();
    }
    return await response.json();
  } catch (err) {
    if (controller.signal.aborted) {
      const timeoutErr = new Error("Request timeout");
      timeoutErr.name = "AbortError";
      throw timeoutErr;
    }
    throw err;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function withRetry(fn, { retries = 3, delayMs = 500 } = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt)));
      attempt += 1;
    }
  }
  throw lastErr;
}

export function apiGetJson(path, { headers = {}, timeoutMs } = {}) {
  return withRetry(() => request(path, { method: "GET", headers, timeoutMs, responseType: "json" }), { retries: 3, delayMs: 500 });
}

export function apiGetBlob(path, { headers = {}, timeoutMs } = {}) {
  return withRetry(() => request(path, { method: "GET", headers, timeoutMs, responseType: "blob" }), { retries: 3, delayMs: 500 });
}

export function apiPostFormJson(path, formData, { headers = {}, timeoutMs } = {}) {
  const mergedHeaders = { ...headers };
  return request(path, { method: "POST", headers: mergedHeaders, body: formData, timeoutMs, responseType: "json" });
}

export function apiDeleteJson(path, { headers = {}, timeoutMs } = {}) {
  return request(path, { method: "DELETE", headers, timeoutMs, responseType: "json" });
}

export async function extractSlider(events, sessionId) {
  const formData = new FormData();
  formData.append("events", JSON.stringify(events));
  
  return withRetry(() => request("/extract_slider", { 
    method: "POST", 
    headers: { 'X-Session-Id': sessionId },
    body: formData,
    timeoutMs: 900000 // 15 minutes timeout
  }), { retries: 3, delayMs: 500 });
}

export { API_BASE };


