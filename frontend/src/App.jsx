
import { useEffect, useState } from "react"
import { fetchAuthSession } from "aws-amplify/auth"

// Operaciones de AWS
import { obtenerMiembros, registrarMiembro } from "./api"

// Cálculo automático del estado de membresía
import { obtenerEstadoMembresia } from "@/lib/membership-status"

// Componentes de GymControl
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { PaymentsPanel } from "@/components/payments-panel"
import { IncomePanel } from "@/components/income-panel"
import { PricingPanel } from "@/components/pricing-panel"
import { EditMemberForm } from "@/components/edit-member-form"

// Componentes de shadcn/ui
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"

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

// Obtener sección actual desde la URL
function obtenerSeccion() {
  const seccion = window.location.hash.replace("#", "")
  return secciones.includes(seccion) ? seccion : "inicio"
}

// Mostrar fechas en formato DD/MM/YYYY
function mostrarFecha(fecha) {
  if (!fecha) return "Sin fecha"

  const [anio, mes, dia] = fecha.slice(0, 10).split("-")
  return `${dia}/${mes}/${anio}`
}

// Mostrar el estado automático de la membresía
function EstadoMembresia({ miembro }) {
  const estado = obtenerEstadoMembresia(miembro)

  const variantes = {
    "Sin membresía": "outline",
    "Vigente": "default",
    "Vencida": "secondary",
    "Inactivo": "destructive",
  }

  return (
    <Badge variant={variantes[estado]}>
      {estado}
    </Badge>
  )
}

// Componente principal de GymControl
function App() {
  // Navegación y datos de AWS
  const [seccion, setSeccion] = useState(obtenerSeccion)
  const [miembros, setMiembros] = useState([])
  const [busqueda, setBusqueda] = useState("")
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [esGerente, setEsGerente] = useState(false)

  // Registro de nuevos miembros
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState("")
  const [telefonoNuevo, setTelefonoNuevo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [errorRegistro, setErrorRegistro] = useState("")
  const [mensajeRegistro, setMensajeRegistro] = useState("")

  // Edición de miembros existentes
  const [miembroEditar, setMiembroEditar] = useState(null)

  // Consultar miembros y permisos del usuario en AWS
  useEffect(() => {
    async function cargarDatos() {
      try {
        const [datos, sesion] = await Promise.all([
          obtenerMiembros(),
          fetchAuthSession(),
        ])

        // Guardar miembros recibidos de DynamoDB
        setMiembros(datos)

        // Identificar el grupo de Cognito
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

  // Cambiar de pantalla usando el menú lateral
  useEffect(() => {
    function actualizarSeccion() {
      setSeccion(obtenerSeccion())
    }

    window.addEventListener("hashchange", actualizarSeccion)

    return () => {
      window.removeEventListener("hashchange", actualizarSeccion)
    }
  }, [])

  // Registrar un nuevo miembro en DynamoDB
  async function guardarMiembro(evento) {
    evento.preventDefault()

    setGuardando(true)
    setErrorRegistro("")
    setMensajeRegistro("")

    try {
      await registrarMiembro(
        nombreNuevo.trim(),
        telefonoNuevo.trim()
      )

      // Recargar miembros desde AWS
      const datos = await obtenerMiembros()
      setMiembros(datos)

      // Limpiar formulario
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

  // Estadísticas calculadas con los cuatro estados
  const estadisticas = {
    "Sin membresía": 0,
    "Vigente": 0,
    "Vencida": 0,
    "Inactivo": 0,
  }

  miembros.forEach((miembro) => {
    const estado = obtenerEstadoMembresia(miembro)
    estadisticas[estado]++
  })

  // Buscar miembros por nombre o teléfono
  const miembrosFiltrados = miembros.filter((miembro) => {
    const texto = busqueda.trim().toLowerCase()

    return (
      (miembro.fullName || "").toLowerCase().includes(texto) ||
      (miembro.phone || "").includes(texto)
    )
  })

  return (
    <SidebarProvider>
      {/* Menú lateral */}
      <AppSidebar />

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

          {/* Estado de conexión */}
          {cargando && (
            <p className="text-sm">
              Consultando AWS...
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600">
              Error de conexión: {error}
            </p>
          )}

          {/* INICIO: estadísticas de membresías */}
          {seccion === "inicio" && !cargando && !error && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[
                  ["Sin membresía", estadisticas["Sin membresía"]],
                  ["Vigentes", estadisticas["Vigente"]],
                  ["Vencidas", estadisticas["Vencida"]],
                  ["Inactivos", estadisticas["Inactivo"]],
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

              <p className="text-sm text-muted-foreground">
                Total de miembros registrados: {miembros.length}
              </p>
            </div>
          )}

          {/* MIEMBROS: registrar, buscar y editar */}
          {seccion === "miembros" && !cargando && !error && (
            <div className="space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4">
                  <CardTitle>Miembros registrados</CardTitle>

                  <Button
                    type="button"
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
                  {/* Mensaje de registro */}
                  {mensajeRegistro && (
                    <p className="text-sm text-green-600">
                      {mensajeRegistro}
                    </p>
                  )}

                  {/* Formulario de registro */}
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

                  {/* Buscar miembros */}
                  <Input
                    placeholder="Buscar por nombre o teléfono..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                  />

                  {/* Tabla de miembros */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3">Nombre</th>
                          <th className="p-3">Teléfono</th>
                          <th className="p-3">Vencimiento</th>
                          <th className="p-3">Estado</th>
                          <th className="p-3">Acciones</th>
                        </tr>
                      </thead>

                      <tbody>
                        {miembrosFiltrados.map((miembro) => (
                          <tr
                            key={miembro.memberId}
                            className="border-b"
                          >
                            <td className="p-3">
                              {miembro.fullName}
                            </td>

                            <td className="p-3">
                              {miembro.phone || "Sin teléfono"}
                            </td>

                            <td className="p-3">
                              {mostrarFecha(
                                miembro.membershipEndDate
                              )}
                            </td>

                            <td className="p-3">
                              <EstadoMembresia
                                miembro={miembro}
                              />
                            </td>

                            <td className="p-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setMiembroEditar(miembro)
                                  setMostrarFormulario(false)
                                }}
                              >
                                Editar
                              </Button>
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

              {/* Formulario para editar miembros */}
              {miembroEditar && (
                <EditMemberForm
                  key={miembroEditar.memberId}
                  miembro={miembroEditar}
                  onCancelar={() => setMiembroEditar(null)}
                  onActualizar={setMiembros}
                />
              )}
            </div>
          )}

          {/* PAGOS: inscripción, mensualidad e historial */}
          {seccion === "pagos" && !cargando && !error && (
            <PaymentsPanel
              miembros={miembros}
              onActualizarMiembros={setMiembros}
            />
          )}

          {/* INGRESOS Y PRECIOS: solo para el gerente */}
          {seccion === "ingresos" && !cargando && !error && (
            esGerente ? (
              <div className="space-y-6">
                {/* Estadísticas y gráficas de ingresos */}
                <IncomePanel />

                {/* Precios oficiales almacenados en DynamoDB */}
                <PricingPanel />
              </div>
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
