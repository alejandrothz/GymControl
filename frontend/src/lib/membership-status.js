
// Calcular automáticamente el estado de una membresía
// sin modificar los registros de DynamoDB

const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000

// Convertir una fecha YYYY-MM-DD a un número de día
function numeroDeDia(fecha) {
  if (typeof fecha !== "string") return null

  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha)
  if (!partes) return null

  const [, anio, mes, dia] = partes.map(Number)
  const timestamp = Date.UTC(anio, mes - 1, dia)
  const comprobacion = new Date(timestamp)

  if (
    comprobacion.getUTCFullYear() !== anio ||
    comprobacion.getUTCMonth() !== mes - 1 ||
    comprobacion.getUTCDate() !== dia
  ) {
    return null
  }

  return Math.floor(timestamp / MILISEGUNDOS_DIA)
}

// Obtener el día actual sin depender de la hora
function diaActual() {
  const ahora = new Date()

  return numeroDeDia(
    [
      ahora.getFullYear(),
      String(ahora.getMonth() + 1).padStart(2, "0"),
      String(ahora.getDate()).padStart(2, "0"),
    ].join("-")
  )
}

// Obtener uno de los cuatro estados de GymControl
export function obtenerEstadoMembresia(miembro) {
  const vencimiento = miembro.membershipEndDate

  if (!vencimiento) {
    return "Sin membresía"
  }

  const diaVencimiento = numeroDeDia(vencimiento)

  if (diaVencimiento === null) {
    return "Sin membresía"
  }

  const diasDesdeVencimiento = diaActual() - diaVencimiento

  if (diasDesdeVencimiento <= 0) {
    return "Vigente"
  }

  if (diasDesdeVencimiento <= 90) {
    return "Vencida"
  }

  return "Inactivo"
}
