/**
 * Safe Logger utility with secret redaction / masking
 */

const SENSITIVE_KEYS = ['BINANCE_API_KEY', 'BINANCE_API_SECRET', 'SECRET', 'API_KEY', 'PASSWORD', 'TOKEN'];

function sanitizeMessage(message: string): string {
  let sanitized = message;
  for (const envKey of Object.keys(process.env)) {
    if (SENSITIVE_KEYS.some((k) => envKey.toUpperCase().includes(k))) {
      const val = process.env[envKey];
      if (val && val.length > 4) {
        const masked = `${val.slice(0, 2)}***${val.slice(-2)}`;
        sanitized = sanitized.split(val).join(masked);
      }
    }
  }
  return sanitized;
}

export const logger = {
  info: (msg: string, ...args: unknown[]) => {
    const formatted = `[INFO] [${new Date().toISOString()}] ${sanitizeMessage(msg)}`;
    console.log(formatted, ...args);
  },
  warn: (msg: string, ...args: unknown[]) => {
    const formatted = `[WARN] [${new Date().toISOString()}] ${sanitizeMessage(msg)}`;
    console.warn(formatted, ...args);
  },
  error: (msg: string, error?: unknown) => {
    const formatted = `[ERROR] [${new Date().toISOString()}] ${sanitizeMessage(msg)}`;
    if (error instanceof Error) {
      console.error(formatted, sanitizeMessage(error.message));
    } else if (error) {
      console.error(formatted, error);
    } else {
      console.error(formatted);
    }
  },
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== 'production') {
      const formatted = `[DEBUG] [${new Date().toISOString()}] ${sanitizeMessage(msg)}`;
      console.debug(formatted, ...args);
    }
  },
};
