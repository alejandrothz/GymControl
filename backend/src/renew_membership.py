from datetime import date, timedelta

def calcular_renovacion(fecha_vencimiento, fecha_pago):
    # Comprobar si la membresía sigue vigente
    if fecha_pago <= fecha_vencimiento:
        nuevo_inicio = fecha_vencimiento + timedelta(days=1)
        #si la membresia vencio, iniciar desde la fecha del pago
    else:
        nuevo_inicio = fecha_pago

    # Calcular el último dia de los nuevos 30 días
    nuevo_fin = nuevo_inicio + timedelta(days=29)

    return nuevo_inicio, nuevo_fin