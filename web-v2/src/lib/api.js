// URL de la web app de Apps Script (backend). Si el día de mañana se
// vuelve a implementar con "Nueva versión", la URL no cambia -- solo
// cambiaría si se crea una implementación completamente nueva.
export const API_URL =
  'https://script.google.com/macros/s/AKfycbyIWdxh5iUBrjFclCeMZdfyl1N5HvK2MgOkioVpAjNmTwih4XzFa3NcSwQcL7PY7IC3/exec';

// Apps Script responde en 2-3 segundos cuando está sano, pero puede
// dejar de responder sin cerrar la conexión: el 29/07/2026 estuvo unos
// diez minutos redirigiendo a una respuesta que nunca llegaba. Sin
// timeout, `fetch` espera indefinidamente y la pantalla se queda en
// "cargando" para siempre, sin explicación y sin forma de reintentar.
// 12s es cuatro veces el tiempo normal.
const TIMEOUT_MS = 12000;

/**
 * Mensaje único para todo lo que signifique "el backend no contestó como
 * debía": timeout, error de red, o una respuesta que no es el JSON
 * esperado (cuando Apps Script falla devuelve su propia página HTML).
 * Para quien está usando la app los tres son el mismo problema y la
 * misma acción posible: reintentar.
 */
function errorDeBackend_() {
  const err = new Error('No pudimos contactar al servidor. Revisa tu conexión e inténtalo de nuevo.');
  err.codigo = 'BACKEND_NO_DISPONIBLE';
  return err;
}

async function unIntento_(url, options) {
  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  let texto;
  try {
    const res = await fetch(url, { ...options, signal: controlador.signal });
    texto = await res.text();
  } catch {
    // Acá caen tanto el timeout (AbortError) como cualquier fallo de red.
    throw errorDeBackend_();
  } finally {
    clearTimeout(reloj);
  }

  let data;
  try {
    data = JSON.parse(texto);
  } catch {
    // No vino JSON. Antes esto explotaba como SyntaxError y el texto
    // crudo del navegador ("Unexpected token '<'...") terminaba en
    // pantalla en los flujos que muestran err.message.
    throw errorDeBackend_();
  }

  if (!data.ok) {
    // El backend puede marcar el error con un código (ver safeRun_ en
    // WebApp.js). Se propaga como propiedad para que la pantalla pueda
    // reaccionar distinto a un caso puntual -- hoy NOMBRE_DUPLICADO --
    // sin comparar el texto del mensaje, que cambia.
    const err = new Error(data.error);
    if (data.codigo) err.codigo = data.codigo;
    throw err;
  }
  return data.data;
}

async function llamar(query, options) {
  const url = query ? API_URL + '?' + query : API_URL;

  // Un reintento, y solo para las lecturas. Los envíos no se reintentan
  // a propósito: si el pedido llegó pero la respuesta se perdió, un
  // segundo intento escribiría el resultado dos veces. No vale la pena
  // arriesgar un partido duplicado en el ranking para ahorrarle un toque
  // a alguien -- para eso está el botón de reintentar en pantalla.
  const esLectura = !options;
  try {
    return await unIntento_(url, options);
  } catch (err) {
    if (!esLectura || err.codigo !== 'BACKEND_NO_DISPONIBLE') throw err;
    return unIntento_(url, options);
  }
}

export function getContext() {
  return llamar();
}

export function getRanking() {
  return llamar('vista=ranking');
}

// Sin header de Content-Type a propósito: el navegador manda
// "text/plain" por defecto para un body string, así el pedido cuenta
// como "simple request" y evita el preflight de CORS que Apps Script
// no sabe responder.
export function submitResultado(payload) {
  return llamar(null, { method: 'POST', body: JSON.stringify(payload) });
}

/**
 * Alta de un jugador. El backend rechaza los nombres ya tomados con
 * codigo 'NOMBRE_DUPLICADO' -- ver registrarJugador_ en Jugadores.js.
 */
export function registrarJugador({ nombre, categoria }) {
  return llamar(null, {
    method: 'POST',
    body: JSON.stringify({ tipo: 'registro', nombre, categoria }),
  });
}

/**
 * Guarda cómo los rivales repartieron los puntos de un partido que ya se
 * cargó. Va como envío aparte y no dentro de submitResultado a propósito:
 * el partido tiene que quedar guardado antes de que nadie valore, así una
 * valoración a medias nunca puede costar un partido.
 *
 * `valoraciones` son los puntos que recibió cada jugador: {a1, a2, b1,
 * b2}. Cada pareja la valora una persona de la pareja contraria
 * repartiendo 6 puntos, así que cada par suma 6 -- o 0 si esa pareja se
 * quedó sin valorar, y entonces se reparte mitad y mitad.
 */
export function enviarValoracion({ fecha, cancha, hora, quienEres, valoraciones }) {
  return llamar(null, {
    method: 'POST',
    body: JSON.stringify({ tipo: 'valoracion', fecha, cancha, hora, quienEres, valoraciones }),
  });
}
