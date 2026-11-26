# importar boto3 para comunicarnos con AWS
import boto3

# Convertir datos de Python a formato JSON
import json

# Capturar errores de AWS DynamoDB
from botocore.exceptions import ClientError

# conectar con DynamoDB en la region ohio
dynamodb = boto3.resource(
    "dynamodb",
    region_name = "us-east-2"
)

# seleccionar la tabla de miembros
tabla_miembros = dynamodb.Table("Members")

# Desactivar un miembro sin eliminar datos
def desactivar_miembro(member_id):

    # cambiar unicamente el estado isActive a False
    respuesta = tabla_miembros.update_item(
        Key = {"memberId": member_id},

        UpdateExpression = "SET isActive = :estado",

        ExpressionAttributeValues = {
            ":estado": False
        },

        # evitar crear un miembro inexistente
        ConditionExpression = "attribute_exists(memberId)",

        # devolver los datos actualizados
        ReturnValues = "ALL_NEW"
    )

    return respuesta["Attributes"]

# punto de coneccion de aws lambda para desactivar miembros
def lambda_handler(event, context):

    # obtener el id del miembro enviado a lambda
    member_id = event.get("memberId")

    # validar que el ID sea texto y no este vacio
    if not isinstance(member_id,str) or not member_id.strip():
        return {
            "statusCode": 400,
            "body": "ID del miembro invalido"
        }

    # Intentar desactivar el miembro y manejar posibles errores
    try:
        miembro = desactivar_miembro(member_id)

    except ClientError as error:

        # El miembro no existe en DynamoDB
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {
                "statusCode": 404,
                "body": "Miembro no encontrado"
        }

        # Mostrar otros errores para diagnosticarlos
        raise

    # devolver los datos del miembro desactivado en json
    return {
    "statusCode": 200,
    "headers": {
        "Content-Type": "application/json"
    },
    "body": json.dumps(miembro)
}