// URL de la web app de Apps Script (backend). Si el día de mañana se
// vuelve a implementar con "Nueva versión", la URL no cambia -- solo
// cambiaría si se crea una implementación completamente nueva.
export const API_URL =
  'https://script.google.com/macros/s/AKfycbyIWdxh5iUBrjFclCeMZdfyl1N5HvK2MgOkioVpAjNmTwih4XzFa3NcSwQcL7PY7IC3/exec';

async function llamar(query, options) {
  const url = query ? API_URL + '?' + query : API_URL;
  const res = await fetch(url, options);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error);
  return data.data;
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
