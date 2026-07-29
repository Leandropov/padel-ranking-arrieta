/**
 * Prueba de diseño (rama prueba/mobile-sin-caja).
 *
 * Con `?sincaja=1` en la URL, el flujo deja de dibujarse dentro de una
 * caja flotante en el celular y pasa a ocupar la pantalla completa
 * (full-bleed). En desktop no cambia nada: la caja sigue estando.
 *
 * Se lee una sola vez al cargar, no en cada render: la idea es comparar
 * dos versiones abriendo dos URLs, no cambiar de modo en caliente.
 */
export const SIN_CAJA = new URLSearchParams(window.location.search).has('sincaja');
