/**
 * RecuperarRegistros.js
 * Utilidad de una sola vez: reprocesa las respuestas del formulario de
 * registro que no llegaron a "Jugadores" (por ejemplo, porque en su
 * momento la categoría no matcheaba -- ver normalizarNombreCategoria_
 * en Config.js). Correr recuperarRegistrosDelFormulario() a mano desde
 * el editor de Apps Script; no está atada a ningún trigger.
 *
 * Es seguro correrla varias veces: salta los nombres que ya están en
 * Jugadores, así que solo agrega lo que realmente falta.
 */
function recuperarRegistrosDelFormulario() {
  const ss = getSpreadsheet_();
  const respuestas = ss.getSheets().find((s) => s.getName().indexOf('Form Responses') === 0);
  if (!respuestas) throw new Error('No se encontró la pestaña de respuestas del formulario.');

  const jugadoresSheet = ss.getSheetByName(SHEET_JUGADORES);
  const existentes = new Set(
    jugadoresSheet.getLastRow() >= 2
      ? jugadoresSheet
          .getRange(2, 1, jugadoresSheet.getLastRow() - 1, 1)
          .getValues()
          .map((r) => String(r[0]).trim())
      : []
  );

  const lastRow = respuestas.getLastRow();
  if (lastRow < 2) {
    Logger.log('No hay respuestas del formulario para procesar.');
    return;
  }

  const filas = respuestas.getRange(2, 1, lastRow - 1, 3).getValues();
  let agregados = 0;
  const saltados = [];

  filas.forEach(([, nombreRaw, categoriaRaw]) => {
    const nombre = String(nombreRaw).trim();
    if (!nombre || existentes.has(nombre)) return; // fila vacía o ya está en Jugadores

    let rango;
    try {
      rango = getCategoryRange_(categoriaRaw);
    } catch (err) {
      saltados.push(nombre + ' (categoría "' + categoriaRaw + '" no reconocida)');
      return;
    }

    const puntajeInicial = Math.round((rango.min + rango.max) / 2);
    const fila = jugadoresSheet.getLastRow() + 1;

    jugadoresSheet.getRange(fila, 1, 1, 3).setValues([[nombre, rango.nombre, puntajeInicial]]);
    jugadoresSheet
      .getRange(fila, 4)
      .setFormula(
        '=C' + fila +
          ' + SUMIF(Historial!E:E,A' + fila + ',Historial!K:K)' +
          ' + SUMIF(Historial!F:F,A' + fila + ',Historial!K:K)' +
          ' + SUMIF(Historial!G:G,A' + fila + ',Historial!L:L)' +
          ' + SUMIF(Historial!H:H,A' + fila + ',Historial!L:L)'
      );
    existentes.add(nombre);
    agregados++;
  });

  Logger.log(
    'Agregados: ' + agregados + '. Saltados: ' + (saltados.length ? saltados.join('; ') : 'ninguno')
  );
}
