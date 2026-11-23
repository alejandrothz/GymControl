# Importar boto3 para comunicarnos con los servicios de AWS
import boto3

# convertir las respuestas de python a json
import json

# Conectar con Dynamo en la región ohio
dynamodb = boto3.resource(
    "dynamodb",
    region_name = "us-east-2"
)

# Seleccionar la tabla donde guardamos los pagos
tabla_pagos = dynamodb.Table("Payments")

# Importar la herramienta para crear condiciones de busqueda

from boto3.dynamodb.conditions import Key

# Consultar el historial de pagos de un miembro
def obtener_pagos(member_id):
    respuesta = tabla_pagos.query(
        KeyConditionExpression = Key("memberId").eq(member_id)
    )

    # obtener los pagos encontrados
    pagos = respuesta.get("Items", [])

    # ordenar del pago más reciente al más antiguo
    pagos.sort(key = lambda pago: pago["paidAt"], reverse = True)

    return respuesta.get("Items", [])

# punto de entrada de aws lambda para consultar el historial de pagos
def lambda_handler(event, context):

    # obtener el identificador del miembro
    member_id = event.get("memberId")

    # Validar que el identificador sea texto y no esté vacío
    if not isinstance(member_id, str) or not member_id.strip():
        return {
            "statusCode": 400,
            "body": "El ID el miembro es invalido"
        }

    # consultar los pagos del miembro en dynamodb
    pagos = obtener_pagos(member_id)

    # convertir el importe de decimal a entero para la respuesta JSON
    for pago in pagos:
        pago["amountInCents"] = int(pago["amountInCents"])
        
    # devolver el historial encontrado
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(pagos, default=str)
    }