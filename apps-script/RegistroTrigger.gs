/**
 * RegistroTrigger.gs
 * Se dispara solo cuando alguien completa el Formulario de Registro.
 * Calcula el puntaje inicial (punto medio del rango de la categoría
 * elegida) y agrega la fila a "Jugadores". El puntaje ACTUAL queda
 * como fórmula que suma los deltas de Historial, así nunca hay que
 * volver a tocarlo a mano.
 */
function onRegistroFormSubmit(e) {
  // El trigger está atado al formulario (no a la hoja de respuestas), así
  // que el evento trae e.response (FormResponse), no e.namedValues.
  const mapa = {};
  e.response.getItemResponses().forEach((r) => {
    mapa[r.getItem().getTitle()] = r.getResponse();
  });
  const nombre = String(mapa['Nombre completo (agregá algo que te distinga: apellido materno, apodo, o número de jugador)']).trim();
  const categoria = String(mapa['¿Qué categoría considerás tener?']).trim();

  const rango = getCategoryRange_(categoria);
  const puntajeInicial = Math.round((rango.min + rango.max) / 2);

  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_JUGADORES);
  const fila = sheet.getLastRow() + 1;

  sheet.getRange(fila, 1, 1, 3).setValues([[nombre, categoria, puntajeInicial]]);
  sheet
    .getRange(fila, 4)
    .setFormula(
      '=C' + fila +
        ' + SUMIF(Historial!E:E,A' + fila + ',Historial!K:K)' +
        ' + SUMIF(Historial!F:F,A' + fila + ',Historial!K:K)' +
        ' + SUMIF(Historial!G:G,A' + fila + ',Historial!L:L)' +
        ' + SUMIF(Historial!H:H,A' + fila + ',Historial!L:L)'
    );
}
