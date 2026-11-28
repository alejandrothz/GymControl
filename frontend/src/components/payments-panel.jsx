
import { useEffect, useState } from "react"

import {
  registrarPago,
  obtenerMiembros,
  obtenerHistorialPagos,
} from "@/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { SearchIcon } from "lucide-react"

// Convertir pesos a centavos sin errores de decimales
function convertirACentavos(texto) {
  const valor = texto.trim()

  if (!/^\d+([.,]\d{1,2})?$/.test(valor)) return null

  const [pesos, centavos = ""] = valor.replace(",", ".").split(".")
  const resultado = Number(pesos) * 100 + Number(centavos.padEnd(2, "0"))

  return Number.isSafeInteger(resultado) && resultado > 0
    ? resultado
    : null
}

// Formatear fechas de DynamoDB
function mostrarFecha(fecha) {
  if (!fecha) return "Sin membresía"
  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

// Formatear cantidades en pesos mexicanos
function mostrarMonto(centavos) {
  return (centavos / 100).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  })
}

// Pantalla de pagos e historial
export function PaymentsPanel({ miembros, onActualizarMiembros }) {
  const [busqueda, setBusqueda] = useState("")
  const [miembroSeleccionado, setMiembroSeleccionado] = useState(null)
  const [monto, setMonto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [resultado, setResultado] = useState(null)

  // Estado del historial
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState("")
  const [aviso, setAviso] = useState("")

  // Buscar por nombre o teléfono
  const coincidencias = busqueda.trim()
    ? miembros
        .filter(
          (m) =>
            m.isActive === true &&
            (
              (m.fullName || "")
                .toLowerCase()
                .includes(busqueda.trim().toLowerCase()) ||
              (m.phone || "").includes(busqueda.trim())
            )
        )
        .slice(0, 8)
    : []

  // Consultar historial cuando cambia el miembro seleccionado
  useEffect(() => {
    if (!miembroSeleccionado) {
      setHistorial([])
      setErrorHistorial("")
      setCargandoHistorial(false)
      return
    }

    let cancelado = false

    async function cargarHistorial() {
      setCargandoHistorial(true)
      setErrorHistorial("")
      setHistorial([])

      try {
        const datos = await obtenerHistorialPagos(
          miembroSeleccionado.memberId
        )

        if (!cancelado) setHistorial(datos)
      } catch (err) {
        if (!cancelado) setErrorHistorial(err.message)
      } finally {
        if (!cancelado) setCargandoHistorial(false)
      }
    }

    cargarHistorial()

    return () => {
      cancelado = true
    }
  }, [miembroSeleccionado?.memberId])

  // Seleccionar miembro
  function seleccionarMiembro(miembro) {
    setMiembroSeleccionado(miembro)
    setBusqueda("")
    setError("")
    setResultado(null)
    setAviso("")
  }

  // Registrar pago mediante Lambda
  async function guardarPago(evento) {
    evento.preventDefault()

    const amountInCents = convertirACentavos(monto)

    if (!miembroSeleccionado || amountInCents === null) {
      setError("Selecciona un miembro e introduce un monto válido.")
      return
    }

    setGuardando(true)
    setError("")
    setResultado(null)
    setAviso("")

    try {
      // Identificador único de la solicitud
      const requestId = crypto.randomUUID()

      const pago = await registrarPago(
        miembroSeleccionado.memberId,
        amountInCents,
        requestId
      )

      setResultado({
        ...pago,
        monto: amountInCents,
      })

      setMonto("")

      // Refrescar miembros e historial después del pago
      const resultados = await Promise.allSettled([
        obtenerMiembros(),
        obtenerHistorialPagos(miembroSeleccionado.memberId),
      ])

      if (resultados[0].status === "fulfilled") {
        const datos = resultados[0].value
        onActualizarMiembros(datos)

        const actualizado = datos.find(
          (m) => m.memberId === miembroSeleccionado.memberId
        )

        if (actualizado) setMiembroSeleccionado(actualizado)
      }

      if (resultados[1].status === "fulfilled") {
        setHistorial(resultados[1].value)
        setErrorHistorial("")
      }

      if (resultados.some((r) => r.status === "rejected")) {
        setAviso(
          "El pago se registró, pero algunos datos no se actualizaron. Recarga la página."
        )
      }
    } catch (err) {
      setError(
        `${err.message}. Verifica el historial antes de intentar nuevamente.`
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario para cobrar membresías */}
        <Card>
          <CardHeader>
            <CardTitle>Registrar pago</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={guardarPago} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Buscar miembro
                </label>

                {miembroSeleccionado ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div>
                      <p className="font-medium">
                        {miembroSeleccionado.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {miembroSeleccionado.phone || "Sin teléfono"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Vencimiento: {mostrarFecha(
                          miembroSeleccionado.membershipEndDate
                        )}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={guardando}
                      onClick={() => {
                        setMiembroSeleccionado(null)
                        setResultado(null)
                        setAviso("")
                      }}
                    >
                      Cambiar
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-3 size-4 text-muted-foreground" />

                      <Input
                        className="pl-9"
                        placeholder="Nombre o teléfono..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                      />
                    </div>

                    {busqueda.trim() && (
                      <div className="max-h-64 overflow-y-auto rounded-md border">
                        {coincidencias.length ? (
                          coincidencias.map((m) => (
                            <button
                              key={m.memberId}
                              type="button"
                              className="flex w-full items-center justify-between gap-3 border-b p-3 text-left hover:bg-muted"
                              onClick={() => seleccionarMiembro(m)}
                            >
                              <div>
                                <p className="font-medium">{m.fullName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {m.phone || "Sin teléfono"}
                                </p>
                              </div>

                              <Badge variant="secondary">
                                {mostrarFecha(m.membershipEndDate)}
                              </Badge>
                            </button>
                          ))
                        ) : (
                          <p className="p-3 text-sm text-muted-foreground">
                            No se encontraron miembros activos.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Monto (MXN)
                </label>

                <Input
                  placeholder="Ejemplo: 500.00"
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={guardando || !miembroSeleccionado}
              >
                {guardando ? "Registrando..." : "Confirmar pago"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Confirmación del último pago */}
        <Card>
          <CardHeader>
            <CardTitle>Resultado del pago</CardTitle>
          </CardHeader>

          <CardContent className="space-y-3">
            {resultado ? (
              <>
                <p className="font-medium text-green-600">
                  Pago registrado correctamente
                </p>

                <p>Monto: {mostrarMonto(resultado.monto)}</p>
                <p>Inicio: {mostrarFecha(resultado.nuevoInicio)}</p>
                <p>Vencimiento: {mostrarFecha(resultado.nuevoFin)}</p>

                <p className="break-all text-xs text-muted-foreground">
                  ID: {resultado.paymentId}
                </p>

                {aviso && (
                  <p className="text-sm text-amber-600">{aviso}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aquí aparecerá la confirmación del último pago.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historial de pagos del miembro seleccionado */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de pagos</CardTitle>
        </CardHeader>

        <CardContent>
          {!miembroSeleccionado ? (
            <p className="text-sm text-muted-foreground">
              Selecciona un miembro para consultar sus pagos anteriores.
            </p>
          ) : cargandoHistorial ? (
            <p>Consultando historial en AWS...</p>
          ) : errorHistorial ? (
            <p className="text-sm text-red-600">
              {errorHistorial}
            </p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este miembro todavía no tiene pagos registrados.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-3">Fecha del pago</th>
                    <th className="p-3">Monto</th>
                    <th className="p-3">Inicio</th>
                    <th className="p-3">Vencimiento</th>
                  </tr>
                </thead>

                <tbody>
                  {historial.map((pago) => (
                    <tr
                      key={pago.paymentId}
                      className="border-b"
                    >
                      <td className="p-3">
                        {mostrarFecha(pago.paidAt)}
                      </td>
                      <td className="p-3">
                        {mostrarMonto(pago.amountInCents)}
                      </td>
                      <td className="p-3">
                        {mostrarFecha(pago.periodStart)}
                      </td>
                      <td className="p-3">
                        {mostrarFecha(pago.periodEnd)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
