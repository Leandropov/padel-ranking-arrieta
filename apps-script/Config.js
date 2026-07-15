/**
 * Config.js
 * Constantes y lecturas de configuración. Todo lo que el club pueda
 * necesitar ajustar (rangos de categoría, K, D, canchas) vive en la
 * pestaña "Categorías" de la planilla, no hardcodeado en el script.
 */

const SHEET_CATEGORIAS = 'Categorías';
const SHEET_JUGADORES = 'Jugadores';
const SHEET_RANKING = 'Ranking';
const SHEET_HISTORIAL = 'Historial';

// Fila donde arranca el bloque de configuración dentro de "Categorías"
// (debajo de la tabla de rangos). Ver Setup.js para el layout exacto.
const CONFIG_ROW_K = 9;
const CONFIG_ROW_D = 10;
const CONFIG_ROW_CANCHAS = 11;
const CONFIG_ROW_PARTIDOS_REF = 12;
const CONFIG_ROW_APERTURA = 13;
const CONFIG_ROW_CIERRE = 14;
const CONFIG_ROW_DURACION_BLOQUE = 15;
const CONFIG_ROW_VENTANA_DETECCION = 16;
const CONFIG_ROW_PIN_ADMIN = 17;

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  // Si el script está contenedor (bound) a la planilla, esto también funciona.
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * Devuelve las categorías configuradas como lista de
 * {nombre, min, max} leyendo la tabla de la pestaña Categorías.
 * Soporta que el club agregue o quite categorías sin tocar código.
 */
function getCategoryRanges_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIAS);
  const values = sheet.getRange(2, 1, 20, 3).getValues(); // hasta 20 categorías
  const rangos = [];
  for (const row of values) {
    const [nombre, min, max] = row;
    if (!nombre) break; // fin de la tabla (la fila en blanco antes del bloque de Configuración)
    rangos.push({ nombre: String(nombre).trim(), min: Number(min), max: Number(max) });
  }
  return rangos;
}

// Ordinal femenino para cada posición, así "4ta", "4a" o "4°" en el
// formulario matchean contra "Cuarta" en Categorías sin tener que
// mantener el texto del formulario idéntico al de la planilla.
const ORDINALES_ = {
  1: 'primera',
  2: 'segunda',
  3: 'tercera',
  4: 'cuarta',
  5: 'quinta',
  6: 'sexta',
  7: 'séptima',
  8: 'octava',
  9: 'novena',
};

function normalizarNombreCategoria_(texto) {
  const limpio = String(texto).trim().toLowerCase();
  const conNumero = limpio.match(/^(\d+)/);
  if (conNumero) {
    const ordinal = ORDINALES_[Number(conNumero[1])];
    if (ordinal) return ordinal;
  }
  return limpio;
}

function getCategoryRange_(nombreCategoria) {
  const rangos = getCategoryRanges_();
  const buscado = normalizarNombreCategoria_(nombreCategoria);
  const match = rangos.find((r) => normalizarNombreCategoria_(r.nombre) === buscado);
  if (!match) {
    throw new Error('Categoría no reconocida: "' + nombreCategoria + '"');
  }
  return match;
}

function getConfig_() {
  const sheet = getSpreadsheet_().getSheetByName(SHEET_CATEGORIAS);
  // Una sola lectura agrupada (filas CONFIG_ROW_K..CONFIG_ROW_PIN_ADMIN,
  // que son contiguas) en vez de una llamada a getValue() por cada dato
  // -- son 8 ida-y-vuelta a Sheets menos por cada getConfig_().
  const filaInicio = CONFIG_ROW_K;
  const cantidadFilas = CONFIG_ROW_PIN_ADMIN - CONFIG_ROW_K + 1;
  const valores = sheet
    .getRange(filaInicio, 2, cantidadFilas, 1)
    .getValues()
    .map((r) => r[0]);
  const val = (fila) => valores[fila - filaInicio];

  const K = Number(val(CONFIG_ROW_K));
  const D = Number(val(CONFIG_ROW_D));
  const canchasRaw = String(val(CONFIG_ROW_CANCHAS) || '');
  const canchas = canchasRaw
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  const apertura = String(val(CONFIG_ROW_APERTURA));
  const cierre = String(val(CONFIG_ROW_CIERRE));
  const duracionBloque = Number(val(CONFIG_ROW_DURACION_BLOQUE));
  const ventanaDeteccion = Number(val(CONFIG_ROW_VENTANA_DETECCION));
  const pinAdmin = String(val(CONFIG_ROW_PIN_ADMIN) || '');
  return { K, D, canchas, apertura, cierre, duracionBloque, ventanaDeteccion, pinAdmin };
}

function hhmmAMinutos_(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

function minutosAHhmm_(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

/**
 * Todos los bloques horarios del día, iguales para todas las canchas.
 * Ej: apertura 07:00, cierre 22:00, bloques de 90 min -> 10 bloques.
 */
function getBloques_(config) {
  const inicioMin = hhmmAMinutos_(config.apertura);
  const finMin = hhmmAMinutos_(config.cierre);
  const bloques = [];
  for (let t = inicioMin; t + config.duracionBloque <= finMin; t += config.duracionBloque) {
    bloques.push({ inicio: minutosAHhmm_(t), fin: minutosAHhmm_(t + config.duracionBloque) });
  }
  return bloques;
}

/**
 * El bloque horario (si hay uno) cuyo fin cayó dentro de la ventana de
 * detección hacia atrás desde ahora. Como todas las canchas comparten
 * el mismo horario, nunca hay más de un bloque candidato a la vez.
 */
function getBloqueRecienTerminado_(config) {
  const ahora = new Date();
  const ahoraMin = hhmmAMinutos_(Utilities.formatDate(ahora, Session.getScriptTimeZone(), 'HH:mm'));
  const bloques = getBloques_(config);
  return (
    bloques.find((b) => {
      const finMin = hhmmAMinutos_(b.fin);
      return finMin <= ahoraMin && finMin >= ahoraMin - config.ventanaDeteccion;
    }) || null
  );
}
