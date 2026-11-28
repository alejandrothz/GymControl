
import { fetchAuthSession } from "aws-amplify/auth"

// Dirección de API Gateway en AWS Ohio
const API_URL = "https://ylgbc14oc4.execute-api.us-east-2.amazonaws.com"

// Obtener el token de Cognito
async function obtenerToken() {
  const session = await fetchAuthSession()
  const token = session.tokens?.accessToken?.toString()

  if (!token) {
    throw new Error("No hay una sesión válida")
  }

  return token
}

// Consultar miembros registrados en DynamoDB
export async function obtenerMiembros() {
  const token = await obtenerToken()

  const response = await fetch(`${API_URL}/members`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Error al consultar miembros: ${response.status}`)
  }

  return response.json()
}

// Registrar un miembro mediante API Gateway y Lambda
export async function registrarMiembro(nombre, telefono) {
  const token = await obtenerToken()

  const response = await fetch(`${API_URL}/members`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      nombre,
      telefono,
    }),
  })

  const resultado = await response.json()

  if (!response.ok) {
    throw new Error(
      resultado.error || `Error al registrar miembro: ${response.status}`
    )
  }

  return resultado
}


 // Registrar un pago en AWS mediante API Gateway
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

   const resultado = await response.json()

   if (!response.ok) {
     throw new Error(
       resultado.error || `Error al registrar pago: ${response.status}`
     )
   }

   return resultado
 }

 // Consultar el historial de pagos de un miembro en AWS
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

   if (!response.ok) {
     throw new Error(`Error al consultar historial: ${response.status}`)
   }

   return response.json()
 }

 // Consultar ingresos mensuales desde API Gateway
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

   const resultado = await response.json()

   if (!response.ok) {
     throw new Error(
       resultado.error || `Error HTTP ${response.status}`
     )
   }

   return resultado
 }
