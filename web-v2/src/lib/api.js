import { MOCK } from '@/lib/layout';

// URL de la web app de Apps Script (backend). Si el día de mañana se
// vuelve a implementar con "Nueva versión", la URL no cambia -- solo
// cambiaría si se crea una implementación completamente nueva.
export const API_URL =
  'https://script.google.com/macros/s/AKfycbyIWdxh5iUBrjFclCeMZdfyl1N5HvK2MgOkioVpAjNmTwih4XzFa3NcSwQcL7PY7IC3/exec';

async function llamar(query, options) {
  const url = query ? API_URL + '?' + query : API_URL;
  const res = await fetch(url, options);
  const data = await res.json();
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

export function getContext() {
  return llamar();
}

export function getRanking() {
  // Ver MOCK en lib/layout.js: atajo de la rama de pruebas para mirar
  // diseño con el backend caído.
  if (MOCK) {
    return fetch('/mock-ranking.json')
      .then((r) => r.json())
      .then((d) => d.data);
  }
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
