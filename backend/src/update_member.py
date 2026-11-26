# importar boto 3 para comuncarnos con aws
import boto3

# Convertir los datos de Python a formato JSON
import json

# capturar erroes devueltos por AWS DynamoDB
from botocore.exceptions import ClientError

# conectar con DynamoDB en la region ohio
dynamodb = boto3.resource(
    "dynamodb",
    region_name = "us-east-2"
)

# seleccionar la tabla de miembros
tabla_miembros = dynamodb.Table("Members")

# validar que el nombre sea texto y no este vacio
def validar_nombre(nombre):

    #comprobar que el valor sea una cadena de texto
    if not isinstance(nombre, str):
        return False

    # Rechazar nombres vacios o que solo contengan espacios
    if not nombre.strip():
        return False

    return True

# validar el telefono del miembro
def validar_telefono(telefono):

    # permitir un telefono vacio
    if telefono == "":
        return True

    # Rechazar valores que no sean texto
    if not isinstance(telefono, str):
        return False

    # aceptar unicamente 10 digitos
    if len(telefono) != 10 or not telefono.isdigit():
        return False

    return True   

# Actualizar unicamente el nombre y el telefono de un miembro
def actualizar_miembro(member_id, nombre, telefono):

    # ejecutar la actualizacion en dynamo
    respuesta = tabla_miembros.update_item(
        Key = {"memberId": member_id},

        # definir los atributos que se actualizaran
        UpdateExpression = "SET fullName = :nombre, phone = :telefono",

        # Asignar os nuevos valores
        ExpressionAttributeValues = {
            ":nombre": nombre,
            ":telefono": telefono
        },

        # impedir la creacion accidental de miembros
        ConditionExpression = "attribute_exists(memberId)",

        # devolver los atributos actualizaods
        ReturnValues = "ALL_NEW"
    )

    return respuesta["Attributes"]

# Punto de entrada de AWS Lambda para acualizar miembros
def lambda_handler(event, context):

    # Obtener los datos enviados
    member_id = event.get("memberId")
    nombre = event.get("nombre")
    telefono = event.get("telefono", "")

    # vaalidar el identificador del miembro
    if not isinstance(member_id, str) or not member_id.strip():
        return {
            "statusCode": 400,
            "body": "ID del miembro invalido"
        }

    # validar el nombre y telefono
    if not validar_nombre(nombre) or not validar_telefono(telefono):
        return {
            "statusCode": 400,
            "body": "Nombre o telefono invalido"
        }

    # intentar actualizar el miembro y controlar si no existe
    try:
        miembro = actualizar_miembro(member_id, nombre.strip(), telefono)

    except ClientError as error:
        # DynamoDB rechazo la actualizacion porque fallo una condicion
        if error.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return {
                "statusCode": 404,
                "body": "Miembro no encontrado"
            }

        # propagar otros errores para poderdiagnosticarlos
        raise

# Devolver el miembro actualizado en formato JSON
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(miembro)
    }