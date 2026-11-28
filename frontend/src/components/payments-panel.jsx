
import { useEffect, useState } from "react"

import {
  obtenerCotizacionPago,
  obtenerHistorialPagos,
  obtenerMiembros,
  registrarPago,
} from "@/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { SearchIcon } from "lucide-react"
import { obtenerEstadoMembresia } from "@/lib/membership-status"

// Convertir centavos a pesos mexicanos
function mostrarMonto(centavos) {
  return (centavos / 100).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  })
}

// Mostrar fechas de DynamoDB
function mostrarFecha(fecha) {
  if (!fecha) return "Sin membresía"

  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

// Validar que AWS haya enviado un desglose correcto
function validarCotizacion(datos) {
  const campos = [
    datos.enrollmentFeeInCents,
    datos.membershipFeeInCents,
    datos.totalInCents,
  ]

  if (
    !campos.every((valor) =>
      Number.isSafeInteger(valor) && valor >= 0
    ) ||
    datos.membershipFeeInCents <= 0 ||
    datos.totalInCents !==
      datos.enrollmentFeeInCents + datos.membershipFeeInCents
  ) {
    throw new Error("AWS devolvió una cotización inválida")
  }

  return datos
}

// Pantalla de cobros e historial de GymControl
export function PaymentsPanel({ miembros, onActualizarMiembros }) {
  const [busqueda, setBusqueda] = useState("")
  const [seleccionado, setSeleccionado] = useState(null)

  // Cotización oficial
  const [cotizacion, setCotizacion] = useState(null)
  const [cargandoCotizacion, setCargandoCotizacion] = useState(false)
  const [errorCotizacion, setErrorCotizacion] = useState("")

  // Historial de pagos
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [errorHistorial, setErrorHistorial] = useState("")

  // Registro del pago
  const [guardando, setGuardando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [errorPago, setErrorPago] = useState("")
  const [aviso, setAviso] = useState("")

  // Buscar todos los miembros, independientemente de isActive
  const coincidencias = busqueda.trim()
    ? miembros
        .filter((miembro) => {
          const texto = busqueda.trim().toLowerCase()

          return (
            (miembro.fullName || "")
              .toLowerCase()
              .includes(texto) ||
            (miembro.phone || "").includes(texto)
          )
        })
        .slice(0, 8)
    : []

  // Consultar precios e historial al seleccionar un miembro
  useEffect(() => {
    if (!seleccionado) {
      setCotizacion(null)
      setHistorial([])
      setErrorCotizacion("")
      setErrorHistorial("")
      return
    }

    let cancelado = false

    async function cargarDatos() {
      setCargandoCotizacion(true)
      setCargandoHistorial(true)
      setCotizacion(null)
      setHistorial([])
      setErrorCotizacion("")
      setErrorHistorial("")

      // Consultar ambas funciones Lambda
      const [precios, pagos] = await Promise.allSettled([
        obtenerCotizacionPago(seleccionado.memberId),
        obtenerHistorialPagos(seleccionado.memberId),
      ])

      if (cancelado) return

      if (precios.status === "fulfilled") {
        try {
          setCotizacion(validarCotizacion(precios.value))
        } catch (err) {
          setErrorCotizacion(err.message)
        }
      } else {
        setErrorCotizacion(precios.reason.message)
      }

      if (pagos.status === "fulfilled") {
        setHistorial(pagos.value)
      } else {
        setErrorHistorial(pagos.reason.message)
      }

      setCargandoCotizacion(false)
      setCargandoHistorial(false)
    }

    cargarDatos()

    return () => {
      cancelado = true
    }
  }, [seleccionado?.memberId])

  // Elegir un miembro de la búsqueda
  function seleccionarMiembro(miembro) {
    setSeleccionado(miembro)
    setBusqueda("")
    setCotizacion(null)
    setResultado(null)
    setErrorPago("")
    setAviso("")
  }

  // Registrar pago utilizando el importe oficial
  async function confirmarPago(evento) {
    evento.preventDefault()

    if (!seleccionado || !cotizacion || guardando) return

    setGuardando(true)
    setErrorPago("")
    setResultado(null)
    setAviso("")

    const memberId = seleccionado.memberId
    const requestId = crypto.randomUUID()

    try {
      // Lambda vuelve a validar los precios en DynamoDB
      const pago = await registrarPago(
        memberId,
        cotizacion.totalInCents,
        requestId
      )

      setResultado(pago)

      // Evitar utilizar una cotización anterior
      setCotizacion(null)
      setCargandoCotizacion(true)

      // Actualizar precios, historial y miembros
      const [precios, pagos, lista] = await Promise.allSettled([
        obtenerCotizacionPago(memberId),
        obtenerHistorialPagos(memberId),
        obtenerMiembros(),
      ])

      if (precios.status === "fulfilled") {
        try {
          setCotizacion(validarCotizacion(precios.value))
          setErrorCotizacion("")
        } catch (err) {
          setErrorCotizacion(err.message)
        }
      } else {
        setErrorCotizacion(precios.reason.message)
      }

      if (pagos.status === "fulfilled") {
        setHistorial(pagos.value)
        setErrorHistorial("")
      } else {
        setErrorHistorial(pagos.reason.message)
      }

      if (lista.status === "fulfilled") {
        onActualizarMiembros(lista.value)

        const miembroActualizado = lista.value.find(
          (m) => m.memberId === memberId
        )

        if (miembroActualizado) {
          setSeleccionado(miembroActualizado)
        }
      }

      if (
        precios.status === "rejected" ||
        pagos.status === "rejected" ||
        lista.status === "rejected"
      ) {
        setAviso(
          "Pago registrado, pero no fue posible actualizar todos los datos."
        )
      }
    } catch (err) {
      // No repetir automáticamente un cobro cuyo resultado sea incierto
      setErrorPago(
        `${err.message}. Comprueba el historial antes de intentar otro pago.`
      )
      setCotizacion(null)
    } finally {
      setGuardando(false)
      setCargandoCotizacion(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Formulario de cobro */}
        <Card>
          <CardHeader>
            <CardTitle>Registrar pago</CardTitle>
          </CardHeader>

          <CardContent>
            <form onSubmit={confirmarPago} className="space-y-5">
              {/* Buscar miembro */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Buscar miembro
                </label>

                {seleccionado ? (
                  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                    <div className="space-y-1">
                      <p className="font-medium">
                        {seleccionado.fullName}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {seleccionado.phone || "Sin teléfono"}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        Vencimiento actual:{" "}
                        {mostrarFecha(
                          seleccionado.membershipEndDate
                        )}
                      </p>

                      <Badge variant="secondary">
                        {obtenerEstadoMembresia(seleccionado)}
                      </Badge>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      disabled={guardando}
                      onClick={() => {
                        setSeleccionado(null)
                        setResultado(null)
                        setErrorPago("")
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
                                <p className="font-medium">
                                  {m.fullName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {m.phone || "Sin teléfono"}
                                </p>
                              </div>

                              <Badge variant="secondary">
                                {obtenerEstadoMembresia(m)}
                              </Badge>
                            </button>
                          ))
                        ) : (
                          <p className="p-3 text-sm text-muted-foreground">
                            No se encontraron miembros.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Desglose de precios consultados desde AWS */}
              {seleccionado && (
                <div className="space-y-3 rounded-lg border p-4">
                  <h3 className="font-semibold">
                    Desglose del cobro
                  </h3>

                  {cargandoCotizacion && (
                    <p className="text-sm text-muted-foreground">
                      Consultando precios en AWS...
                    </p>
                  )}

                  {errorCotizacion && (
                    <p className="text-sm text-red-600">
                      {errorCotizacion}
                    </p>
                  )}

                  {cotizacion && (
                    <>
                      <Badge variant="secondary">
                        {cotizacion.paymentType === "FIRST_PAYMENT"
                          ? "Primer pago"
                          : "Renovación"}
                      </Badge>

                      <div className="flex justify-between text-sm">
                        <span>Inscripción</span>
                        <span>
                          {mostrarMonto(
                            cotizacion.enrollmentFeeInCents
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span>Mensualidad (30 días)</span>
                        <span>
                          {mostrarMonto(
                            cotizacion.membershipFeeInCents
                          )}
                        </span>
                      </div>

                      <div className="flex justify-between border-t pt-3 font-bold">
                        <span>Total a cobrar</span>
                        <span className="text-xl">
                          {mostrarMonto(
                            cotizacion.totalInCents
                          )}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {errorPago && (
                <p className="text-sm text-red-600">
                  {errorPago}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={
                  guardando ||
                  cargandoCotizacion ||
                  !seleccionado ||
                  !cotizacion ||
                  Boolean(errorPago)
                }
              >
                {guardando
                  ? "Registrando pago..."
                  : "Confirmar pago"}
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

                <p>
                  Inscripción:{" "}
                  {mostrarMonto(
                    resultado.enrollmentFeeInCents ?? 0
                  )}
                </p>

                <p>
                  Mensualidad:{" "}
                  {mostrarMonto(
                    resultado.membershipFeeInCents ?? 0
                  )}
                </p>

                <p className="font-bold">
                  Total:{" "}
                  {mostrarMonto(resultado.amountInCents)}
                </p>

                <p>
                  Inicio: {mostrarFecha(resultado.nuevoInicio)}
                </p>

                <p>
                  Vencimiento: {mostrarFecha(resultado.nuevoFin)}
                </p>

                <p className="break-all text-xs text-muted-foreground">
                  ID de pago: {resultado.paymentId}
                </p>

                {aviso && (
                  <p className="text-sm text-amber-600">
                    {aviso}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aquí aparecerá el resultado del último pago.
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
          {!seleccionado ? (
            <p className="text-sm text-muted-foreground">
              Selecciona un miembro para consultar su historial.
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
                    <th className="p-3">Fecha</th>
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
