# Importar las herramienas para consultar DynamoDB
import boto3
from boto3.dynamodb.conditions import Key

# herramienta para validar fechas
from datetime import datetime

# conectar con DynamoDB en la region Ohio
dynamodb = boto3.resource(
    "dynamodb",
    region_name = "us-east-2"
)

# seleccionar la tabla de pagos
tabla_pagos = dynamodb.Table("Payments")

# calcular los ingresos totales a partir de una lista de pagos
def calcular_ingresos(pagos):
    total = 0

    # recorrer cada pago y acumular su importe en centavos
    for pago in pagos:
        total += pago ["amountInCents"]

    return total

# Consultar los pagos de un mes utilizando el indice PaymentMonthIndex usando paginacion
def obtener_pagos_mes(mes):
    respuesta = tabla_pagos.query(
        IndexName = "PaymentMonthIndex",
        KeyConditionExpression = Key("paymentMonth").eq(mes)
    )

    # Devolver los pagos encontrados
    return respuesta.get("Items",[])

# Obtener los ingresos totales de un mes
def obtener_ingresos_mesuales(mes):

    # consultar los pagos del mes mediante gsi
    pagos = obtener_pagos_mes(mes)

    # Calcular el improte toal en centavos
    total = calcular_ingresos(pagos)

    # Devolver el resumen mensual
    return {
        "mes": mes,
        "cantidadPagos": len(pagos),
        "totalInCents": total
    }

# punto de enrada de aws lambda para consultar ingresos mensuales
def lambda_handler(event, context):

    # Obtener el mes soliciado
    mes = event.get("mes")

    # comprobar que el mes sea texto
    if not isinstance(mes, str):
        return {
            "statusCode": 400,
            "body": "El mes debe tener el formato YYYY-MM"
        }

    # Validar que el anio y el mes sean correctos
    try:
        # Convertir el mes recibido a un objeto de fecha
        fecha = datetime.strptime(mes, "%Y-%m")

        if fecha.strftime("%Y-%m") != mes:
            raise ValueError("Formato incorrecto")

    except ValueError:
        return {
            "statusCode": 400,
            "body": "El mes debe tener el formato YYYY-mm"
        }

    # consultar pagos y calcular los ingresos del mes
    resultado = obtener_ingresos_mesuales(mes)

    # devolver el resulmen mensual
    return {
        "statusCode": 200,
        "body": resultado
    }