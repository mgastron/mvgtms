"use client"

import { cn } from "@/lib/utils"
import { getLocalTenantBranding, type TenantBranding } from "@/lib/tenant"

const NEXO_WORDMARK = "/logos/nexo-logo-white.png"

type Variant = "header" | "login"

export function BrandLockup({
  tenant,
  variant = "header",
  className,
}: {
  tenant?: TenantBranding
  variant?: Variant
  className?: string
}) {
  const current = tenant ?? getLocalTenantBranding()
  const showPartner = current.slug !== "nexo" && Boolean(current.logoUrl)

  return (
    <div className={cn("flex items-center", variant === "login" ? "gap-4 md:gap-5" : "gap-3 md:gap-3.5", className)}>
      <img
        src={NEXO_WORDMARK}
        alt="nexo"
        className={variant === "login" ? "h-auto w-[110px] md:w-[132px]" : "h-auto w-[102px]"}
      />
      {showPartner && (
        <>
          <span
            className={cn(
              "shrink-0 rounded-full bg-white/40",
              variant === "login" ? "h-10 w-px md:h-12" : "h-8 w-px md:h-9"
            )}
            aria-hidden
          />
          <img
            src={current.logoUrl}
            alt={current.nombre}
            className={cn(
              "object-contain object-center",
              variant === "login"
                ? "h-[78px] w-[78px] md:h-[96px] md:w-[96px]"
                : "h-[50px] w-[50px] md:h-[58px] md:w-[58px]"
            )}
          />
        </>
      )}
    </div>
  )
}
