"""
Simulador de updates para el dashboard casino (POST-CAMBIOS).

Comportamiento:
- MINI y MINOR: incremento porcentual cada 0.5s-2s, suben hasta 4000 -> ganador + /reinicio a 20%
- MAJOR (moto): ganador random cada ~15 min (promedio), independiente
- GRAND (auto): ganador random cada ~15 min (promedio), independiente
- Todos los requests llevan los nuevos campos: codSala, idRace, posicion (cuando ganador)

Uso:
    python3 simulador.py

Requiere:
    pip install requests
"""
import requests
import random
import time
import threading

# ================== CONFIG ==================
BASE_URL              = "http://localhost:3000"
URL_UPDATE            = f"{BASE_URL}/update"
URL_REINICIO          = f"{BASE_URL}/reinicio"

COD_SALA              = "SIM01"

# Mini/Minor incremento
ODO_INTERVAL_MIN      = 0.5      # segundos
ODO_INTERVAL_MAX      = 2.0
PORCENTAJE_INC_MIN    = 0.10     # 0.10% del valor actual
PORCENTAJE_INC_MAX    = 0.80     # 0.80% del valor actual
INCREMENTO_BASE_MIN   = 0.10     # cuando esta cerca de 0, suma absoluto entre estos
INCREMENTO_BASE_MAX   = 2.00     # (porque % de 0 = 0, no avanza)

# Umbral para ganador mini/minor
UMBRAL_GANADOR        = 4000.0
PORCENTAJE_RESET      = 0.20     # 20% del valor al ganar (80% menos)

# Major (moto) - intervalos aleatorios
MAJOR_INTERVAL_MIN    = 10 * 60  # 10 min
MAJOR_INTERVAL_MAX    = 20 * 60  # 20 min (promedio ~15 min)
MAJOR_AMOUNT_MIN      = 8000
MAJOR_AMOUNT_MAX      = 30000

# Grand (auto) - intervalos aleatorios
GRAND_INTERVAL_MIN    = 10 * 60
GRAND_INTERVAL_MAX    = 20 * 60
GRAND_AMOUNT_MIN      = 50000
GRAND_AMOUNT_MAX      = 200000

# Esperar antes de hacer /reinicio (deja respirar al modal del ganador)
DELAY_PRE_REINICIO    = 15.0

# Tiempo a esperar si otro ganador acaba de salir (anti-colision)
WINNER_COOLDOWN       = 3.0
# ============================================

# Estado compartido entre threads
estado = {
    "mini": 0.0,
    "minor": 0.0,
    "id_race": 1,
}

# Lock para que no salgan 2 ganadores exactamente al mismo tiempo
winner_lock = threading.Lock()
ultimo_ganador_ts = 0.0


def post(url, data):
    """POST con manejo simple de errores."""
    try:
        r = requests.post(url, json=data, timeout=3)
        if r.status_code != 200:
            print(f"  [HTTP {r.status_code}] {r.text[:200]}")
            return False
        return True
    except Exception as e:
        print(f"  [ERROR] {e}")
        return False


def calcular_incremento(valor_actual):
    """
    Si el odo esta cerca de 0, suma un incremento absoluto (porque % de 0 es 0).
    Si ya tiene valor, suma porcentaje aleatorio del valor actual.
    """
    if valor_actual < 10:
        return round(random.uniform(INCREMENTO_BASE_MIN, INCREMENTO_BASE_MAX), 2)
    pct = random.uniform(PORCENTAJE_INC_MIN, PORCENTAJE_INC_MAX) / 100.0
    return round(valor_actual * pct, 2)


