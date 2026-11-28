
# Actualizar nombre y teléfono de miembros mediante API Gateway
import boto3
import json

from botocore.exceptions import ClientError

# Conexión con DynamoDB en AWS Ohio
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla_miembros = dynamodb.Table("Members")


# Construir respuestas HTTP compatibles con API Gateway
def respuesta_http(codigo, contenido):
    return {
        "statusCode": codigo,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(contenido, default=str)
    }


# Validar nombre del miembro
def validar_nombre(nombre):
    return isinstance(nombre, str) and bool(nombre.strip())


# Validar teléfono: vacío o exactamente 10 dígitos
def validar_telefono(telefono):
    if not isinstance(telefono, str):
        return False

    return telefono == "" or (
        len(telefono) == 10 and telefono.isdigit()
    )


# Actualizar solamente nombre y teléfono
def actualizar_miembro(member_id, nombre, telefono):
    respuesta = tabla_miembros.update_item(
        Key={"memberId": member_id},

        UpdateExpression=(
            "SET fullName = :nombre, phone = :telefono"
        ),

        ExpressionAttributeValues={
            ":nombre": nombre,
            ":telefono": telefono
        },

        # Impedir actualizar miembros inexistentes
        ConditionExpression="attribute_exists(memberId)",

        ReturnValues="ALL_NEW"
    )

    return respuesta["Attributes"]


# Punto de entrada de AWS Lambda
def lambda_handler(event, context):

    # Obtener ID de la URL de API Gateway
    parametros = event.get("pathParameters") or {}
    member_id = parametros.get("memberId", event.get("memberId"))

    if not isinstance(member_id, str) or not member_id.strip():
        return respuesta_http(
            400,
            {"error": "ID del miembro invalido"}
        )

    # Leer los datos enviados desde React
    try:
        datos = event.get("body", event)

        if isinstance(datos, str):
            datos = json.loads(datos)

        if not isinstance(datos, dict):
            raise ValueError("JSON invalido")

    except (ValueError, TypeError, AttributeError):
        return respuesta_http(
            400,
            {"error": "JSON invalido"}
        )

    # Obtener los nuevos datos
    nombre = datos.get("nombre")
    telefono = datos.get("telefono", "")

    if isinstance(telefono, str):
        telefono = telefono.strip()

    # Validar nombre y teléfono
    if not validar_nombre(nombre) or not validar_telefono(telefono):
        return respuesta_http(
            400,
            {"error": "Nombre o telefono invalido"}
        )

    # Actualizar el registro de DynamoDB
    try:
        miembro = actualizar_miembro(
            member_id.strip(),
            nombre.strip(),
            telefono
        )

    except ClientError as error:
        codigo = error.response["Error"]["Code"]

        if codigo == "ConditionalCheckFailedException":
            return respuesta_http(
                404,
                {"error": "Miembro no encontrado"}
            )

        raise

    # Devolver el miembro actualizado
    return respuesta_http(
        200,
        {
            "mensaje": "Miembro actualizado correctamente",
            "miembro": miembro
        }
    )
