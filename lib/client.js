/**
 * Tiny fetch wrapper for our own API: JSON in, JSON out, and a thrown Error
 * carrying the server's message when something goes wrong.
 */
export async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* non-JSON response (e.g. a 502 page) */
  }

  if (!res.ok || payload?.success === false) {
    const err = new Error(payload?.message ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return payload;
}
