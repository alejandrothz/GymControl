
# GymControl: consultar la configuración de precios del gimnasio
import json
import boto3

from decimal import Decimal

# Conectar con DynamoDB en AWS Ohio
dynamodb = boto3.resource(
    "dynamodb",
    region_name="us-east-2"
)

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


# Comprobar si el usuario pertenece al grupo Gerente
def es_gerente(event):
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

    return isinstance(grupos, list) and "Gerente" in grupos


# Validar que los precios sean enteros en centavos
def precio_valido(valor, permitir_cero=False):
    return (
        isinstance(valor, Decimal)
        and valor.is_finite()
        and valor == valor.to_integral_value()
        and (valor >= 0 if permitir_cero else valor > 0)
    )


# Función principal de Lambda
def lambda_handler(event, context):

    # Verificar permisos antes de consultar DynamoDB
    if not es_gerente(event):
        return responder(
            403,
            {"error": "Acceso exclusivo para gerentes"}
        )

    # Obtener los precios oficiales
    respuesta = tabla_configuracion.get_item(
        Key={"settingId": "membership-pricing"},
        ConsistentRead=True
    )

    configuracion = respuesta.get("Item")

    if not configuracion:
        return responder(
            404,
            {"error": "Configuracion de precios no encontrada"}
        )

    inscripcion = configuracion.get("enrollmentFeeInCents")
    mensualidad = configuracion.get("monthlyFeeInCents")

    # Validar los precios de DynamoDB
    if not (
        precio_valido(inscripcion, permitir_cero=True)
        and precio_valido(mensualidad)
    ):
        return responder(
            500,
            {"error": "Configuracion de precios invalida"}
        )

    # Enviar precios al panel del gerente
    return responder(
        200,
        {
            "enrollmentFeeInCents": int(inscripcion),
            "monthlyFeeInCents": int(mensualidad)
        }
    )
