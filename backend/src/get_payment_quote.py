
# GymControl: consultar el importe que debe pagar un miembro
# Permite cotizar renovaciones independientemente de isActive

import json
import boto3

from decimal import Decimal
from boto3.dynamodb.conditions import Key

# Conexión con DynamoDB en AWS Ohio
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")

tabla_miembros = dynamodb.Table("Members")
tabla_pagos = dynamodb.Table("Payments")
tabla_configuracion = dynamodb.Table("GymSettings")


# Crear respuestas compatibles con API Gateway
def responder(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(contenido)
    }


# Consultar si el miembro tiene pagos anteriores
def tiene_pagos(member_id):
    respuesta = tabla_pagos.query(
        KeyConditionExpression=Key("memberId").eq(member_id),
        Select="COUNT",
        Limit=1,
        ConsistentRead=True
    )

    return respuesta["Count"] > 0


# Validar precios enteros en centavos
def validar_precio(valor, permitir_cero=False):
    return (
        isinstance(valor, Decimal)
        and valor.is_finite()
        and valor == valor.to_integral_value()
        and (valor >= 0 if permitir_cero else valor > 0)
    )


# Punto de entrada de Lambda
def lambda_handler(event, context):

    # Obtener el identificador desde la URL
    parametros = event.get("queryStringParameters") or {}
    member_id = parametros.get("memberId")

    if not isinstance(member_id, str) or not member_id.strip():
        return responder(400, {"error": "memberId invalido"})

    member_id = member_id.strip()

    # Consultar miembro
    miembro = tabla_miembros.get_item(
        Key={"memberId": member_id},
        ConsistentRead=True
    ).get("Item")

    if not miembro:
        return responder(404, {"error": "Miembro no encontrado"})

    # No bloquear por isActive.
    # El estado Vigente, Vencida o Inactivo depende de
    # membershipEndDate y no impide solicitar una cotización.

    # Consultar precios oficiales
    configuracion = tabla_configuracion.get_item(
        Key={"settingId": "membership-pricing"},
        ConsistentRead=True
    ).get("Item")

    if not configuracion:
        return responder(500, {"error": "Precios no configurados"})

    inscripcion = configuracion.get("enrollmentFeeInCents")
    mensualidad = configuracion.get("monthlyFeeInCents")

    if not (
        validar_precio(inscripcion, permitir_cero=True)
        and validar_precio(mensualidad)
    ):
        return responder(500, {"error": "Precios invalidos"})

    # Determinar si corresponde cobrar inscripción
    inscripcion_pagada = (
        miembro.get("enrollmentPaid") is True
        or bool(miembro.get("membershipEndDate"))
        or tiene_pagos(member_id)
    )

    cobro_inscripcion = 0 if inscripcion_pagada else int(inscripcion)
    cobro_mensualidad = int(mensualidad)

    # Devolver desglose para mostrar en React
    return responder(
        200,
        {
            "memberId": member_id,
            "enrollmentFeeInCents": cobro_inscripcion,
            "membershipFeeInCents": cobro_mensualidad,
            "totalInCents": cobro_inscripcion + cobro_mensualidad,
            "paymentType": (
                "RENEWAL" if inscripcion_pagada else "FIRST_PAYMENT"
            )
        }
    )
