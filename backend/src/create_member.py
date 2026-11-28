
# Registrar miembros en DynamoDB sin activar su membresía
import json
import uuid
import boto3

from datetime import datetime, timezone

# Conexión con DynamoDB en AWS Ohio
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla = dynamodb.Table("Members")


def lambda_handler(event, context):

    # Obtener los datos enviados por API Gateway
    try:
        if "body" in event:
            datos = json.loads(event["body"] or "{}")
        else:
            datos = event

        if not isinstance(datos, dict):
            raise ValueError("JSON invalido")

    except (json.JSONDecodeError, ValueError, TypeError):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "JSON invalido"})
        }

    # Validar los datos del nuevo miembro
    nombre = datos.get("nombre", "")
    telefono = datos.get("telefono", "")

    if not isinstance(nombre, str) or not nombre.strip():
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "El nombre es obligatorio"})
        }

    if not isinstance(telefono, str):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Telefono invalido"})
        }

    # Generar identificador y fecha de registro
    member_id = str(uuid.uuid4())
    fecha_registro = datetime.now(timezone.utc).isoformat()

    # Registrar miembro sin periodo de membresia
    tabla.put_item(
        Item={
            "memberId": member_id,
            "fullName": nombre.strip(),
            "phone": telefono.strip(),
            "isActive": True,
            "registeredAt": fecha_registro
        },
        ConditionExpression="attribute_not_exists(memberId)"
    )

    # Confirmar el registro
    return {
        "statusCode": 201,
        "body": json.dumps({
            "memberId": member_id,
            "mensaje": "Miembro registrado correctamente"
        })
    }
