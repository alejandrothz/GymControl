
import { useEffect, useState } from "react"

import {
  obtenerPreciosGimnasio,
  actualizarPreciosGimnasio,
} from "@/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

// Convertir centavos a pesos para mostrar cantidades
function mostrarMonto(centavos) {
  return (centavos / 100).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  })
}

// Convertir centavos a texto editable en pesos
function centavosAPesos(centavos) {
  return (centavos / 100).toFixed(2)
}

// Validar y convertir pesos a centavos sin usar multiplicación
// con números decimales de punto flotante
function pesosACentavos(valor) {
  const texto = String(valor).trim()

  if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
    throw new Error("Introduce un precio válido con máximo dos decimales.")
  }

  const [pesos, centavos = ""] = texto.split(".")
  const cantidad = Number(pesos) * 100 + Number(centavos.padEnd(2, "0"))

  if (!Number.isSafeInteger(cantidad)) {
    throw new Error("El precio es demasiado grande.")
  }

  return cantidad
}

// Panel para consultar y modificar los precios del gimnasio
export function PricingPanel() {
  const [precios, setPrecios] = useState(null)
  const [inscripcion, setInscripcion] = useState("")
  const [mensualidad, setMensualidad] = useState("")

  const [editando, setEditando] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  const [error, setError] = useState("")
  const [mensaje, setMensaje] = useState("")

  // Cargar los precios desde DynamoDB
  useEffect(() => {
    let cancelado = false

    async function cargarPrecios() {
      try {
        const datos = await obtenerPreciosGimnasio()

        if (cancelado) return

        setPrecios(datos)
        setInscripcion(centavosAPesos(datos.enrollmentFeeInCents))
        setMensualidad(centavosAPesos(datos.monthlyFeeInCents))
      } catch (err) {
        if (!cancelado) setError(err.message)
      } finally {
        if (!cancelado) setCargando(false)
      }
    }

    cargarPrecios()

    return () => {
      cancelado = true
    }
  }, [])

  // Entrar en modo edición
  function iniciarEdicion() {
    setError("")
    setMensaje("")
    setEditando(true)
  }

  // Cancelar cambios sin modificar DynamoDB
  function cancelarEdicion() {
    setInscripcion(centavosAPesos(precios.enrollmentFeeInCents))
    setMensualidad(centavosAPesos(precios.monthlyFeeInCents))
    setError("")
    setEditando(false)
  }

  // Guardar los precios usando API Gateway y Lambda
  async function guardarPrecios(evento) {
    evento.preventDefault()

    setError("")
    setMensaje("")

    try {
      const nuevaInscripcion = pesosACentavos(inscripcion)
      const nuevaMensualidad = pesosACentavos(mensualidad)

      if (nuevaInscripcion < 0 || nuevaMensualidad <= 0) {
        throw new Error(
          "La inscripción no puede ser negativa y la mensualidad debe ser mayor a cero."
        )
      }

      setGuardando(true)

      await actualizarPreciosGimnasio(
        nuevaInscripcion,
        nuevaMensualidad
      )

      // Volver a consultar AWS para confirmar los valores guardados
      const datosActualizados = await obtenerPreciosGimnasio()

      setPrecios(datosActualizados)
      setInscripcion(
        centavosAPesos(datosActualizados.enrollmentFeeInCents)
      )
      setMensualidad(
        centavosAPesos(datosActualizados.monthlyFeeInCents)
      )

      setEditando(false)
      setMensaje("Precios actualizados correctamente.")
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Precios del gimnasio</CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        {cargando && <p>Consultando precios en AWS...</p>}

        {error && (
          <p className="text-sm text-red-600">
            {error}
          </p>
        )}

        {mensaje && (
          <p className="text-sm text-green-600">
            {mensaje}
          </p>
        )}

        {precios && !editando && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Inscripción
                </p>

                <p className="text-2xl font-bold">
                  {mostrarMonto(precios.enrollmentFeeInCents)}
                </p>
              </div>

              <div className="rounded-lg border p-4">
                <p className="text-sm text-muted-foreground">
                  Mensualidad
                </p>

                <p className="text-2xl font-bold">
                  {mostrarMonto(precios.monthlyFeeInCents)}
                </p>
              </div>
            </div>

            <Button
              type="button"
              onClick={iniciarEdicion}
            >
              Editar precios
            </Button>
          </div>
        )}

        {precios && editando && (
          <form
            onSubmit={guardarPrecios}
            className="space-y-4"
          >
            <div className="space-y-2">
              <label
                htmlFor="precio-inscripcion"
                className="text-sm font-medium"
              >
                Inscripción (MXN)
              </label>

              <Input
                id="precio-inscripcion"
                type="number"
                min="0"
                step="0.01"
                required
                value={inscripcion}
                onChange={(e) => setInscripcion(e.target.value)}
                disabled={guardando}
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="precio-mensualidad"
                className="text-sm font-medium"
              >
                Mensualidad (MXN)
              </label>

              <Input
                id="precio-mensualidad"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={mensualidad}
                onChange={(e) => setMensualidad(e.target.value)}
                disabled={guardando}
              />
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={guardando}
              >
                {guardando ? "Guardando..." : "Guardar cambios"}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={guardando}
                onClick={cancelarEdicion}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}

        <p className="text-xs text-muted-foreground">
          Los cambios afectarán las próximas cotizaciones y pagos.
          Los pagos históricos conservarán sus importes originales.
        </p>
      </CardContent>
    </Card>
  )
}