def disparar_ganador_mini_minor(sheet):
    """
    Cuando mini o minor llegan a UMBRAL_GANADOR:
    1. POST /update con ganador=true al valor actual
    2. Espera DELAY_PRE_REINICIO segundos
    3. POST /reinicio al 20% del valor que gano
    """
    global ultimo_ganador_ts
    
    with winner_lock:
        # Anti-colision: si otro ganador acaba de salir, espera un poco
        ahora = time.time()
        if ahora - ultimo_ganador_ts < WINNER_COOLDOWN:
            time.sleep(WINNER_COOLDOWN)
        
        valor_ganado = estado[sheet]
        maquina = f"{random.randint(100000, 999999)}"
        posicion = random.randint(1, 10)
        id_race_actual = estado["id_race"]
        
        print(f"\n{'='*60}")
        print(f"*** GANADOR {sheet.upper()} - S/.{valor_ganado:.2f} - Maq:{maquina}-{posicion} ***")
        print(f"{'='*60}\n")
        
        ok = post(URL_UPDATE, {
            "sheet": sheet,
            "amount": valor_ganado,
            "ganador": True,
            "maquina": maquina,
            "posicion": posicion,
            "codSala": COD_SALA,
            "idRace": id_race_actual,
        })
        
        if ok:
            estado["id_race"] += 1
            ultimo_ganador_ts = time.time()
    
    # Fuera del lock: esperar y reiniciar
    if not ok:
        return
    
    time.sleep(DELAY_PRE_REINICIO)
    
    # Reset al 20% del valor que gano
    nuevo_valor = round(valor_ganado * PORCENTAJE_RESET, 2)
    
    print(f"[RESET] {sheet.upper()}: S/.{valor_ganado:.2f} -> S/.{nuevo_valor:.2f} (20%)")
    
    ok_reset = post(URL_REINICIO, {
        "sheet": sheet,
        "amount": nuevo_valor,
        "codSala": COD_SALA,
        "idRace": estado["id_race"],
    })
    
    if ok_reset:
        estado[sheet] = nuevo_valor


def loop_mini_minor():
    """
    Loop: incrementa mini y minor en paralelo. Cuando alguno alcanza UMBRAL_GANADOR,
    dispara su ganador + reset en un thread separado para no bloquear los updates.
    """
    while True:
        # Incrementar y enviar mini
        inc_mini = calcular_incremento(estado["mini"])
        estado["mini"] = round(estado["mini"] + inc_mini, 2)
        post(URL_UPDATE, {
            "sheet": "mini",
            "amount": estado["mini"],
            "ganador": False,
            "codSala": COD_SALA,
            "idRace": estado["id_race"],
        })
        
        # Incrementar y enviar minor
        inc_minor = calcular_incremento(estado["minor"])
        estado["minor"] = round(estado["minor"] + inc_minor, 2)
        post(URL_UPDATE, {
            "sheet": "minor",
            "amount": estado["minor"],
            "ganador": False,
            "codSala": COD_SALA,
            "idRace": estado["id_race"],
        })
        
        print(f"[ODO] MINI: S/.{estado['mini']:>8.2f}  (+{inc_mini:>5.2f})  |  "
              f"MINOR: S/.{estado['minor']:>8.2f}  (+{inc_minor:>5.2f})  |  race:{estado['id_race']}")
        
        # Chequear umbral - cada uno en su propio thread para no bloquear
        if estado["mini"] >= UMBRAL_GANADOR:
            threading.Thread(target=disparar_ganador_mini_minor, args=("mini",), daemon=True).start()
            # Resetear localmente ya para que no se dispare otra vez en el siguiente loop
            # (el /reinicio real llega despues de DELAY_PRE_REINICIO segundos)
            estado["mini"] = round(estado["mini"] * PORCENTAJE_RESET, 2)
        
        if estado["minor"] >= UMBRAL_GANADOR:
            threading.Thread(target=disparar_ganador_mini_minor, args=("minor",), daemon=True).start()
            estado["minor"] = round(estado["minor"] * PORCENTAJE_RESET, 2)
        
        time.sleep(random.uniform(ODO_INTERVAL_MIN, ODO_INTERVAL_MAX))


