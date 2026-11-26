# importar boto3 para comunicarnos con AWS
import boto3

# convertir los datos de python a formato JSON
import json

# conectar con dynamodb en la region de ohio
dynamodb = boto3.resource(
    "dynamodb",
    region_name = "us-east-2"
)

# seleccionar la tabla de miebmros
tabla_miembros = dynamodb.Table("Members")

# Consultar los miembros registrados en DynamoDB
def obtener_miembros():

    # Leer los registros de la tabla members
    respuesta = tabla_miembros.scan()

    # Devolver la lista de miembros encontrados
    return respuesta.get("Items", [])

# buscar los miembros por nombre o numero de telefono
def buscar_miembros(miembros, busqueda):

    # Normalizar el texto para ignorar mayusculas y espacios exteriores
    busqueda = busqueda.strip().lower()

    # filtrar los miembros que coincidan con la busqueda
    return [
        miembro
        for miembro in miembros
        if busqueda in miembro.get("fullName", "").lower()
        or busqueda in miembro.get("phone", "")
    ]


def lambda_handler(event, context):

    # Obtener los miembros registrados en DynamoDB
    miembros = obtener_miembros()

    # obtener el texto de busqueda enviado a lambda
    busqueda = event.get("busqueda", "")

    # validar que la busqueda sea texto
    if not isinstance(busqueda, str):
        return {
            "statusCode": 400,
            "body": "La busqueda debe ser texto"
        }

    # filtrar miembros solo cuando existe una busqueda
    if busqueda.strip():
        miembros = buscar_miembros(miembros, busqueda)

    # Devolver la lista de miembros en formato compatible con API Gateway
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json"
        },
        "body": json.dumps(miembros)
    }