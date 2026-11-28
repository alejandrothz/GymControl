
import { fetchAuthSession } from "aws-amplify/auth"

// API Gateway de GymControl en AWS Ohio
const API_URL = "https://ylgbc14oc4.execute-api.us-east-2.amazonaws.com"

// Obtener el token de acceso de Cognito
async function obtenerToken() {
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()

  if (!token) {
    throw new Error("No hay una sesión válida")
  }

  return token
}

// Interpretar las respuestas HTTP de API Gateway
async function procesarRespuesta(response) {
  const datos = await response.json()

  if (!response.ok) {
    throw new Error(
      datos.error || `Error HTTP ${response.status}`
    )
  }

  return datos
}

// Consultar miembros registrados
export async function obtenerMiembros() {
  const token = await obtenerToken()

  const response = await fetch(`${API_URL}/members`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  return procesarRespuesta(response)
}

// Registrar miembro
export async function registrarMiembro(nombre, telefono) {
  const token = await obtenerToken()

  const response = await fetch(`${API_URL}/members`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ nombre, telefono }),
  })

  return procesarRespuesta(response)
}

// Actualizar nombre y teléfono
export async function actualizarMiembro(memberId, nombre, telefono) {
  const token = await obtenerToken()

  const response = await fetch(
    `${API_URL}/members/${encodeURIComponent(memberId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ nombre, telefono }),
    }
  )

  return procesarRespuesta(response)
}

// Consultar el desglose oficial del cobro
export async function obtenerCotizacionPago(memberId) {
  const token = await obtenerToken()

  const response = await fetch(
    `${API_URL}/payments/quote?memberId=${encodeURIComponent(memberId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return procesarRespuesta(response)
}

// Registrar el pago usando el importe validado por AWS
export async function registrarPago(memberId, amountInCents, requestId) {
  const token = await obtenerToken()

  const response = await fetch(`${API_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      memberId,
      amountInCents,
      requestId,
    }),
  })

  return procesarRespuesta(response)
}

// Consultar el historial de pagos
export async function obtenerHistorialPagos(memberId) {
  const token = await obtenerToken()

  const response = await fetch(
    `${API_URL}/members/${encodeURIComponent(memberId)}/payments`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return procesarRespuesta(response)
}

// Consultar ingresos mensuales del gerente
export async function obtenerIngresosMensuales(mes) {
  const token = await obtenerToken()

  const response = await fetch(
    `${API_URL}/income/monthly?mes=${encodeURIComponent(mes)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  return procesarRespuesta(response)
}

 // Consultar los precios oficiales del gimnasio
 export async function obtenerPreciosGimnasio() {
   const token = await obtenerToken()

   const response = await fetch(`${API_URL}/settings/pricing`, {
     headers: {
       Authorization: `Bearer ${token}`,
     },
   })

   return procesarRespuesta(response)
 }

// Actualizar los precios oficiales del gimnasio desde el panel del gerente
export async function actualizarPreciosGimnasio(
  enrollmentFeeInCents,
  monthlyFeeInCents
) {
  const token = await obtenerToken()

  const response = await fetch(`${API_URL}/settings/pricing`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      enrollmentFeeInCents,
      monthlyFeeInCents,
    }),
  })

  return procesarRespuesta(response)
}
