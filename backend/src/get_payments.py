
# Consultar el historial de pagos de un miembro mediante API Gateway
import boto3
import json

from boto3.dynamodb.conditions import Key

# Conexión con DynamoDB en AWS Ohio
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla_pagos = dynamodb.Table("Payments")


# Crear respuestas HTTP compatibles con API Gateway
def respuesta_http(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(contenido, default=str)
    }


# Consultar los pagos registrados de un miembro
def obtener_pagos(member_id):
    pagos = []

    # Consultar las páginas de resultados de DynamoDB
    parametros = {
        "KeyConditionExpression": Key("memberId").eq(member_id)
    }

    while True:
        respuesta = tabla_pagos.query(**parametros)
        pagos.extend(respuesta.get("Items", []))

        ultima_clave = respuesta.get("LastEvaluatedKey")

        if not ultima_clave:
            break

        parametros["ExclusiveStartKey"] = ultima_clave

    # Ordenar los pagos del más reciente al más antiguo
    pagos.sort(
        key=lambda pago: pago.get("paidAt", ""),
        reverse=True
    )

    # Convertir los montos a enteros para JSON
    for pago in pagos:
        pago["amountInCents"] = int(pago["amountInCents"])

    return pagos


# Punto de entrada de AWS Lambda
def lambda_handler(event, context):

    # Obtener memberId de la URL enviada por API Gateway
    parametros = event.get("pathParameters") or {}

    member_id = parametros.get(
        "memberId",
        event.get("memberId")
    )

    # Validar el identificador
    if not isinstance(member_id, str) or not member_id.strip():
        return respuesta_http(
            400,
            {"error": "El ID del miembro es invalido"}
        )

    # Consultar el historial de pagos en DynamoDB
    pagos = obtener_pagos(member_id)

    # Devolver los resultados a React
    return respuesta_http(200, pagos)
