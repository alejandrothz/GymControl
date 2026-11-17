import json
import boto3

dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla = dynamodb.Table("Members")

def lambda_handler(event, context):

    # Obtener el ID del miembro desde el evento
    member_id = event.get("memberId")

    # Validar que se haya enviado un identificador
    if not isinstance(member_id, str) or not member_id.strip():
        return {
            "statusCode": 400,
            "body": json.dumps ({
                "error": "El memberId es obligatorio"
            })
        }

    # Obtener un miembro utilizando su clave primaria
    respuesta = tabla.get_item(
        Key={"memberId": member_id}
    )

    # Obtener el miembro de la respuesta
    miembro = respuesta.get("Item")

    # Verificar si el miembro existe
    if not miembro:
        return {
            "statusCode": 404,
            "body": json.dumps({
                "error": "Miembro no encontrado"
            })
        }

    # Devolver el resultado
    return {
        "statusCode": 200,
        "body": json.dumps(miembro)
    }