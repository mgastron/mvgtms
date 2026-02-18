"use client"

import { useState, useEffect } from "react"
import { X, Check, Copy, CheckCircle2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { getApiBaseUrl } from "@/lib/api-config"
import { logDev, warnDev, errorDev } from "@/lib/logger"
import Image from "next/image"

interface NewClientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (clientData: any) => Promise<void>
  editingClient?: {
    id?: number
    codigo: string
    nombreFantasia: string
    tokenApi?: string
    listaPreciosId?: number
    flexIdVendedor?: string
    flexUsername?: string
    tiendanubeUrl?: string
    tiendanubeMetodoEnvio?: string
    tiendanubeAccessToken?: string
    tiendanubeStoreId?: string
    shopifyUrl?: string
    shopifyClaveUnica?: string
    shopifyMetodoEnvio?: string
    vtexUrl?: string
    vtexKey?: string
    vtexToken?: string
    vtexIdLogistica?: string
  } | null
}

type TabType = "general" | "cuentas"

interface ListaPrecio {
  id: number
  codigo: string
  nombre: string
}

export function NewClientModal({ open, onOpenChange, onSave, editingClient }: NewClientModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>("general")
  const [isSaving, setIsSaving] = useState(false)
  const [listasPrecios, setListasPrecios] = useState<ListaPrecio[]>([])
  const [listasPreciosError, setListasPreciosError] = useState<string | null>(null)
  const [listasPreciosLoading, setListasPreciosLoading] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [clienteCompleto, setClienteCompleto] = useState<any>(null)
  const [formData, setFormData] = useState({
    codigo: "",
    nombreFantasia: "",
    tokenApi: "",
    listaPreciosId: "",
    // FLEX
    flexIdVendedor: "",
    flexUsername: "",
    // tiendanube
    tiendanubeUrl: "",
    tiendanubeMetodoEnvio: "",
    // Shopify
    shopifyUrl: "",
    shopifyClaveUnica: "",
    shopifyMetodoEnvio: "",
    // WooCommerce
    vtexUrl: "",
    vtexKey: "",
    vtexToken: "",
    vtexIdLogistica: "",
  })

  const parseListaFromItem = (lp: any) => ({
    id: Number(lp.id),
    codigo: lp.codigo ?? "",
    nombre: lp.nombre ?? "",
  })

  const loadListasPrecios = async () => {
    setListasPreciosError(null)
    setListasPreciosLoading(true)
    const apiBaseUrl = getApiBaseUrl()
    try {
      const response = await fetch(`${apiBaseUrl}/lista-precios?page=0&size=1000`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })
      const data = await response.json().catch(() => ({}))
      const rawList = Array.isArray(data) ? data : (data.content ?? [])
      const listasData = rawList.map(parseListaFromItem)
      setListasPrecios(listasData)
      if (!response.ok && listasData.length === 0) {
        setListasPreciosError("No se pudieron cargar las listas. Verificá que el backend (api.mvgtms.com.ar) esté accesible.")
      }
    } catch (error: any) {
      errorDev("Error al cargar listas de precios:", error)
      setListasPrecios([])
      setListasPreciosError("No se pudieron cargar las listas. Verificá que el backend (api.mvgtms.com.ar) esté accesible.")
    } finally {
      setListasPreciosLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      loadListasPrecios()
    } else {
      setListasPrecios([])
      setListasPreciosError(null)
    }
  }, [open])

  // Cargar datos del cliente cuando se abre el modal para editar
  useEffect(() => {
    if (open && editingClient) {
      // Si hay un cliente para editar, cargar sus datos completos del backend
      const loadClientData = async () => {
        if (editingClient.id) {
          try {
            const apiBaseUrl = getApiBaseUrl()
            const response = await fetch(`${apiBaseUrl}/clientes/${editingClient.id}`)
            if (response.ok) {
              const clientData = await response.json()
              // Guardar los datos completos del cliente para usar en las condiciones
              setClienteCompleto(clientData)
              // Asegurarse de que el token API se cargue correctamente, incluso si es null o undefined
              const tokenApi = clientData.integraciones !== null && clientData.integraciones !== undefined 
                ? String(clientData.integraciones) 
                : ""
              setFormData({
                codigo: clientData.codigo || "",
                nombreFantasia: clientData.nombreFantasia || "",
                tokenApi: tokenApi,
                listaPreciosId: clientData.listaPreciosId ? String(clientData.listaPreciosId) : "",
                flexIdVendedor: clientData.flexIdVendedor || "",
                flexUsername: clientData.flexUsername || "",
                tiendanubeUrl: clientData.tiendanubeUrl || "",
                tiendanubeMetodoEnvio: clientData.tiendanubeMetodoEnvio || "",
                shopifyUrl: clientData.shopifyUrl || "",
                shopifyClaveUnica: clientData.shopifyClaveUnica || "",
                shopifyMetodoEnvio: clientData.shopifyMetodoEnvio || "",
                vtexUrl: clientData.vtexUrl || "",
                vtexKey: clientData.vtexKey || "",
                vtexToken: clientData.vtexToken || "",
                vtexIdLogistica: clientData.vtexIdLogistica || "",
              })
              return
            }
          } catch (error) {
            warnDev("No se pudo cargar datos completos del cliente desde el backend:", error)
          }
        }
        // Si no se puede cargar del backend o no hay ID, usar los datos proporcionados
        // Guardar también estos datos para las condiciones
        setClienteCompleto(editingClient)
        setFormData({
          codigo: editingClient.codigo || "",
          nombreFantasia: editingClient.nombreFantasia || "",
          tokenApi: editingClient.tokenApi || "",
          listaPreciosId: editingClient.listaPreciosId ? String(editingClient.listaPreciosId) : "",
          flexIdVendedor: editingClient.flexIdVendedor || "",
          flexUsername: editingClient.flexUsername || "",
          tiendanubeUrl: editingClient.tiendanubeUrl || "",
          tiendanubeMetodoEnvio: editingClient.tiendanubeMetodoEnvio || "",
          shopifyUrl: editingClient.shopifyUrl || "",
          shopifyClaveUnica: editingClient.shopifyClaveUnica || "",
          shopifyMetodoEnvio: editingClient.shopifyMetodoEnvio || "",
          vtexUrl: editingClient.vtexUrl || "",
          vtexKey: editingClient.vtexKey || "",
          vtexToken: editingClient.vtexToken || "",
          vtexIdLogistica: editingClient.vtexIdLogistica || "",
        })
      }
      loadClientData()
    } else if (open && !editingClient) {
      // Si se abre para crear nuevo, resetear el formulario
      setClienteCompleto(null)
      setFormData({
        codigo: "",
        nombreFantasia: "",
        tokenApi: "",
        listaPreciosId: "",
        flexIdVendedor: "",
        flexUsername: "",
        tiendanubeUrl: "",
        tiendanubeMetodoEnvio: "",
        shopifyUrl: "",
        shopifyClaveUnica: "",
        shopifyMetodoEnvio: "",
        vtexUrl: "",
        vtexKey: "",
        vtexToken: "",
        vtexIdLogistica: "",
      })
    }
  }, [open, editingClient])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    if (!formData.codigo.trim()) {
      alert("El código es obligatorio")
      return
    }

    if (!formData.listaPreciosId) {
      alert("La lista de precios es obligatoria")
      return
    }

    setIsSaving(true)
    try {
      const clientDataToSave = {
        id: editingClient?.id,
        codigo: formData.codigo,
        nombreFantasia: formData.nombreFantasia,
        habilitado: true, // Por defecto habilitado
        integraciones: formData.tokenApi && formData.tokenApi.trim() !== "" ? formData.tokenApi : null,
        listaPreciosId: formData.listaPreciosId ? Number(formData.listaPreciosId) : null,
        // Cuentas/Integraciones
        flexIdVendedor: formData.flexIdVendedor || null,
        flexUsername: formData.flexUsername || null,
        tiendanubeUrl: formData.tiendanubeUrl || null,
        tiendanubeMetodoEnvio: formData.tiendanubeMetodoEnvio || null,
        shopifyUrl: formData.shopifyUrl || null,
        shopifyClaveUnica: formData.shopifyClaveUnica || null,
        shopifyMetodoEnvio: formData.shopifyMetodoEnvio || null,
        vtexUrl: formData.vtexUrl || null,
        vtexKey: formData.vtexKey || null,
        vtexToken: formData.vtexToken || null,
        vtexIdLogistica: formData.vtexIdLogistica || null,
      }
      logDev("Guardando cliente (datos no logueados en producción)")
      await onSave(clientDataToSave)
      // Resetear formulario solo si no se está editando
      if (!editingClient) {
        setFormData({
          codigo: "",
          nombreFantasia: "",
          tokenApi: "",
          listaPreciosId: "",
          flexIdVendedor: "",
          flexUsername: "",
          tiendanubeUrl: "",
          tiendanubeMetodoEnvio: "",
          shopifyUrl: "",
          shopifyClaveUnica: "",
          shopifyMetodoEnvio: "",
          vtexUrl: "",
          vtexKey: "",
          vtexToken: "",
          vtexIdLogistica: "",
        })
      }
      onOpenChange(false)
    } catch (error: any) {
      errorDev("Error al guardar cliente:", error)
      const errorMessage = error?.message || "Error al guardar el cliente. Por favor, intenta nuevamente."
      alert(errorMessage)
    } finally {
      setIsSaving(false)
    }
  }

  if (!open) return null

  const isEditing = !!editingClient

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-full max-w-[1400px] rounded-lg bg-white shadow-xl">
        {/* Close button */}
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Title */}
        <div className="border-b px-8 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-gray-800">{isEditing ? "EDITAR CLIENTE" : "NUEVO CLIENTE"}</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b px-8 pt-4 pb-4">
          <button
            onClick={() => setActiveTab("general")}
            className={`rounded px-8 py-2.5 text-sm font-semibold uppercase transition-colors ${
              activeTab === "general" ? "bg-[#6B46FF] text-white" : "border-2 border-[#6B46FF] bg-white text-[#6B46FF]"
            }`}
          >
            GENERAL
          </button>
          <button
            onClick={() => setActiveTab("cuentas")}
            className={`rounded px-8 py-2.5 text-sm font-semibold uppercase transition-colors ${
              activeTab === "cuentas" ? "bg-[#6B46FF] text-white" : "border-2 border-[#6B46FF] bg-white text-[#6B46FF]"
            }`}
          >
            CUENTAS
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[600px] overflow-y-auto px-8 py-6">
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Row 1: Código, Nombre fantasía */}
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-4">
                  <label className="mb-1.5 block text-xs text-gray-500">Código</label>
                  <input
                    type="text"
                    value={formData.codigo}
                    onChange={(e) => handleInputChange("codigo", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                    required
                  />
                </div>
                <div className="col-span-8">
                  <label className="mb-1.5 block text-xs text-gray-500">Nombre fantasía</label>
                  <input
                    type="text"
                    value={formData.nombreFantasia}
                    onChange={(e) => handleInputChange("nombreFantasia", e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                  />
                </div>
              </div>

              {/* Lista Precios */}
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">
                  Lista precios <span className="text-red-500">*</span>
                </label>
                {listasPreciosError && (
                  <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <p>{listasPreciosError}</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2 border-amber-400 text-amber-800 hover:bg-amber-100"
                      onClick={() => loadListasPrecios()}
                      disabled={listasPreciosLoading}
                    >
                      {listasPreciosLoading ? "Cargando…" : "Reintentar"}
                    </Button>
                  </div>
                )}
                {listasPreciosLoading && !listasPreciosError && (
                  <p className="mb-2 text-xs text-gray-500">Cargando listas de precios…</p>
                )}
                <Select
                  value={formData.listaPreciosId}
                  onValueChange={(value) => handleInputChange("listaPreciosId", value)}
                  disabled={listasPreciosLoading && listasPrecios.length === 0}
                >
                  <SelectTrigger className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none h-auto">
                    <SelectValue placeholder={listasPrecios.length === 0 && !listasPreciosLoading ? "Sin listas (crear una en Lista precios)" : "Seleccionar lista de precios"} />
                  </SelectTrigger>
                  <SelectContent>
                    {listasPrecios.map((lista) => (
                      <SelectItem key={lista.id} value={String(lista.id)}>
                        {lista.codigo} - {lista.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* TOKEN API */}
              <div>
                <label className="mb-1.5 block text-xs text-gray-500">TOKEN API</label>
                <input
                  type="text"
                  value={formData.tokenApi}
                  onChange={(e) => handleInputChange("tokenApi", e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                />
              </div>
            </div>
          )}

          {activeTab === "cuentas" && (
            <div className="space-y-6">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-4 pb-3 border-b text-sm font-semibold text-gray-700">
                <div className="col-span-2">Tipo de cuenta</div>
                <div className="col-span-10">Datos de la cuenta</div>
              </div>

              {/* FLEX Integration */}
              <div className="grid grid-cols-12 gap-4 items-start">
                <div className="col-span-2 flex flex-col items-center justify-center py-4">
                  <div className="w-20 h-20 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                    <Image
                      src="/logos/flex-logo.png"
                      alt="Flex Logo"
                      width={80}
                      height={80}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className="text-sm font-semibold">FLEX</span>
                  <div className="mt-2">
                    {formData.flexIdVendedor && formData.flexUsername ? (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                        Vinculado ✓
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-red-100 text-red-800">
                        NO Vinculado ✗
                      </span>
                    )}
                  </div>
                </div>
                <div className="col-span-10 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">
                        ID VENDEDOR - <span className="text-orange-500">Se completa al vincular</span>
                      </label>
                      <input
                        type="text"
                        value={formData.flexIdVendedor}
                        onChange={(e) => handleInputChange("flexIdVendedor", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                        disabled={!!formData.flexIdVendedor}
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">
                        USERNAME - <span className="text-orange-500">Se completa al vincular</span>
                      </label>
                      <input
                        type="text"
                        value={formData.flexUsername}
                        onChange={(e) => handleInputChange("flexUsername", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                        disabled={!!formData.flexUsername}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingClient?.id) {
                          alert("Debe guardar el cliente primero antes de generar el link de vinculación")
                          return
                        }
                        try {
                          // Obtener la URL actual del navegador (puede ser localhost o el túnel)
                          const currentBaseUrl = window.location.origin
                          const apiBaseUrl = getApiBaseUrl()
                          const response = await fetch(`${apiBaseUrl}/clientes/${editingClient.id}/flex/link-vinculacion?baseUrl=${encodeURIComponent(currentBaseUrl)}`)
                          if (response.ok) {
                            const data = await response.json()
                            const link = data.link
                            // Copiar al portapapeles
                            await navigator.clipboard.writeText(link)
                            setShowLinkModal(true)
                          } else {
                            alert("Error al generar el link de vinculación")
                          }
                        } catch (error) {
                          errorDev("Error:", error)
                          alert("Error al generar el link de vinculación")
                        }
                      }}
                      className="rounded bg-[#6B46FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a3ae6] transition-colors"
                    >
                      Link vinculación
                    </button>
                    {formData.flexIdVendedor && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editingClient?.id) {
                              alert("Debe guardar el cliente primero")
                              return
                            }
                            if (!confirm("¿Desea sincronizar los envíos Flex de MercadoLibre? Esto puede tardar unos momentos.")) {
                              return
                            }
                            setSincronizando(true)
                            try {
                              const apiBaseUrl = getApiBaseUrl()
                              const response = await fetch(`${apiBaseUrl}/mercadolibre/sincronizar/${editingClient.id}`, {
                                method: 'POST'
                              })
                              const data = await response.json()
                              if (data.success) {
                                alert(`Sincronización completada:\n- ${data.nuevos} nuevos envíos\n- ${data.actualizados} envíos actualizados\n- ${data.errores} errores`)
                              } else {
                                alert(`Error al sincronizar: ${data.error || 'Error desconocido'}`)
                              }
                            } catch (error: any) {
                              errorDev("Error:", error)
                              alert(`Error al sincronizar: ${error.message || 'Error de conexión'}`)
                            } finally {
                              setSincronizando(false)
                            }
                          }}
                          disabled={sincronizando}
                          className="rounded bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {sincronizando ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Sincronizando...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Sincronizar envíos
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("¿Está seguro de que desea desvincular la cuenta Flex?")) {
                              return
                            }
                            
                            if (!editingClient?.id) {
                              alert("Debe guardar el cliente primero")
                              return
                            }
                            
                            try {
                              // Limpiar campos de Flex en el formulario
                              setFormData({
                                ...formData,
                                flexIdVendedor: "",
                                flexUsername: "",
                              })
                              
                              // Guardar inmediatamente en el backend
                              const clientDataToSave = {
                                id: editingClient.id,
                                codigo: formData.codigo,
                                nombreFantasia: formData.nombreFantasia,
                                habilitado: true,
                                integraciones: formData.tokenApi && formData.tokenApi.trim() !== "" ? formData.tokenApi : null,
                                listaPreciosId: formData.listaPreciosId ? Number(formData.listaPreciosId) : null,
                                flexIdVendedor: null,
                                flexUsername: null,
                                tiendanubeUrl: formData.tiendanubeUrl || null,
                                tiendanubeMetodoEnvio: formData.tiendanubeMetodoEnvio || null,
                                shopifyUrl: formData.shopifyUrl || null,
                                shopifyClaveUnica: formData.shopifyClaveUnica || null,
                                shopifyMetodoEnvio: formData.shopifyMetodoEnvio || null,
                                vtexUrl: formData.vtexUrl || null,
                                vtexKey: formData.vtexKey || null,
                                vtexToken: formData.vtexToken || null,
                                vtexIdLogistica: formData.vtexIdLogistica || null,
                              }
                              
                              await onSave(clientDataToSave)
                              alert("Cuenta Flex desvinculada correctamente")
                            } catch (error) {
                              errorDev("Error al desvincular:", error)
                              alert("Error al desvincular la cuenta Flex")
                            }
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* tiendanube Integration */}
              <div className="grid grid-cols-12 gap-4 items-start border-t pt-6">
                <div className="col-span-2 flex flex-col items-center justify-center py-4">
                  <div className="w-20 h-20 bg-black rounded-lg flex items-center justify-center mb-2 p-2">
                    <Image
                      src="/logos/tiendanube-logo.png"
                      alt="Tienda Nube Logo"
                      width={64}
                      height={64}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className="text-sm font-semibold">tiendanube</span>
                </div>
                <div className="col-span-10">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">URL TIENDANUBE</label>
                      <input
                        type="text"
                        value={formData.tiendanubeUrl}
                        onChange={(e) => handleInputChange("tiendanubeUrl", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                        placeholder="https://mitienda.mitiendanube.com"
                      />
                    </div>
                    {/* Botón SYNC: solo se muestra si la URL está guardada en la BD */}
                    {(clienteCompleto?.tiendanubeUrl || editingClient?.tiendanubeUrl) && editingClient?.id && (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const currentBaseUrl = window.location.origin
                              const apiBaseUrl = getApiBaseUrl()
                              const response = await fetch(`${apiBaseUrl}/clientes/${editingClient.id}/tiendanube/link-vinculacion?baseUrl=${encodeURIComponent(currentBaseUrl)}`)
                              if (response.ok) {
                                const data = await response.json()
                                const link = data.link
                                await navigator.clipboard.writeText(link)
                                setShowLinkModal(true)
                              } else {
                                const errorText = await response.text()
                                errorDev("Error response:", errorText)
                                alert("Error al generar el link de vinculación")
                              }
                            } catch (error) {
                              errorDev("Error:", error)
                              alert("Error al generar el link de vinculación")
                            }
                          }}
                          className="rounded bg-[#6B46FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#5a3ae6] transition-colors"
                        >
                          SYNC
                        </button>
                      </div>
                    )}
                    {/* Método de envío: solo se muestra si el cliente está vinculado (tiene accessToken o storeId) */}
                    {(clienteCompleto?.tiendanubeAccessToken || clienteCompleto?.tiendanubeStoreId || editingClient?.tiendanubeAccessToken || editingClient?.tiendanubeStoreId) && editingClient?.id && (
                      <div>
                        <div className="flex items-center gap-2 mb-1.5">
                          <label className="block text-xs text-gray-500">MÉTODO DE ENVÍO</label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentValue = formData.tiendanubeMetodoEnvio || ""
                              const newValue = prompt("Ingrese el método de envío:", currentValue)
                              if (newValue !== null) {
                                handleInputChange("tiendanubeMetodoEnvio", newValue)
                              }
                            }}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.tiendanubeMetodoEnvio || ""}
                          onChange={(e) => handleInputChange("tiendanubeMetodoEnvio", e.target.value)}
                          className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                          placeholder="Método de envío configurado en Tienda Nube"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Shopify Integration */}
              <div className="grid grid-cols-12 gap-4 items-start border-t pt-6">
                <div className="col-span-2 flex flex-col items-center justify-center py-4">
                  <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center mb-2 p-2 border border-gray-200">
                    <Image
                      src="/logos/shopify-logo.png"
                      alt="Shopify Logo"
                      width={64}
                      height={64}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className="text-sm font-semibold">Shopify</span>
                </div>
                <div className="col-span-10 space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs text-gray-500">SHOPIFY URL</label>
                    <input
                      type="text"
                      value={formData.shopifyUrl}
                      onChange={(e) => handleInputChange("shopifyUrl", e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                      placeholder="https://mitienda.myshopify.com"
                    />
                  </div>
                  {/* Botón SYNC: solo se muestra si la URL está guardada en la BD */}
                  {(clienteCompleto?.shopifyUrl || editingClient?.shopifyUrl) && editingClient?.id && (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const currentBaseUrl = window.location.origin
                            const apiBaseUrl = getApiBaseUrl()
                            const response = await fetch(`${apiBaseUrl}/clientes/${editingClient.id}/shopify/link-vinculacion?baseUrl=${encodeURIComponent(currentBaseUrl)}`)
                            if (response.ok) {
                              const data = await response.json()
                              const link = data.link
                              await navigator.clipboard.writeText(link)
                              setShowLinkModal(true)
                            } else {
                              const errorText = await response.text()
                              errorDev("Error response:", errorText)
                              alert("Error al generar el link de vinculación")
                            }
                          } catch (error) {
                            errorDev("Error:", error)
                            alert("Error al generar el link de vinculación")
                          }
                        }}
                        className="rounded bg-[#95BF47] px-4 py-2 text-sm font-semibold text-white hover:bg-[#7FA63A] transition-colors"
                      >
                        SYNC
                      </button>
                    </div>
                  )}
                  {/* Clave Única: solo se muestra si el cliente está vinculado */}
                  {(clienteCompleto?.shopifyClaveUnica || editingClient?.shopifyClaveUnica) && (
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">
                        CLAVE UNICA - <span className="text-orange-500">Se completa al vincular</span>
                      </label>
                      <input
                        type="text"
                        value={formData.shopifyClaveUnica}
                        onChange={(e) => handleInputChange("shopifyClaveUnica", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                        disabled={!!formData.shopifyClaveUnica}
                      />
                    </div>
                  )}
                  {/* Método de envío: solo se muestra si la URL está guardada */}
                  {(clienteCompleto?.shopifyUrl || editingClient?.shopifyUrl) && (
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">MÉTODO DE ENVÍO</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={formData.shopifyMetodoEnvio || ""}
                            onChange={(e) => handleInputChange("shopifyMetodoEnvio", e.target.value)}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                            placeholder="Método de envío configurado en Shopify"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* VTEX Integration */}
              <div className="grid grid-cols-12 gap-4 items-start border-t pt-6">
                <div className="col-span-2 flex flex-col items-center justify-center py-4">
                  <div className="w-20 h-20 bg-white rounded-lg flex items-center justify-center mb-2 p-2 border border-gray-200">
                    <Image
                      src="/logos/vtex-logo.png"
                      alt="VTEX Logo"
                      width={64}
                      height={64}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <span className="text-sm font-semibold">VTEX</span>
                </div>
                <div className="col-span-10 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">VTEX URL</label>
                      <input
                        type="text"
                        value={formData.vtexUrl}
                        onChange={(e) => handleInputChange("vtexUrl", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">VTEX KEY</label>
                      <input
                        type="text"
                        value={formData.vtexKey}
                        onChange={(e) => handleInputChange("vtexKey", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">VTEX TOKEN</label>
                      <input
                        type="text"
                        value={formData.vtexToken}
                        onChange={(e) => handleInputChange("vtexToken", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs text-gray-500">VTEX ID LOGISTICA</label>
                      <input
                        type="text"
                        value={formData.vtexIdLogistica}
                        onChange={(e) => handleInputChange("vtexIdLogistica", e.target.value)}
                        className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-[#6B46FF] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 border-t px-8 py-5">
          <button
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded bg-red-600 px-8 py-2.5 text-sm font-semibold uppercase text-white hover:bg-red-700 disabled:opacity-50"
          >
            CERRAR
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="rounded bg-green-600 px-8 py-2.5 text-sm font-semibold uppercase text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? "GUARDANDO..." : "GUARDAR"}
          </button>
        </div>
      </div>

      {/* Modal de Link Copiado */}
      {showLinkModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-white shadow-xl">
            {/* Close button */}
            <button
              onClick={() => setShowLinkModal(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Content */}
            <div className="p-8">
              {/* Icon */}
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-800 text-center mb-2">
                Link copiado al portapapeles!
              </h3>

              {/* Message */}
              <div className="space-y-3 mt-6 text-center">
                <p className="text-sm text-gray-600">
                  Enviar el link de sincronización al cliente.
                </p>
                <p className="text-sm text-gray-600 font-medium">
                  Una vez enviado el link, guardar y procesar.
                </p>
              </div>

              {/* Button */}
              <div className="mt-8 flex justify-center">
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="rounded bg-[#6B46FF] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#5a3ae6] transition-colors"
                >
                  Volver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

