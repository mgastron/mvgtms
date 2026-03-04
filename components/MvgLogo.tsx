"use client"

import { cn } from "@/lib/utils"

/** Logo MVG: misma definición que en header y página principal. Único lugar donde se define el logo. */
export function MvgLogo({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-lg",
    lg: "h-20 w-20 text-3xl",
  }
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-cyan-500 to-teal-500 shadow-lg shadow-cyan-500/40 font-black tracking-tight text-white",
        sizeClasses[size],
        className
      )}
      aria-hidden
    >
      MVG
    </div>
  )
}
