
# GymControl - Actualizar precios del gimnasio
# Operación exclusiva para usuarios del grupo Gerente

import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla = dynamodb.Table("GymSettings")


def responder(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(contenido)
    }


def lambda_handler(event, context):
    # Obtener los grupos del usuario autenticado
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    grupos = claims.get("cognito:groups", [])

    if isinstance(grupos, str):
        grupos = [
            grupo.strip().strip('"').strip("'")
            for grupo in grupos.strip("[]").split(",")
        ]

    if "Gerente" not in grupos:
        return responder(403, {"error": "Acceso denegado"})

    # Leer los datos enviados por React
    try:
        body = json.loads(event.get("body") or "{}")

        inscripcion = body["enrollmentFeeInCents"]
        mensualidad = body["monthlyFeeInCents"]

        # Validar precios como enteros expresados en centavos
        if (
            type(inscripcion) is not int
            or type(mensualidad) is not int
            or inscripcion < 0
            or mensualidad <= 0
        ):
            return responder(400, {"error": "Precios invalidos"})

    except (ValueError, TypeError, KeyError):
        return responder(400, {"error": "Datos invalidos"})

    # Actualizar exclusivamente los dos precios
    tabla.update_item(
        Key={"settingId": "membership-pricing"},
        UpdateExpression=(
            "SET enrollmentFeeInCents = :inscripcion, "
            "monthlyFeeInCents = :mensualidad"
        ),
        ConditionExpression="attribute_exists(settingId)",
        ExpressionAttributeValues={
            ":inscripcion": Decimal(inscripcion),
            ":mensualidad": Decimal(mensualidad)
        }
    )

    return responder(
        200,
        {
            "message": "Precios actualizados",
            "enrollmentFeeInCents": inscripcion,
            "monthlyFeeInCents": mensualidad
        }
    )
