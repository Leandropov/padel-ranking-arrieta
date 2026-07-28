/**
 * RecuperarRegistros.js
 * Utilidad heredada: reprocesa respuestas del Google Form de registro
 * VIEJO que nunca llegaron a "Jugadores" (pasó una vez, cuando la
 * categoría abreviada del formulario no matcheaba contra la pestaña
 * Categorías).
 *
 * Ya casi no hace falta: el alta se hace desde la app y todo intento
 * queda en la pestaña Registros. Se conserva solo por si quedaron
 * respuestas viejas sin procesar en "Form Responses 1".
 *
 * Correr recuperarRegistrosDelFormulario() a mano desde el editor. Es
 * seguro correrla varias veces: registrarJugador_ rechaza los nombres
 * que ya están, así que solo agrega lo que realmente falta.
 */
function recuperarRegistrosDelFormulario() {
  const ss = getSpreadsheet_();
  const respuestas = ss.getSheets().find((s) => s.getName().indexOf('Form Responses') === 0);
  if (!respuestas) {
    Logger.log('No hay pestaña de respuestas del formulario. Nada que recuperar.');
    return;
  }

  const lastRow = respuestas.getLastRow();
  if (lastRow < 2) {
    Logger.log('No hay respuestas del formulario para procesar.');
    return;
  }

  const filas = respuestas.getRange(2, 1, lastRow - 1, 3).getValues();
  let agregados = 0;
  const saltados = [];

  filas.forEach(([, nombreRaw, categoriaRaw]) => {
    const nombre = limpiarNombre_(nombreRaw);
    if (!nombre) return;
    try {
      // Se delega en la misma función que usa la app: así el alta queda
      // con ID, con su fórmula de puntaje y anotada en la bitácora.
      // Antes esta función escribía las celdas por su cuenta, y desde la
      // migración a IDs eso habría escrito el layout viejo (nombre en la
      // columna A) encima del nuevo, corrompiendo la planilla.
      const jugador = registrarJugador_({ nombre: nombre, categoria: categoriaRaw });
      agregados++;
      Logger.log('Recuperado: ' + jugador.id + ' ' + jugador.nombre);
    } catch (err) {
      saltados.push(nombre + ' (' + err.message + ')');
    }
  });

  Logger.log(
    'Agregados: ' + agregados + '. Saltados: ' + (saltados.length ? saltados.join('; ') : 'ninguno')
  );
}
