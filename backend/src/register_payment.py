# importamos librerias de aws para conectar a dynamodb

import boto3
#herramienta para generar identificadores unicos
import uuid

# Convertir datos de Python al formato requerido por DynamoDB
from boto3.dynamodb.types import TypeSerializer

#manejar errores devueltos por los servicios de aws
from botocore.exceptions import ClientError

#importamos la funcion calcular_renovacion de renew membership
from renew_membership import calcular_renovacion
from datetime import date, datetime
from zoneinfo import ZoneInfo

dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
# cliente de dynamodb para ejecutar transacciones atomicas
cliente_dynamodb = boto3.client("dynamodb", region_name="us-east-2")

# Crear el serializador para las operaciones de DynamoDB
serializador = TypeSerializer()

tabla_miembros = dynamodb.Table("Members")

# referencia de la tabla que almacena el historial de pagos
tabla_pagos = dynamodb.Table("Payments")

# validamos que el motno sea un numero entero positivo y que el member_id sea un string no vacio

def validar_monto (monto):
    if not isinstance(monto, int) or isinstance(monto, bool):
        return False

    if monto <= 0:
        return False

    return True

#validamos que el member_id sea un string no vacio

def validar_miembro(member_id):
    if not isinstance(member_id,str):
        return False
    if not member_id.strip():
        return False

    return True

# obtenemos el miembro de la tabla de dynamodb dado un member_id
def obtener_miembro(member_id):
    respuesta = tabla_miembros.get_item(
        Key={"memberId": member_id}
    )
    return respuesta.get("Item")

# lambda de de aws que valida que el member_id sea valido y que exista en la tabla de dynamodb

def lambda_handler(event, context):
    member_id = event.get("memberId")

    # validamos que el member_id sea un string no vacio, si no lo es retornamos un error 400
    if not validar_miembro(member_id):
        return {
            "statusCode": 400,
            "body": "El id del miembro es invalido"
        }
    miembro = obtener_miembro(member_id)

    #validar el identificador unico de la solicitud de pago
    request_id = event.get("requestId")

    try:
        request_id = str(uuid.UUID(request_id))
    except (ValueError, TypeError, AttributeError):
        return {
            "statusCode": 400,
            "body": "El identificador de la solicitus es invalido"
        }

    # obtenemos el monto enviado a lambda y validamos que sea un numero entero positivo
    monto = event.get("amountInCents")

    # obtiene el importe enviado a lambda
    if not validar_monto(monto):
        return {
            "statusCode": 400,
            "body": "El monto es invalido"
        }

    # obtiene el miembro de la tabla de dynamodb y valida que exista, si no existe retorna un error 404
    if miembro is None:
        return {
            "statusCode": 404,
            "body": "Miembro no encontrado"
        }

    #obtiene el estado del miembro y valida que este activo, si no lo esta retorna un error 403
    if miembro.get("isActive") is not True:
        return {
            "statusCode": 403,
            "body": "El miembro esta desactivado"
        }

    # obtenemos la fecha de pago y la fecha de vencimiento del miembro, 
    # y llamamos a la funcion calcular_renovacion para obtener las nuevas 
    # fechas de inicio y fin de la membresia

    #fecha actual de zacatecas mex
    fecha_pago = datetime.now(ZoneInfo("America/Mexico_City")).date()

    fecha_vencimiento = date.fromisoformat(miembro["membershipEndDate"])

    # calcular el inicio y vencimiento de la nueva membresia
    nuevo_inicio, nuevo_fin = calcular_renovacion(fecha_vencimiento, fecha_pago)

    # Reutilizar el identificador de la solicitud en cada intento
    payment_id = request_id

    # crear una clave que permita ordenar los pagos por fecha
    fecha_hora_pago = datetime.now(ZoneInfo("America/Mexico_City"))

    # Clave estable para identificar el pago y sus reintentos
    payment_key = payment_id

    # preparar los datos del pago para DynamoDB
    pago = {
        "memberId": member_id,
        "paymentId": payment_id,
        "paymentKey": payment_key,
        "amountInCents": monto,
        "paidAt": fecha_hora_pago.isoformat(),
        "periodStart": nuevo_inicio.isoformat(),
        "periodEnd": nuevo_fin.isoformat(),
        "paymentMonth": fecha_hora_pago.strftime("%Y-%m")
    }

    # convertir los atributos del pago al formato de DyanmoDB
    pago_dynamodb = {clave: serializador.serialize(valor) for clave, valor in pago.items()}

    # Preparar la operacion de registro del pago en dynamodb
    operacion_pago = {
        "Put": {
            "TableName": "Payments",
            "Item": pago_dynamodb,
            "ConditionExpression": "attribute_not_exists(memberId)"
        }
    }

    # Preparar la actualizacion de las fechas de membresia

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
            # evitar acutalizar miembros inexistentes, desactivados o modificados
            "ConditionExpression": (
                "attribute_exists(memberId) AND "
                "membershipEndDate = :vencimiento AND "
                "isActive = :activo"
            ),
            "ExpressionAttributeValues": {
                ":inicio": serializador.serialize(nuevo_inicio.isoformat()),
                ":fin": serializador.serialize(nuevo_fin.isoformat()),
                ":vencimiento": serializador.serialize(
                    fecha_vencimiento.isoformat()
                ),
                ":activo": serializador.serialize(True)
            }
        }
    }

    #ejecutar el registro del pago y la renocacion en una sola transaccion.
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
            return {
                "statusCode": 409,
                "body": "No se pudo completar la renovacion, verifica el estado del miembro"
            }
        raise

# Confirmar que el pago se registro y la membresia se renovo
    return {
    "statusCode": 200,
    "body": {
        "mensaje": "Pago registrado y membresia renovada correctamente",
        "memberId": member_id,
        "paymentId": payment_id,
        "nuevoInicio": nuevo_inicio.isoformat(),
        "nuevoFin": nuevo_fin.isoformat()
    }
}