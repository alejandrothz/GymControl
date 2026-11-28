
# GymControl: registrar pagos con inscripción y mensualidad
# Permite renovar membresías sin bloquear por el atributo isActive

import json
import uuid
import boto3

from datetime import datetime, date, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo
from boto3.dynamodb.types import TypeSerializer
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from renew_membership import calcular_renovacion


# Configuración de DynamoDB
REGION = "us-east-2"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
cliente = boto3.client("dynamodb", region_name=REGION)
serializador = TypeSerializer()

tabla_miembros = dynamodb.Table("Members")
tabla_pagos = dynamodb.Table("Payments")
tabla_configuracion = dynamodb.Table("GymSettings")


# Crear respuestas HTTP compatibles con API Gateway
def responder(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(contenido)
    }


# Consultar los precios oficiales del gimnasio
def obtener_precios():
    respuesta = tabla_configuracion.get_item(
        Key={"settingId": "membership-pricing"},
        ConsistentRead=True
    )

    configuracion = respuesta.get("Item")

    if not configuracion:
        raise ValueError("No existe configuracion de precios")

    inscripcion = configuracion.get("enrollmentFeeInCents")
    mensualidad = configuracion.get("monthlyFeeInCents")

    # DynamoDB devuelve valores numéricos como Decimal
    if (
        not isinstance(inscripcion, Decimal)
        or not isinstance(mensualidad, Decimal)
        or not inscripcion.is_finite()
        or not mensualidad.is_finite()
        or inscripcion != inscripcion.to_integral_value()
        or mensualidad != mensualidad.to_integral_value()
        or inscripcion < 0
        or mensualidad <= 0
    ):
        raise ValueError("Configuracion de precios invalida")

    return int(inscripcion), int(mensualidad)


# Comprobar si un miembro tiene pagos anteriores
def tiene_pagos_anteriores(member_id):
    respuesta = tabla_pagos.query(
        KeyConditionExpression=Key("memberId").eq(member_id),
        Select="COUNT",
        Limit=1,
        ConsistentRead=True
    )

    return respuesta["Count"] > 0


# Convertir valores al formato de DynamoDB
def atributo(valor):
    return serializador.serialize(valor)


