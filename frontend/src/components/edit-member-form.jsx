
import { useState } from "react"

import {
  actualizarMiembro,
  obtenerMiembros,
} from "@/api"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Formulario para editar datos de un miembro
export function EditMemberForm({
  miembro,
  onCancelar,
  onActualizar,
}) {
  const [nombre, setNombre] = useState(miembro.fullName || "")
  const [telefono, setTelefono] = useState(miembro.phone || "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState("")

  // Actualizar información en DynamoDB
  async function guardarCambios(evento) {
    evento.preventDefault()

    setError("")
    setAviso("")

    const nombreLimpio = nombre.trim()
    const telefonoLimpio = telefono.trim()

    if (!nombreLimpio) {
      setError("El nombre es obligatorio.")
      return
    }

    if (
      telefonoLimpio &&
      !/^\d{10}$/.test(telefonoLimpio)
    ) {
      setError("El teléfono debe tener exactamente 10 dígitos.")
      return
    }

    setGuardando(true)

    try {
      // Modificar solamente nombre y teléfono
      const resultado = await actualizarMiembro(
        miembro.memberId,
        nombreLimpio,
        telefonoLimpio
      )

      // Actualizar inmediatamente los datos visibles
      if (resultado.miembro) {
        onActualizar((anteriores) =>
          anteriores.map((m) =>
            m.memberId === miembro.memberId
              ? resultado.miembro
              : m
          )
        )
      }

      // Volver a consultar los miembros desde AWS
      try {
        const actualizados = await obtenerMiembros()
        onActualizar(actualizados)
      } catch {
        setAviso(
          "Cambios guardados, pero no se pudo actualizar la lista desde AWS."
        )
        return
      }

      onCancelar()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Editar miembro</CardTitle>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={guardarCambios}
          className="space-y-4"
        >
          {/* Nombre del miembro */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Nombre completo
            </label>

            <Input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
          </div>

          {/* Teléfono del miembro */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Teléfono
            </label>

            <Input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="10 dígitos"
              maxLength={10}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">
              {error}
            </p>
          )}

          {aviso && (
            <p className="text-sm text-amber-600">
              {aviso}
            </p>
          )}

          {/* Acciones del formulario */}
          <div className="flex gap-2">
            <Button type="submit" disabled={guardando}>
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={guardando}
              onClick={onCancelar}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
