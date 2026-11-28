
import { useState } from "react"
import { obtenerIngresosMensuales } from "@/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Nombres de los meses para las gráficas
const MESES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

// Obtener fecha actual en formato local
function obtenerMesActual() {
  const fecha = new Date()
  return `${fecha.getFullYear()}-${String(
    fecha.getMonth() + 1
  ).padStart(2, "0")}`
}

// Mostrar cantidades en pesos mexicanos
function mostrarMonto(centavos) {
  return (centavos / 100).toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
  })
}

// Panel financiero de GymControl
export function IncomePanel() {
  const [mes, setMes] = useState(obtenerMesActual)
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")

  // Estados del resumen anual
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [datosAnuales, setDatosAnuales] = useState(null)
  const [anioConsultado, setAnioConsultado] = useState(null)
  const [cargandoAnual, setCargandoAnual] = useState(false)
  const [errorAnual, setErrorAnual] = useState("")

  // Consultar un mes específico
  async function consultarIngresos(evento) {
    evento.preventDefault()
    setCargando(true)
    setError("")
    setDatos(null)

    try {
      const resultado = await obtenerIngresosMensuales(mes)
      setDatos(resultado)
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  // Consultar los 12 meses del año seleccionado
  async function consultarAnio(evento) {
    evento.preventDefault()

    const anioNumero = Number(anio)

    if (
      !Number.isInteger(anioNumero) ||
      anioNumero < 2000 ||
      anioNumero > 2100
    ) {
      setErrorAnual("Selecciona un año válido.")
      return
    }

    setCargandoAnual(true)
    setErrorAnual("")
    setDatosAnuales(null)
    setAnioConsultado(null)

    try {
      const consultas = MESES.map((nombre, indice) => {
        const mesNumero = String(indice + 1).padStart(2, "0")
        return obtenerIngresosMensuales(`${anioNumero}-${mesNumero}`)
      })

      
      // Consultar los meses uno por uno para evitar sobrecargar la API
      const resultados = []

      for (const nombre of MESES) {
        const mesNumero = String(resultados.length + 1).padStart(2, "0")
        const mesConsulta = `${anioNumero}-${mesNumero}`

        const resultado = await obtenerIngresosMensuales(mesConsulta)
        resultados.push(resultado)
      }


      const resumen = resultados.map((resultado, indice) => ({
        mes: MESES[indice],
        ingresos: Number(resultado.totalInCents),
        pagos: Number(resultado.cantidadPagos),
      }))

      // Validar datos antes de mostrar estadísticas
      if (
        resumen.some(
          (m) =>
            !Number.isFinite(m.ingresos) ||
            !Number.isFinite(m.pagos)
        )
      ) {
        throw new Error("La API devolvió datos inválidos.")
      }

      setDatosAnuales(resumen)
      setAnioConsultado(anioNumero)
    } catch (err) {
      setErrorAnual(err.message)
    } finally {
      setCargandoAnual(false)
    }
  }

  // Calcular los indicadores anuales
  const totalAnual = datosAnuales?.reduce(
    (total, m) => total + m.ingresos, 0
  ) ?? 0

  const pagosAnuales = datosAnuales?.reduce(
    (total, m) => total + m.pagos, 0
  ) ?? 0

  const mejorMes = datosAnuales?.reduce(
    (mejor, actual) =>
      actual.ingresos > mejor.ingresos ? actual : mejor
  , datosAnuales[0])

  const maximo = datosAnuales
    ? Math.max(...datosAnuales.map((m) => m.ingresos), 1)
    : 1

  return (
    <div className="space-y-8">

      {/* SECCIÓN 1: CONSULTA MENSUAL */}
      <Card>
        <CardHeader>
          <CardTitle>Consultar ingresos mensuales</CardTitle>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={consultarIngresos}
            className="flex flex-wrap items-end gap-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Seleccionar mes
              </label>

              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                required
              />
            </div>

            {/* Enviar formulario de consulta mensual */}
            <Button type="submit" disabled={cargando}>
            {cargando ? "Consultando..." : "Consultar ingresos"}
            </Button>
          </form>

          {error && (
            <p className="mt-4 text-sm text-red-600">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Resultado de la consulta mensual */}
      {datos && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Ingresos del mes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {mostrarMonto(datos.totalInCents)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Pagos registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {datos.cantidadPagos}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                Mes consultado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {datos.mes}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SECCIÓN 2: RESUMEN ANUAL */}
      <div className="border-t pt-6">
        <h2 className="text-xl font-bold">
          Resumen general de ingresos
        </h2>
        <p className="text-sm text-muted-foreground">
          Comparación de ingresos y pagos por mes
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={consultarAnio}
            className="flex flex-wrap items-end gap-4"
          >
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Año
              </label>
              <Input
                type="number"
                min="2000"
                max="2100"
                value={anio}
                onChange={(e) => setAnio(e.target.value)}
                className="w-32"
                required
              />
            </div>

            {/* Enviar formulario de consulta anual */}
            <Button type="submit" disabled={cargandoAnual}>
            {cargandoAnual ? "Consultando AWS..." : "Consultar año"}
            </Button>
          </form>

          {errorAnual && (
            <p className="mt-4 text-sm text-red-600">
              {errorAnual}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Indicadores anuales */}
      {datosAnuales && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Ingresos de {anioConsultado}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {mostrarMonto(totalAnual)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Pagos del año
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {pagosAnuales}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Mes con mayores ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {totalAnual > 0 ? mejorMes.mes : "Sin datos"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {totalAnual > 0
                    ? mostrarMonto(mejorMes.ingresos)
                    : "No hay ingresos registrados"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfica de barras: ingresos por mes */}
          <Card>
            <CardHeader>
              <CardTitle>
                Ingresos por mes — {anioConsultado}
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="flex h-72 items-end gap-2 overflow-x-auto pb-2">
                {datosAnuales.map((item) => (
                  <div
                    key={item.mes}
                    className="flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-xs text-muted-foreground">
                      {mostrarMonto(item.ingresos)}
                    </span>

                    <div className="flex h-52 w-full items-end justify-center">
                      <div
                        className="w-3/4 rounded-t-md bg-primary"
                        style={{
                          height: `${
                            item.ingresos === 0
                              ? 0
                              : Math.max(
                                  (item.ingresos / maximo) * 100,
                                  2
                                )
                          }%`,
                        }}
                        title={`${item.mes}: ${mostrarMonto(item.ingresos)}`}
                      />
                    </div>

                    <span className="text-xs font-medium">
                      {item.mes}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Comparación mensual */}
          <Card>
            <CardHeader>
              <CardTitle>
                Comparación de pagos por mes
              </CardTitle>
            </CardHeader>

            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-3">Mes</th>
                      <th className="p-3">Pagos</th>
                      <th className="p-3">Ingresos</th>
                    </tr>
                  </thead>

                  <tbody>
                    {datosAnuales.map((item) => (
                      <tr key={item.mes} className="border-b">
                        <td className="p-3">{item.mes}</td>
                        <td className="p-3">{item.pagos}</td>
                        <td className="p-3">
                          {mostrarMonto(item.ingresos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="font-bold">
                      <td className="p-3">Total anual</td>
                      <td className="p-3">{pagosAnuales}</td>
                      <td className="p-3">
                        {mostrarMonto(totalAnual)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
