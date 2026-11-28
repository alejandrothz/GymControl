
import { useEffect, useState } from "react"
import { fetchAuthSession } from "aws-amplify/auth"

// Funciones para consultar y registrar miembros en AWS
import { obtenerMiembros, registrarMiembro } from "./api"

// Componentes del dashboard GymControl
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { PaymentsPanel } from "@/components/payments-panel"
import { IncomePanel } from "@/components/income-panel"

// Componentes visuales de shadcn/ui
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

// Secciones disponibles en GymControl
const secciones = ["inicio", "miembros", "pagos", "ingresos"]

// Obtener la sección desde la URL
function obtenerSeccion() {
  const seccion = window.location.hash.replace("#", "")
  return secciones.includes(seccion) ? seccion : "inicio"
}

// Formatear fechas de DynamoDB
function mostrarFecha(fecha) {
  if (!fecha) return "Sin fecha"

  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

// Componente principal de GymControl
function App() {
  // Estados de navegación
  const [seccion, setSeccion] = useState(obtenerSeccion)

  // Estados de miembros y conexión con AWS
  const [miembros, setMiembros] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  // Permisos del usuario autenticado
  const [esGerente, setEsGerente] = useState(false)

  // Estados del formulario de miembros
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState("")
  const [telefonoNuevo, setTelefonoNuevo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [errorRegistro, setErrorRegistro] = useState("")
  const [mensajeRegistro, setMensajeRegistro] = useState("")

  // Cargar miembros y comprobar el grupo de Cognito
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [datos, sesion] = await Promise.all([
          obtenerMiembros(),
          fetchAuthSession(),
        ])

        // Guardar miembros obtenidos de DynamoDB
        setMiembros(datos)

        // Revisar los grupos del usuario autenticado
        const grupos =
          sesion.tokens?.accessToken?.payload?.["cognito:groups"] || []

        setEsGerente(
          Array.isArray(grupos) && grupos.includes("Gerente")
        )
      } catch (err) {
        setError(err.message)
      } finally {
        setCargando(false)
      }
    }

    cargarDatos()
  }, [])

  // Detectar los cambios de sección desde el menú lateral
  useEffect(() => {
    function actualizarSeccion() {
      setSeccion(obtenerSeccion())
    }

    window.addEventListener("hashchange", actualizarSeccion)

    return () => {
      window.removeEventListener("hashchange", actualizarSeccion)
    }
  }, [])

  // Registrar un nuevo miembro mediante API Gateway
  async function guardarMiembro(evento) {
    evento.preventDefault()

    setGuardando(true)
    setErrorRegistro("")
    setMensajeRegistro("")

    try {
      // Registrar el miembro en DynamoDB
      await registrarMiembro(
        nombreNuevo.trim(),
        telefonoNuevo.trim()
      )

      // Actualizar la lista después del registro
      const datosActualizados = await obtenerMiembros()
      setMiembros(datosActualizados)

      // Limpiar el formulario
      setNombreNuevo("")
      setTelefonoNuevo("")
      setMostrarFormulario(false)

      setMensajeRegistro("Miembro registrado correctamente")
    } catch (err) {
      setErrorRegistro(err.message)
    } finally {
      setGuardando(false)
    }
  }

  // Obtener fecha local en formato YYYY-MM-DD
  const fechaActual = new Date()

  const hoy = [
    fechaActual.getFullYear(),
    String(fechaActual.getMonth() + 1).padStart(2, "0"),
    String(fechaActual.getDate()).padStart(2, "0"),
  ].join("-")

  // Calcular estadísticas con miembros reales
  const activos = miembros.filter(
    (m) => m.isActive === true
  ).length

  const vigentes = miembros.filter(
    (m) =>
      m.isActive === true &&
      m.membershipStartDate &&
      m.membershipEndDate &&
      m.membershipStartDate <= hoy &&
      m.membershipEndDate >= hoy
  ).length

  const vencidos = miembros.filter(
    (m) =>
      m.isActive === true &&
      m.membershipEndDate &&
      m.membershipEndDate < hoy
  ).length

  // Buscar miembros por nombre o teléfono
  const miembrosFiltrados = miembros.filter((m) => {
    const texto = busqueda.trim().toLowerCase()

    return (
      (m.fullName || "").toLowerCase().includes(texto) ||
      (m.phone || "").includes(texto)
    )
  })

  return (
    <SidebarProvider>
      {/* Menú lateral de GymControl */}
      <AppSidebar />

      {/* Contenido principal */}
      <SidebarInset>
        <SiteHeader />

        <main className="flex flex-col gap-6 p-6">
          {/* Encabezado de la sección */}
          <div>
            <h1 className="text-2xl font-bold capitalize">
              {seccion}
            </h1>

            <p className="text-sm text-muted-foreground">
              Sistema de administración GymControl
            </p>
          </div>

          {/* Estado de conexión con AWS */}
          {cargando && (
            <p className="text-sm">Consultando AWS...</p>
          )}

          {error && (
            <p className="text-sm text-red-600">
              Error de conexión: {error}
            </p>
          )}

          {/* INICIO: estadísticas reales */}
          {seccion === "inicio" && !cargando && !error && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["Total de miembros", miembros.length],
                ["Miembros activos", activos],
                ["Membresías vigentes", vigentes],
                ["Membresías vencidas", vencidos],
              ].map(([titulo, valor]) => (
                <Card key={titulo}>
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">
                      {titulo}
                    </CardTitle>
                  </CardHeader>

                  <CardContent>
                    <p className="text-3xl font-bold">
                      {valor}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* MIEMBROS: registro y búsqueda */}
          {seccion === "miembros" && !cargando && !error && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Miembros registrados</CardTitle>

                <Button
                  onClick={() => {
                    setMostrarFormulario(!mostrarFormulario)
                    setErrorRegistro("")
                    setMensajeRegistro("")
                  }}
                >
                  {mostrarFormulario
                    ? "Cancelar"
                    : "Registrar miembro"}
                </Button>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Mensaje de registro exitoso */}
                {mensajeRegistro && (
                  <p className="text-sm text-green-600">
                    {mensajeRegistro}
                  </p>
                )}

                {/* Formulario para nuevos miembros */}
                {mostrarFormulario && (
                  <form
                    onSubmit={guardarMiembro}
                    className="space-y-3 rounded-lg border p-4"
                  >
                    <h3 className="font-semibold">
                      Nuevo miembro
                    </h3>

                    <Input
                      placeholder="Nombre completo"
                      value={nombreNuevo}
                      onChange={(e) =>
                        setNombreNuevo(e.target.value)
                      }
                      required
                    />

                    <Input
                      placeholder="Teléfono"
                      value={telefonoNuevo}
                      onChange={(e) =>
                        setTelefonoNuevo(e.target.value)
                      }
                    />

                    {errorRegistro && (
                      <p className="text-sm text-red-600">
                        {errorRegistro}
                      </p>
                    )}

                    <Button
                      type="submit"
                      disabled={guardando}
                    >
                      {guardando
                        ? "Guardando..."
                        : "Guardar miembro"}
                    </Button>
                  </form>
                )}

                {/* Buscador de miembros */}
                <Input
                  placeholder="Buscar por nombre o teléfono..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                />

                {/* Tabla de miembros desde DynamoDB */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3">Nombre</th>
                        <th className="p-3">Teléfono</th>
                        <th className="p-3">Vencimiento</th>
                        <th className="p-3">Estado</th>
                      </tr>
                    </thead>

                    <tbody>
                      {miembrosFiltrados.map((m) => (
                        <tr
                          key={m.memberId}
                          className="border-b"
                        >
                          <td className="p-3">
                            {m.fullName}
                          </td>

                          <td className="p-3">
                            {m.phone || "Sin teléfono"}
                          </td>

                          <td className="p-3">
                            {mostrarFecha(m.membershipEndDate)}
                          </td>

                          <td className="p-3">
                            <Badge
                              variant={
                                m.isActive
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {m.isActive
                                ? "Activo"
                                : "Desactivado"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {!miembrosFiltrados.length && (
                    <p className="p-4 text-center text-muted-foreground">
                      No se encontraron miembros.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* PAGOS: registrar y consultar historial */}
          {seccion === "pagos" && !cargando && !error && (
            <PaymentsPanel
              miembros={miembros}
              onActualizarMiembros={setMiembros}
            />
          )}

          {/* INGRESOS: acceso exclusivo del gerente */}
          {seccion === "ingresos" && !cargando && (
            esGerente ? (
              <IncomePanel />
            ) : (
              <Card>
                <CardContent className="p-6">
                  <p className="text-red-600">
                    Acceso exclusivo para gerentes.
                  </p>
                </CardContent>
              </Card>
            )
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
