/**
 * Logger que solo emite en desarrollo.
 * En producción (NODE_ENV === 'production') no se escribe nada en la consola,
 * para no exponer URLs, tokens ni datos sensibles en Inspect → Console.
 */
const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development"

export function logDev(...args: unknown[]) {
  if (isDev) console.log(...args)
}

export function warnDev(...args: unknown[]) {
  if (isDev) console.warn(...args)
}

export function errorDev(...args: unknown[]) {
  if (isDev) console.error(...args)
}
