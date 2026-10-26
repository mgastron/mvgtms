export type TenantBranding = {
  slug: string
  nombre: string
  logoUrl: string
  colorPrimario: string
}

const NEXO: TenantBranding = {
  slug: "nexo",
  nombre: "Nexo",
  logoUrl: "/logos/nexo-logo-white.png",
  colorPrimario: "#1459e9",
}

const LDP: TenantBranding = {
  slug: "mensajerialdp",
  nombre: "Mensajería LDP",
  logoUrl: "/tenants/mensajerialdp/logo.png",
  colorPrimario: "#1459e9",
}

const CACHE_KEY = "nexoTenantBranding.v2"

export function getTenantSlug(): string {
  if (typeof window === "undefined") return NEXO.slug
  const host = window.location.hostname.toLowerCase()
  if (host.endsWith(".isnexo.net")) {
    const sub = host.slice(0, -".isnexo.net".length)
    if (sub && sub !== "www" && sub !== "api" && !sub.includes(".")) {
      return sub
    }
  }
  return NEXO.slug
}

export function getLocalTenantBranding(): TenantBranding {
  const slug = getTenantSlug()
  if (slug === LDP.slug) return LDP
  if (slug === NEXO.slug) return NEXO
  return {
    slug,
    nombre: slug,
    logoUrl: "/logos/nexo-logo-white.png",
    colorPrimario: "#1459e9",
  }
}

export function isNexoTenant(): boolean {
  return getTenantSlug() === NEXO.slug
}

export function isLdpTenant(): boolean {
  return getTenantSlug() === LDP.slug
}

export function getDriverInstallPath(): string {
  return "/app"
}

export function getDriverInstallUrl(): string {
  if (typeof window === "undefined") return getDriverInstallPath()
  return `${window.location.origin}${getDriverInstallPath()}`
}

const DEFAULT_APK_URLS: Record<string, string> = {
  mensajerialdp:
    "https://expo.dev/artifacts/eas/abJrnPZEYV_U2yrjp6fs_9vxC7-YNlEwpWFrIC7t93E.apk",
}

export function getDriverApkUrl(slug?: string): string {
  const current = slug ?? getTenantSlug()
  const fromEnv =
    current === LDP.slug
      ? process.env.NEXT_PUBLIC_LDP_APK_URL
      : process.env.NEXT_PUBLIC_NEXO_APK_URL
  if (fromEnv?.trim()) return fromEnv.trim()
  if (DEFAULT_APK_URLS[current]) return DEFAULT_APK_URLS[current]
  return `/apps/${current}.apk`
}

export function getFechaOperativaLabel(branding?: TenantBranding): string {
  const b = branding ?? getLocalTenantBranding()
  if (b.slug === LDP.slug) return "Fecha LDP"
  if (b.slug === NEXO.slug) return "Fecha Nexo"
  return `Fecha ${b.nombre}`
}

export function installTenantFetch(): void {
  if (typeof window === "undefined") return
  const w = window as Window & { __nexoTenantFetch?: boolean }
  if (w.__nexoTenantFetch) return
  w.__nexoTenantFetch = true

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url

    const isApi =
      url.includes("localhost:8082") ||
      url.includes("api.isnexo.net") ||
      url.includes("127.0.0.1:8082") ||
      /\/api(\/|$|\?)/.test(url)

    if (!isApi) {
      return originalFetch(input, init)
    }

    const headers = new Headers(init?.headers)
    headers.set("X-Tenant", getTenantSlug())
    return originalFetch(input, { ...init, headers })
  }
}

export async function loadTenantBranding(apiBaseUrl: string): Promise<TenantBranding> {
  const local = getLocalTenantBranding()
  try {
    const response = await fetch(`${apiBaseUrl}/organizaciones/actual`)
    if (!response.ok) return persist(local)
    const data = await response.json()
    const branding: TenantBranding = {
      slug: data.slug || local.slug,
      nombre: data.nombre || local.nombre,
      logoUrl: local.logoUrl || data.logoUrl,
      colorPrimario: "#1459e9",
    }
    return persist(branding)
  } catch {
    return persist(local)
  }
}

export function readCachedTenantBranding(): TenantBranding {
  if (typeof window === "undefined") return NEXO
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as TenantBranding
      if (parsed?.slug === getTenantSlug()) return parsed
    }
  } catch {
    // ignore
  }
  return getLocalTenantBranding()
}

function persist(branding: TenantBranding): TenantBranding {
  if (typeof window !== "undefined") {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(branding))
  }
  return branding
}