def loop_ganador_independiente(sheet, intervalo_min, intervalo_max, amount_min, amount_max):
    """
    Loop generico para major/grand: cada X minutos aleatorios, dispara un ganador.
    No usa reinicio (esos sheets no se resetean).
    """
    global ultimo_ganador_ts
    
    # Primer intervalo es completo (no dispara al arrancar)
    time.sleep(random.uniform(intervalo_min, intervalo_max))
    
    while True:
        with winner_lock:
            ahora = time.time()
            if ahora - ultimo_ganador_ts < WINNER_COOLDOWN:
                time.sleep(WINNER_COOLDOWN)
            
            monto = round(random.uniform(amount_min, amount_max), 2)
            maquina = f"{random.randint(100000, 999999)}"
            posicion = random.randint(1, 10)
            id_race_actual = estado["id_race"]
            
            print(f"\n{'='*60}")
            print(f"*** GANADOR {sheet.upper()} - S/.{monto:.2f} - Maq:{maquina}-{posicion} ***")
            print(f"{'='*60}\n")
            
            ok = post(URL_UPDATE, {
                "sheet": sheet,
                "amount": monto,
                "ganador": True,
                "maquina": maquina,
                "posicion": posicion,
                "codSala": COD_SALA,
                "idRace": id_race_actual,
            })
            
            if ok:
                estado["id_race"] += 1
                ultimo_ganador_ts = time.time()
        
        # Siguiente ciclo
        time.sleep(random.uniform(intervalo_min, intervalo_max))


def main():
    print("=" * 60)
    print("SIMULADOR DE CASINO - Dashboard Updates (v2)")
    print("=" * 60)
    print(f"URL update:           {URL_UPDATE}")
    print(f"URL reinicio:         {URL_REINICIO}")
    print(f"codSala:              {COD_SALA}")
    print()
    print(f"MINI/MINOR")
    print(f"  Incremento %:       {PORCENTAJE_INC_MIN}% a {PORCENTAJE_INC_MAX}% del valor actual")
    print(f"  Incremento base:    S/.{INCREMENTO_BASE_MIN} a S/.{INCREMENTO_BASE_MAX} (si esta cerca de 0)")
    print(f"  Intervalo:          {ODO_INTERVAL_MIN}s a {ODO_INTERVAL_MAX}s")
    print(f"  Umbral ganador:     S/.{UMBRAL_GANADOR:.2f}")
    print(f"  Reset al ganar:     {PORCENTAJE_RESET*100:.0f}% del valor (80% menos)")
    print()
    print(f"MAJOR (moto)")
    print(f"  Intervalo:          {MAJOR_INTERVAL_MIN//60}-{MAJOR_INTERVAL_MAX//60} min (promedio ~15min)")
    print(f"  Monto:              S/.{MAJOR_AMOUNT_MIN}-{MAJOR_AMOUNT_MAX}")
    print()
    print(f"GRAND (auto)")
    print(f"  Intervalo:          {GRAND_INTERVAL_MIN//60}-{GRAND_INTERVAL_MAX//60} min (promedio ~15min)")
    print(f"  Monto:              S/.{GRAND_AMOUNT_MIN}-{GRAND_AMOUNT_MAX}")
    print("=" * 60)
    print("Ctrl+C para detener\n")
    
    # Threads independientes para major y grand
    t_major = threading.Thread(
        target=loop_ganador_independiente,
        args=("major", MAJOR_INTERVAL_MIN, MAJOR_INTERVAL_MAX, MAJOR_AMOUNT_MIN, MAJOR_AMOUNT_MAX),
        daemon=True
    )
    t_grand = threading.Thread(
        target=loop_ganador_independiente,
        args=("grand", GRAND_INTERVAL_MIN, GRAND_INTERVAL_MAX, GRAND_AMOUNT_MIN, GRAND_AMOUNT_MAX),
        daemon=True
    )
    t_major.start()
    t_grand.start()
    
    # Loop principal: mini/minor
    try:
        loop_mini_minor()
    except KeyboardInterrupt:
        print("\n\nDetenido por el usuario.")


if __name__ == "__main__":
    main()
