/**
 * Reset.js
 * Utilidad de una sola vez para vaciar los datos de prueba antes de
 * invitar jugadores reales. Correr limpiarDatosDePrueba() a mano desde
 * el editor de Apps Script (elegirla en el desplegable de funciones y
 * tocar Ejecutar) -- no está atada a ningún trigger, no se dispara sola.
 *
 * Borra todas las filas de Jugadores, Historial y las respuestas del
 * formulario de registro (deja los encabezados). NO toca Categorías
 * (la configuración del club) ni el Ranking, que es 100% fórmula sobre
 * Jugadores y queda vacío solo.
 */
function limpiarDatosDePrueba() {
  const ss = getSpreadsheet_();

  limpiarFilas_(ss.getSheetByName(SHEET_JUGADORES));
  limpiarFilas_(ss.getSheetByName(SHEET_HISTORIAL));

  const respuestas = ss.getSheets().find((s) => s.getName().indexOf('Form Responses') === 0);
  limpiarFilas_(respuestas);

  Logger.log(
    'Listo. Jugadores, Historial' +
      (respuestas ? ' y "' + respuestas.getName() + '"' : '') +
      ' quedaron vacíos (solo el encabezado). Categorías no se tocó.'
  );
}

function limpiarFilas_(sheet) {
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.deleteRows(2, lastRow - 1);
}
