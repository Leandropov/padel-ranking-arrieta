/**
 * RegistroTrigger.js
 * Adaptador del Google Form de registro VIEJO.
 *
 * El alta de jugadores ya no pasa por acá: se hace desde la pantalla
 * #registro de la app (ver registrarJugador_ en Jugadores.js), que es la
 * única que puede avisarle a alguien en el momento que su nombre ya está
 * tomado. Pero el formulario viejo puede seguir existiendo y alguien
 * puede tener el link guardado, así que este trigger se mantiene vivo y
 * delega en la misma función que usa la app.
 *
 * Si se borrara este archivo dejando el trigger creado, los envíos del
 * formulario fallarían en silencio: la respuesta quedaría en la pestaña
 * de respuestas y la persona nunca entraría al ranking, sin que nadie se
 * entere. Por eso se conserva.
 *
 * Para cerrar el formulario de una vez, ver cerrarFormularioViejo_ en
 * Migracion.js.
 */
function onRegistroFormSubmit(e) {
  // El trigger está atado al formulario (no a la hoja de respuestas), así
  // que el evento trae e.response (FormResponse), no e.namedValues.
  const mapa = {};
  e.response.getItemResponses().forEach((r) => {
    mapa[r.getItem().getTitle()] = r.getResponse();
  });

  // Se busca por fragmento del título y no por el título exacto: el
  // texto de las preguntas del formulario cambió con el tiempo y un
  // match exacto rompería el alta sin dejar rastro.
  const valorDe_ = (fragmento) => {
    const clave = Object.keys(mapa).find((t) => t.toLowerCase().indexOf(fragmento) !== -1);
    return clave ? String(mapa[clave]) : '';
  };

  const nombre = valorDe_('nombre');
  const categoria = valorDe_('categor');

  try {
    const jugador = registrarJugador_({ nombre: nombre, categoria: categoria });
    Logger.log('Alta desde el formulario viejo: ' + jugador.id + ' ' + jugador.nombre);
  } catch (err) {
    // registrarJugador_ ya dejó el intento en la pestaña Registros y, si
    // fue por nombre repetido, ya avisó por mail. Acá no hay a quién
    // mostrarle el error (el formulario ya cerró), así que solo se loguea.
    Logger.log('Registro rechazado desde el formulario viejo ("' + nombre + '"): ' + err.message);
  }
}
