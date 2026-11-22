import json
import uuid
import boto3

from datetime import datetime, timezone, timedelta

# preparar el acceso a DynamoDB
dynamodb = boto3.resource("dynamodb", region_name="us-east-2")
tabla = dynamodb.Table("Members")

def lambda_handler(event, context):

    # Obtener los datos enviados por el recepcionista
    nombre = event.get("nombre", "")
    telefono = event.get("telefono", "")

    #validar que nombre no este vacio
    if not nombre.strip():
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "El nombre no puede estar vacio"
            })
        }
    # generar un identificador único para el miebmro
    member_id = str(uuid.uuid4())

    # obtener fecha y hora actual en UTC
    ahora = datetime.now(timezone.utc)
    fecha_registro = ahora.isoformat()

    # Calcular el periodo inicial de membresia (30 días a partir de la fecha de registro)
    inicio_membresia = ahora.date()
    fin_membresia = inicio_membresia + timedelta(days=29)

    # guardar el miembro en la tabla de dynamodb
    tabla.put_item(
        Item = {
            "memberId": member_id,
            "fullName": nombre,
            "phone": telefono,
            "isActive": True,
            "registeredAt": fecha_registro,
            "membershipStartDate": inicio_membresia.isoformat(),
            "membershipEndDate": fin_membresia.isoformat()
        },
        #evita sobreescribir un mbiembro existente
        ConditionExpression="attribute_not_exists(memberId)"
    )
    
    return {
        "statusCode": 200,
        "body": json.dumps({
            "member_Id": member_id,
            "mensaje": "Miembro registrado exitosamente"
        })
    }