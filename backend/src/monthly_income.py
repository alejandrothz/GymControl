
# Consultar ingresos mensuales: acceso exclusivo para Gerente
import json
import re
import boto3

from datetime import datetime
from boto3.dynamodb.conditions import Key

# Conexión con DynamoDB en AWS Ohio
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla_pagos = dynamodb.Table("Payments")


# Crear respuestas HTTP para API Gateway
def respuesta_http(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(contenido)
    }


# Comprobar los grupos autenticados por Cognito
def es_gerente(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    grupos = claims.get("cognito:groups", [])

    # Los grupos pueden llegar como lista o texto
    if isinstance(grupos, str):
        try:
            grupos = json.loads(grupos)
        except json.JSONDecodeError:
            grupos = grupos.strip("[]").split(",")

    if not isinstance(grupos, list):
        return False

    return "Gerente" in [
        grupo.strip().strip('"').strip("'")
        for grupo in grupos
        if isinstance(grupo, str)
    ]


# Consultar todos los pagos de un mes mediante el GSI
def obtener_ingresos_mensuales(mes):
    total = 0
    cantidad_pagos = 0

    parametros = {
        "IndexName": "PaymentMonthIndex",
        "KeyConditionExpression": Key("paymentMonth").eq(mes),
        "ProjectionExpression": "amountInCents"
    }

    while True:
        respuesta = tabla_pagos.query(**parametros)

        for pago in respuesta.get("Items", []):
            total += int(pago["amountInCents"])
            cantidad_pagos += 1

        # Continuar si DynamoDB tiene más resultados
        ultima_clave = respuesta.get("LastEvaluatedKey")

        if not ultima_clave:
            break

        parametros["ExclusiveStartKey"] = ultima_clave

    return {
        "mes": mes,
        "cantidadPagos": cantidad_pagos,
        "totalInCents": total
    }


# Función principal de AWS Lambda
def lambda_handler(event, context):

    # Verificar autorización antes de consultar DynamoDB
    if not es_gerente(event):
        return respuesta_http(
            403,
            {"error": "Acceso exclusivo para gerentes"}
        )

    # Obtener el mes desde la URL de API Gateway
    parametros = event.get("queryStringParameters") or {}
    mes = parametros.get("mes")

    # Validar el formato YYYY-MM
    if not isinstance(mes, str) or not re.fullmatch(
        r"\d{4}-(0[1-9]|1[0-2])", mes
    ):
        return respuesta_http(
            400,
            {"error": "El mes debe tener formato YYYY-MM"}
        )

    try:
        datetime.strptime(mes, "%Y-%m")
    except ValueError:
        return respuesta_http(
            400,
            {"error": "Mes invalido"}
        )

    # Consultar ingresos mediante PaymentMonthIndex
    resultado = obtener_ingresos_mensuales(mes)

    return respuesta_http(200, resultado)
