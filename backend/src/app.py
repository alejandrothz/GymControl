import json
# importamos la libreria uuid para generar un identificador unico
import uuid

# Funcion principal que ejecuta aws lambda
def lambda_handler(event, context):
    #obtener los datos recibidos en el evento
    nombre = event.get("nombre", "")
    telefono = event.get("telefono", "")

    # validar que el nombre no esté vacio
    if not nombre.strip():
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": "El nombre no puede estar vacio"
            })
        }
    
    #generar un identificador unico para el usuario
    member_id = str(uuid.uuid4())

    # debolver los datos validados en formato json
    return {
        "statusCode": 200,
        "body": json.dumps({
            "member_id": member_id,
            "nombre": nombre,
            "telefono": telefono,
            "mensaje": f"Datos validados correctamente"
        })
}