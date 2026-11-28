
# Registrar pagos y renovar membresías mediante transacciones DynamoDB
import json
import uuid
import boto3

from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from boto3.dynamodb.types import TypeSerializer
from botocore.exceptions import ClientError

from renew_membership import calcular_renovacion

# Configuración de AWS
REGION = "us-east-2"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
cliente_dynamodb = boto3.client("dynamodb", region_name=REGION)

tabla_miembros = dynamodb.Table("Members")
serializador = TypeSerializer()


# Generar respuestas HTTP compatibles con API Gateway
def respuesta_http(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(contenido)
    }


def lambda_handler(event, context):

    # Leer el JSON recibido desde API Gateway o una prueba de Lambda
    try:
        datos = event.get("body", event)

        if isinstance(datos, str):
            datos = json.loads(datos)

        if not isinstance(datos, dict):
            raise ValueError("JSON invalido")

    except (ValueError, TypeError, AttributeError):
        return respuesta_http(400, {"error": "JSON invalido"})

    # Validar el identificador del miembro
    member_id = datos.get("memberId")

    if not isinstance(member_id, str) or not member_id.strip():
        return respuesta_http(400, {"error": "Miembro invalido"})

    # Validar el identificador único de la solicitud
    try:
        request_id = str(uuid.UUID(datos.get("requestId")))
    except (ValueError, TypeError, AttributeError):
        return respuesta_http(400, {"error": "requestId invalido"})

    # El monto se recibe como entero en centavos
    monto = datos.get("amountInCents")

    if (
        not isinstance(monto, int)
        or isinstance(monto, bool)
        or monto <= 0
    ):
        return respuesta_http(400, {"error": "Monto invalido"})

    # Buscar el miembro en DynamoDB
    miembro = tabla_miembros.get_item(
        Key={"memberId": member_id},
        ConsistentRead=True
    ).get("Item")

    if miembro is None:
        return respuesta_http(404, {"error": "Miembro no encontrado"})

    if miembro.get("isActive") is not True:
        return respuesta_http(403, {"error": "Miembro desactivado"})

    # Obtener la fecha actual de México
    ahora = datetime.now(ZoneInfo("America/Mexico_City"))
    fecha_pago = ahora.date()

    # Identificar si existe una membresía anterior
    vencimiento_anterior = miembro.get("membershipEndDate")

    if vencimiento_anterior:
        # Renovar una membresía existente
        try:
            fecha_vencimiento = date.fromisoformat(
                vencimiento_anterior
            )
        except (ValueError, TypeError):
            return respuesta_http(
                409,
                {"error": "Fecha de vencimiento invalida"}
            )

        nuevo_inicio, nuevo_fin = calcular_renovacion(
            fecha_vencimiento,
            fecha_pago
        )

        # Evitar sobrescribir una renovación simultánea
        condicion_vencimiento = "membershipEndDate = :vencimiento"
        valores_vencimiento = {
            ":vencimiento": serializador.serialize(
                vencimiento_anterior
            )
        }

    else:
        # Primer pago: generar los primeros 30 días
        nuevo_inicio = fecha_pago
        nuevo_fin = fecha_pago + timedelta(days=29)

        # Asegurar que sigue sin existir un vencimiento
        condicion_vencimiento = (
            "attribute_not_exists(membershipEndDate)"
        )
        valores_vencimiento = {}

    # Preparar el registro del pago
    pago = {
        "memberId": member_id,
        "paymentId": request_id,
        "paymentKey": request_id,
        "amountInCents": monto,
        "paidAt": ahora.isoformat(),
        "periodStart": nuevo_inicio.isoformat(),
        "periodEnd": nuevo_fin.isoformat(),
        "paymentMonth": ahora.strftime("%Y-%m")
    }

    pago_dynamodb = {
        clave: serializador.serialize(valor)
        for clave, valor in pago.items()
    }

    # Operación 1: guardar el pago
    operacion_pago = {
        "Put": {
            "TableName": "Payments",
            "Item": pago_dynamodb,
            "ConditionExpression": (
                "attribute_not_exists(memberId)"
            )
        }
    }

    # Operación 2: actualizar la membresía
    operacion_miembro = {
        "Update": {
            "TableName": "Members",
            "Key": {
                "memberId": serializador.serialize(member_id)
            },
            "UpdateExpression": (
                "SET membershipStartDate = :inicio, "
                "membershipEndDate = :fin"
            ),
            "ConditionExpression": (
                "attribute_exists(memberId) AND "
                "isActive = :activo AND "
                + condicion_vencimiento
            ),
            "ExpressionAttributeValues": {
                ":inicio": serializador.serialize(
                    nuevo_inicio.isoformat()
                ),
                ":fin": serializador.serialize(
                    nuevo_fin.isoformat()
                ),
                ":activo": serializador.serialize(True),
                **valores_vencimiento
            }
        }
    }

    # Ejecutar ambas operaciones de forma atómica
    try:
        cliente_dynamodb.transact_write_items(
            TransactItems=[
                operacion_pago,
                operacion_miembro
            ]
        )

    except ClientError as error:
        codigo = error.response["Error"]["Code"]

        if codigo == "TransactionCanceledException":
            return respuesta_http(
                409,
                {
                    "error": (
                        "No se pudo registrar el pago. "
                        "Verifica si ya existe o si la membresia cambio."
                    )
                }
            )

        raise

    # Respuesta exitosa
    return respuesta_http(
        201,
        {
            "mensaje": "Pago registrado correctamente",
            "memberId": member_id,
            "paymentId": request_id,
            "nuevoInicio": nuevo_inicio.isoformat(),
            "nuevoFin": nuevo_fin.isoformat()
        }
    )
