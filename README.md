# Casino Progresivo Race - Dashboard

Dashboard 24/7 de jackpots progresivos (MINI, MINOR, MAJOR y GRAND). App Electron que muestra la animacion en pantalla y levanta un servidor HTTP interno donde el sistema del casino envia los montos y los ganadores.

## Estructura

```
.
├── main.js                 # entrada de Electron: flags, ciclo de vida y atajos
├── src/                    # proceso principal dividido en modulos
│   ├── estado.js           # estado compartido (cola, ventana, db, rutas) - se usa como estado.X
│   ├── config.js           # lectura de config.json
│   ├── rutas.js            # rutas de escritura en userData
│   ├── logger.js           # log a archivo con rotacion diaria
│   ├── utilidades.js       # fechas y formatos
│   ├── db.js               # SQLite (sql.js)
│   ├── ias.js              # envio de ganadores y acreditaciones al IAS
│   ├── cola-ganadores.js   # cola hacia el dashboard y acreditacion
│   ├── panel-admin.js      # PIN local y log de ganadores
│   ├── ventana.js          # ventana de Electron
│   ├── servidor-http.js    # endpoints (Express)
│   └── watchdog.js         # memoria, estado ganador/promo y limpiezas
├── dashboard.html          # estructura de la pantalla
├── css/                    # estilos (fuentes, principal, ganador, panel admin)
│   └── variantes/          # variantes de diseno (comun, dashboard, hojas, video)
├── js/                     # logica de la pantalla (principal, promos, ganador, sprites, etc.)
│   └── vendor/three.min.js # Three.js
├── img/                    # auto, moto, sprites, copa y fondo del monto del ganador
│   └── variantes/          # miniaturas del selector de variantes (Ctrl+Shift+T)
├── fonts/                  # fuentes locales
├── audio/                  # musica de fondo y sonido de ganador
├── promos/           # videos de promocion (van como extraResources)
├── config.json       # configuracion (va como extraResources)
├── simulador.py      # genera trafico de prueba contra el servidor
└── casino-postman-collection.json
```

## Ejecutar en desarrollo

```bash
npm install
npm start
```

Para simular trafico (requiere `pip install requests`):

```bash
python simulador.py
```

## Configuracion (`config.json`)

Instalado, esta en `resources/config.json` junto al ejecutable. Las claves principales:

| Clave | Uso |
|---|---|
| `windowMode` | `window` o `kiosk` (Ctrl+Shift+K lo cambia en caliente) |
| `httpPort` | puerto del servidor HTTP (por defecto 3000) |
| `apiBaseUrl` | opcional; URL que usa la pantalla para hablar con el servidor (por defecto `http://127.0.0.1:<httpPort>`) |
| `homeViewDurationSec`, `promoIntervalSec`, `promoDurationSec` | tiempos del carrusel y promos |
| `winnerDelaySec`, `winnerModalDurationSec`, `confirmMinDisplaySec`, `gapEntreGanadoresSec` | tiempos del modal ganador |
| `modalVideoVolume`, `bgMusicVolume` | volumenes |
| `useTestData` | modo prueba |
| `memoryReloadMB`, `reloadCheckIntervalSec` | recarga automatica por memoria |
| `iasEnabled`, `iasBaseUrl`, `iasRetryIntervalSec` | envio de ganadores y acreditaciones al servidor IAS |
| `msgAcreditado*`, `detalleAcreditado*`, `msgSinConfirmacion` | textos de acreditacion |
| `adminPin` | PIN del panel admin (si no esta, 1234) |

## Endpoints HTTP

| Metodo | Ruta | Uso |
|---|---|---|
| POST | `/update` | monto o ganador de una hoja (`sheet`, `amount`, `ganador`, `maquina`, `codSala`, `idRace`, `posicion`) |
| POST | `/update-bulk` | montos de varias hojas a la vez |
| POST | `/reinicio` | reinicio del monto de una hoja |
| POST | `/confirmSubida` | confirmacion de acreditacion del ganador en pantalla |
| POST | `/sprite-config`, `/sprite-config-bulk` | mostrar u ocultar moto/auto en major/grand |
| GET | `/sprite-config`, `/status`, `/health`, `/stats`, `/ultimo-monto` | estado |
| GET | `/history`, `/audit`, `/ias-status`, `/admin/log-ganadores` | consultas e historial |

La coleccion `casino-postman-collection.json` tiene ejemplos de cada request.

## Datos y logs

La base SQLite (`dashboard.db`), los logs y `pending-updates.json` se guardan en la carpeta `userData` de Electron, no en la carpeta del proyecto.

## Generar instaladores

Ver `GITHUB-ACTIONS-README.md`. Un tag `v*` dispara el workflow que compila Windows, macOS y Linux y publica el Release.
