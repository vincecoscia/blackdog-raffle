import { requireSession } from "@/lib/auth";

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps a map of { GET, POST, ... } handlers with auth, method routing and
 * error handling so each route only has to express its own logic.
 */
export function route(handlers) {
  return async function apiRoute(req, res) {
    const handler = handlers[req.method];
    if (!handler) {
      res.setHeader("Allow", Object.keys(handlers));
      return res.status(405).json({ success: false, message: "Method not allowed." });
    }

    const session = await requireSession(req, res);
    if (!session) return;

    try {
      await handler(req, res, session);
    } catch (err) {
      const status = err.status ?? (err.name === "ValidationError" ? 400 : 500);
      if (status >= 500) console.error(`[api] ${req.method} ${req.url}`, err);
      res.status(status).json({
        success: false,
        message: status < 500 ? err.message : "Something went wrong.",
      });
    }
  };
}
