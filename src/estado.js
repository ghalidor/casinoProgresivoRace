// ============================================================
// Estado compartido entre modulos (antes eran variables globales
// de main.js). Se usa siempre como estado.X para que todos los
// modulos lean y escriban el mismo valor.
// ============================================================
const estado = {
  mainWindow: undefined,
  isWinnerActive: false,
  // Ganador ya enviado al dashboard: el modal tarda winnerDelaySec en abrir y el
  // watchdog puede tardar hasta 5s en verlo. Sin esta marca, un ganador que llega
  // en ese hueco se colaria encima del anterior.
  winnerDespachado: false,
  winnerDespachadoAt: 0,
  winnerDespachoMaxMs: 60000,  // limite de seguridad, se ajusta desde config
  ganadorPendiente: null,  // ganador EN PANTALLA esperando confirmSubida (acreditacion IAS)
  gapEntreGanadoresMs: 2000,  // pausa entre que cierra un modal y abre el siguiente
  flushProgramado: false,  // evita que /winner-closed y el watchdog flusheen doble
  iasDetalleTimeout: 'no se envio acreditacion(no confirmaron)',
  iasDetalleAuto: 'subida correcta',
  isPromoActive: false,
  pendingUpdates: [],
  dashboardReady: false,
  iasConfig: null,
  iasRetryTimer: null,
  // ============================================================
  // RUTAS: separar lectura (empaquetadas) de escritura (userData)
  // __dirname dentro de app.asar es de SOLO LECTURA, por eso
  // los archivos que la app escribe (logs, db, pending) van a userData.
  // IMPORTANTE: las rutas se inicializan en app.whenReady() porque
  // app.getPath('userData') puede fallar antes de eso.
  // ============================================================
  USER_DATA_DIR: null,
  PENDING_FILE: null,
  LOGS_DIR: null,
  DB_PATH: null,
  // ============================================================
  // SQLITE: guardar todas las peticiones que entran
  // ============================================================
  db: null,
  dbReady: false,
  dbSaveTimeout: null,
  nextPeticionId: 1,
  nextEventoId: 1,
  // ============================================================
  // ENVIO A SERVIDOR EXTERNO (IAS)
  // Cuando llega un ganador, se intenta enviar al endpoint externo
  // /PraGanadores/CrearGanador. Si falla, queda con enviado_externo=0
  // y se reintenta automaticamente cada iasRetryIntervalSec.
  // ============================================================
  iasStats: {
    ultimoIntento: null,
    ultimoExito: null,
    ultimoError: null,
    totalEnviados: 0,
    totalErrores: 0
  },
};

module.exports = estado;
