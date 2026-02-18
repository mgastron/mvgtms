"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import QRCode from "qrcode"
import { errorDev } from "@/lib/logger"

interface QRThumbnailProps {
  qrData: string | undefined
  tracking?: string
  size?: number // Tamaño de la miniatura en píxeles
}

export function QRThumbnail({ qrData, tracking, size = 40 }: QRThumbnailProps) {
  const [qrImageUrl, setQrImageUrl] = useState<string>("")
  const [largeQrUrl, setLargeQrUrl] = useState<string>("")
  const [isHovered, setIsHovered] = useState(false)
  const [popoverPosition, setPopoverPosition] = useState({ left: 0, top: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Generar QR miniatura
  useEffect(() => {
    if (!qrData) {
      setQrImageUrl("")
      return
    }

    const generateQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrData, {
          width: size * 2, // Mayor resolución para la miniatura
          margin: 1,
        })
        setQrImageUrl(dataUrl)
      } catch (error) {
        errorDev("Error generando QR:", error)
        setQrImageUrl("")
      }
    }

    generateQR()
  }, [qrData, size])

  // Generar QR grande para el popover (solo cuando se hace hover)
  useEffect(() => {
    if (!qrData || !isHovered) {
      setLargeQrUrl("")
      return
    }

    const generateLargeQR = async () => {
      try {
        const dataUrl = await QRCode.toDataURL(qrData, {
          width: 300, // Tamaño grande para el popover
          margin: 2,
        })
        setLargeQrUrl(dataUrl)
      } catch (error) {
        errorDev("Error generando QR grande:", error)
        setLargeQrUrl("")
      }
    }

    generateLargeQR()
  }, [qrData, isHovered])

  // Calcular posición del popover
  useEffect(() => {
    if (!isHovered || !containerRef.current) return

    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    
    // Posicionar el popover a la derecha de la miniatura
    const popoverWidth = 280 // Ancho del popover
    const popoverHeight = 280 // Alto del popover
    const spacing = 10 // Espacio entre miniatura y popover

    let left = rect.right + spacing
    let top = rect.top

    // Ajustar si se sale por la derecha
    if (left + popoverWidth > window.innerWidth) {
      left = rect.left - popoverWidth - spacing
    }

    // Ajustar si se sale por abajo
    if (top + popoverHeight > window.innerHeight) {
      top = window.innerHeight - popoverHeight - 10
    }

    // Ajustar si se sale por arriba
    if (top < 10) {
      top = 10
    }

    setPopoverPosition({ left, top })
  }, [isHovered])

  if (!qrData || !qrImageUrl) {
    return (
      <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
        <div className="h-3 w-3 bg-gray-400 rounded"></div>
      </div>
    )
  }

  const popoverContent = isHovered && (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border-2 border-gray-200 p-4 z-[9999] transition-all duration-200"
      style={{
        left: `${popoverPosition.left}px`,
        top: `${popoverPosition.top}px`,
        pointerEvents: "none",
      }}
    >
      {largeQrUrl ? (
        <div className="flex flex-col items-center gap-2">
          {tracking && (
            <p className="text-xs font-medium text-gray-700">{tracking}</p>
          )}
          <img
            src={largeQrUrl}
            alt={`QR Code para ${tracking || "envío"}`}
            className="w-64 h-64 object-contain"
          />
        </div>
      ) : (
        <div className="w-64 h-64 bg-gray-100 rounded flex items-center justify-center">
          <div className="text-gray-400 text-sm">Cargando QR...</div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <div
        ref={containerRef}
        className="relative inline-block"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <img
          src={qrImageUrl}
          alt={`QR Code para ${tracking || "envío"}`}
          className="w-10 h-10 object-contain rounded cursor-pointer"
        />
      </div>
      {typeof window !== "undefined" && createPortal(popoverContent, document.body)}
    </>
  )
}