# Función principal de registro de pagos
def lambda_handler(event, context):

    # Leer los datos enviados por API Gateway
    try:
        datos = event.get("body", event)

        if isinstance(datos, str):
            datos = json.loads(datos)

        if not isinstance(datos, dict):
            raise ValueError("JSON invalido")

    except (ValueError, TypeError, AttributeError):
        return responder(
            400,
            {"error": "JSON invalido"}
        )

    # Obtener identificadores del pago y del miembro
    member_id = datos.get("memberId")
    request_id = datos.get("requestId")

    # Validar identificador del miembro
    if not isinstance(member_id, str) or not member_id.strip():
        return responder(
            400,
            {"error": "Miembro invalido"}
        )

    member_id = member_id.strip()

    # Validar identificador único de la solicitud
    try:
        request_id = str(uuid.UUID(request_id))
    except (ValueError, TypeError, AttributeError):
        return responder(
            400,
            {"error": "requestId invalido"}
        )

    # Consultar el miembro en DynamoDB
    miembro = tabla_miembros.get_item(
        Key={"memberId": member_id},
        ConsistentRead=True
    ).get("Item")

    if not miembro:
        return responder(
            404,
            {"error": "Miembro no encontrado"}
        )

    # No bloquear pagos usando isActive.
    # La vigencia se calcula a partir de membershipEndDate.
    # Un miembro con membresía vencida o inactiva puede renovar.

    # Obtener precios oficiales desde GymSettings
    try:
        precio_inscripcion, precio_mensualidad = obtener_precios()
    except ValueError:
        return responder(
            500,
            {"error": "Configuracion de precios no disponible"}
        )

    # Consultar el estado de inscripción del miembro
    vencimiento_anterior = miembro.get("membershipEndDate")
    estado_inscripcion = miembro.get("enrollmentPaid")

    # Respetar miembros antiguos:
    # si ya tuvieron una membresía o pagos, no cobrar otra inscripción
    if estado_inscripcion is True:
        inscripcion_cubierta = True
    elif vencimiento_anterior:
        inscripcion_cubierta = True
    elif tiene_pagos_anteriores(member_id):
        inscripcion_cubierta = True
    else:
        inscripcion_cubierta = False

    # Calcular el desglose del pago
    cobro_inscripcion = (
        0 if inscripcion_cubierta else precio_inscripcion
    )

    cobro_mensualidad = precio_mensualidad
    total = cobro_inscripcion + cobro_mensualidad

    # Validar el importe enviado desde React, si existe
    monto_enviado = datos.get("amountInCents")

    if monto_enviado is not None:
        if (
            type(monto_enviado) is not int
            or monto_enviado != total
        ):
            return responder(
                409,
                {
                    "error": (
                        "El importe no coincide con los precios "
                        "actuales del gimnasio"
                    ),
                    "expectedAmountInCents": total
                }
            )

    # Obtener fecha y hora actual de México
    ahora = datetime.now(ZoneInfo("America/Mexico_City"))
    fecha_pago = ahora.date()

    # Calcular el periodo de membresía
    if vencimiento_anterior:
        try:
            fecha_vencimiento = date.fromisoformat(
                vencimiento_anterior
            )
        except (ValueError, TypeError):
            return responder(
                409,
                {"error": "Vencimiento anterior invalido"}
            )

        # Renovar una membresía con fechas existentes
        nuevo_inicio, nuevo_fin = calcular_renovacion(
            fecha_vencimiento,
            fecha_pago
        )

        # Evitar sobrescribir una renovación simultánea
        condicion_fecha = "membershipEndDate = :anterior"

        valores_fecha = {
            ":anterior": atributo(vencimiento_anterior)
        }

    else:
        # Primer pago: crear 30 días desde la fecha de pago
        nuevo_inicio = fecha_pago
        nuevo_fin = fecha_pago + timedelta(days=29)

        condicion_fecha = (
            "attribute_not_exists(membershipEndDate)"
        )

        valores_fecha = {}

    # Verificar el estado previo de la inscripción
    if "enrollmentPaid" in miembro:
        condicion_inscripcion = (
            "enrollmentPaid = :estadoAnterior"
        )

        valores_inscripcion = {
            ":estadoAnterior": atributo(estado_inscripcion)
        }

    else:
        condicion_inscripcion = (
            "attribute_not_exists(enrollmentPaid)"
        )

        valores_inscripcion = {}

    # Construir el registro del pago
    pago = {
        "memberId": member_id,
        "paymentId": request_id,
        "paymentKey": request_id,
        "amountInCents": total,
        "enrollmentFeeInCents": cobro_inscripcion,
        "membershipFeeInCents": cobro_mensualidad,
        "paymentType": (
            "FIRST_PAYMENT"
            if not inscripcion_cubierta
            else "RENEWAL"
        ),
        "paidAt": ahora.isoformat(),
        "periodStart": nuevo_inicio.isoformat(),
        "periodEnd": nuevo_fin.isoformat(),
        "paymentMonth": ahora.strftime("%Y-%m")
    }

    # Operación 1: guardar el pago en Payments
    operacion_pago = {
        "Put": {
            "TableName": "Payments",
            "Item": {
                clave: atributo(valor)
                for clave, valor in pago.items()
            },
            "ConditionExpression": (
                "attribute_not_exists(memberId)"
            )
        }
    }

    # Operación 2: actualizar la membresía en Members
    operacion_miembro = {
        "Update": {
            "TableName": "Members",
            "Key": {
                "memberId": atributo(member_id)
            },
            "UpdateExpression": (
                "SET membershipStartDate = :inicio, "
                "membershipEndDate = :fin, "
                "enrollmentPaid = :pagada"
            ),
            "ConditionExpression": (
                "attribute_exists(memberId) AND "
                + condicion_fecha + " AND "
                + condicion_inscripcion
            ),
            "ExpressionAttributeValues": {
                ":inicio": atributo(nuevo_inicio.isoformat()),
                ":fin": atributo(nuevo_fin.isoformat()),
                ":pagada": atributo(True),
                **valores_fecha,
                **valores_inscripcion
            }
        }
    }

    # Ejecutar las operaciones de forma atómica
    try:
        cliente.transact_write_items(
            TransactItems=[
                operacion_pago,
                operacion_miembro
            ]
        )

    except ClientError as error:
        codigo = error.response["Error"]["Code"]

        if codigo == "TransactionCanceledException":
            return responder(
                409,
                {
                    "error": (
                        "El pago ya existe o la membresia cambio. "
                        "Verifica el historial antes de repetirlo."
                    )
                }
            )

        # Propagar errores inesperados para revisarlos en CloudWatch
        raise

    # Confirmar que el pago fue registrado correctamente
    return responder(
        201,
        {
            "mensaje": "Pago registrado correctamente",
            "memberId": member_id,
            "paymentId": request_id,
            "enrollmentFeeInCents": cobro_inscripcion,
            "membershipFeeInCents": cobro_mensualidad,
            "amountInCents": total,
            "nuevoInicio": nuevo_inicio.isoformat(),
            "nuevoFin": nuevo_fin.isoformat()
        }
    )
