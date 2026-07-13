# Ranking dinámico — Club de Pádel

Sistema de ranking basado en resultados reales de partidos (estilo Elo),
corriendo enteramente sobre Google Sheets + Google Forms + Google Apps
Script. Cubre los puntos 1 a 9 del diseño original, incluyendo el QR
único con detección automática de bloque horario (punto 6).

## Qué se resolvió distinto al diseño original, y por qué

- **El "formulario de resultado" (punto 3) es una web app aparte
  (carpeta `web/`, React), no un Google Form ni una página nativa de
  Apps Script.** Google Forms no tiene una pantalla nativa de "revisá
  el resumen antes de enviar". Esta web app sí la tiene (paso
  Formulario → Confirmación → Enviado). Apps Script (`WebApp.gs`) queda
  solo como backend: responde JSON (contexto y guardado de resultado),
  ya no sirve HTML. Como el punto 6 (QR) usa esta misma página, no se
  duplica trabajo: la detección automática de horario vive ahí, no se
  reconstruye aparte.
- **El "Ranking" y el "Puntaje actual" de cada jugador son 100%
  fórmulas que leen Historial**, no valores que un script sobrescribe.
  Esto es justo lo que pedías en el punto 8: si el administrador carga
  un partido faltante agregando una fila a Historial, el puntaje de
  todos los involucrados se recalcula solo. Nunca hay que "actualizar
  el Ranking" a mano ni por script.
- **Ya no hace falta un script de "sincronizar el desplegable" del
  punto 5.** Como el formulario de resultado es una página propia, lee
  la lista de jugadores en vivo desde la pestaña Jugadores cada vez que
  alguien la abre. Un Google Form nativo sí necesitaría ese script de
  sincronización; esta web app no.
- **La selección de los 4 jugadores** quedó como pediste: 2 grupos de
  checkboxes (uno por equipo), con JS que bloquea marcar más de 2 por
  equipo y que impide repetir un jugador entre equipos.
- **Como todas las canchas comparten el mismo horario**, en cualquier
  momento hay como máximo un único bloque "recién terminado" (no uno
  por cancha). Por eso, cuando terminan varios partidos a la vez, lo
  que varía entre las opciones para elegir es la cancha, no el horario
  — tal como pediste en el ejemplo ("cancha 3 de 5:30 a 7:00 y cancha 6
  de 5:30 a 7:00").

## Instalación (una sola vez)

1. Andá a [script.google.com](https://script.google.com) → Nuevo
   proyecto.
2. Borrá el contenido de `Code.gs` que viene por defecto.
3. Creá un archivo por cada uno de estos y pegá el contenido
   correspondiente de la carpeta `apps-script/`:
   - `Config.gs`
   - `Setup.gs`
   - `RegistroTrigger.gs`
   - `Elo.gs`
   - `WebApp.gs`
4. Arriba, en el desplegable de funciones, elegí `setupClub` y tocá
   **Ejecutar**. La primera vez pide autorización — es tu propio script
   accediendo a tus propios Sheets/Forms, aceptá los permisos.
5. Abrí **Ver → Registros de ejecución** (o `Ctrl+Enter`) para ver los
   dos links que imprime: el de la planilla y el del formulario de
   registro. Guardalos.
6. Publicá el backend: **Implementar → Nueva implementación**, tipo
   **Aplicación web**. Configurá:
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién tiene acceso: **Cualquier usuario**
   Tocá Implementar y copiá el link (termina en `/exec`). Este link
   responde JSON, no una página — no lo abras esperando ver un
   formulario.
7. Configurá y publicá el frontend: en `web/src/lib/api.js`, pegá ese
   link en `API_URL`. Después corré `cd web && npm install && npm run
   build` y publicá la carpeta `web/dist` en el hosting que elijas
   (Netlify, Vercel, GitHub Pages, etc.). El link público que te da ese
   hosting es el que vas a compartir con el club.
8. Generá el QR de **ese link del hosting** (no el de Apps Script) e
   imprimilo una sola vez — no cambia mientras no cambies de hosting.
   Actualizar `web/` y volver a hacer build + deploy no rompe el QR;
   solo lo rompería publicar en una URL nueva. Del lado del backend, una
   actualización de código normal ("Gestionar implementaciones → Editar
   → Nueva versión") tampoco rompe el link de `/exec`.

Con eso ya está: planilla, formulario de registro y web app de
resultado (con detección de horario) funcionando.

## Antes de invitar jugadores

Abrí la pestaña **Categorías** de la planilla y ajustá:

- Los rangos de puntos reales de cada categoría (los que vienen
  cargados — sexta 0-10, quinta 11-20, etc. — son solo el ejemplo del
  diseño original). Para fijarlos bien, contá cuántos jugadores activos
  tenés hoy en cada categoría y repartí el ancho de cada rango en
  función de eso.
- **K** (fila 9, columna B): máximo de puntos que mueve un solo
  partido.
- **D** (fila 10, columna B): qué tan determinante es la diferencia de
  nivel en el resultado esperado.
- **Canchas** (fila 11): lista separada por coma, tal cual las vas a
  ofrecer en el desplegable.
- **Horario** (filas 13-16): apertura, cierre, duración de bloque y
  ventana de detección. Vienen cargados con 07:00 a 22:00 en bloques de
  90 minutos (10 bloques por día) y una ventana de detección de 30
  minutos, según lo que confirmaste. Si el club cambia de horario más
  adelante, se edita ahí, sin tocar código.

### Cómo calibrar K y D

La lógica del diseño original: decidí cuántos partidos querés que le
tome a alguien mal anotado corregir su nivel (4 o 5 es razonable).

```
K = ancho_de_categoría / partidos_de_referencia
```

Ejemplo: categorías de ancho 10, con 5 partidos de referencia → K = 2.

D regula qué tan "seguro" está el sistema de que el favorito debería
ganar. Un punto de partida razonable es `D = 2 × ancho_de_categoría`
(con ancho 10, D = 20, que es el valor por defecto ya cargado). Si
D es muy chico, alguien que sube una categoría a probarse va a perder
casi todos los puntos incluso jugando parejo. Si es muy grande, ganar o
perder deja de reflejar bien la diferencia de nivel. Después de las
primeras semanas de uso real, mirá el Historial: si la gente mal
anotada tarda muchos más partidos que los 4-5 esperados en salir de su
categoría, bajá D o subí K.

## Cómo se calcula cada partido

Para cada partido: promedio de puntaje de la pareja A, promedio de la
pareja B, resultado esperado de A con la fórmula Elo, delta de puntos
= `K × (resultado_real_A - resultado_esperado_A)`. La pareja B recibe
exactamente el delta opuesto (sistema de suma cero). El detalle está en
`Elo.gs`.

## Administración

- El administrador tiene que mirar la planilla en modo lectura y nunca
  tocar la columna "Puntaje actual" de Jugadores ni la pestaña Ranking
  a mano — son fórmulas.
- Para cargar un partido que nunca se registró: abrí la web app de
  resultado, tildá "Carga por administración", completá el motivo, y
  como fecha/hora poné las reales del partido (no hace falta que sea
  "ahora"). Igual que cualquier otro partido, va a Historial marcado
  con origen "Administración" y motivo, y el puntaje se recalcula solo.
- La web app rechaza automáticamente un segundo resultado para la
  misma combinación de cancha + fecha + hora.
- Google Forms va a crear automáticamente una hoja extra de
  "respuestas crudas" del formulario de registro (algo como "Registro
  de Jugador (Respuestas)") dentro de la misma planilla. Es solo el log
  interno de Forms — la fuente real de verdad es la pestaña Jugadores,
  esa hoja se puede ignorar u ocultar.

## Reglas de uso para el grupo de WhatsApp

Fijá los rangos numéricos de cada categoría en la descripción del
grupo. Cada jugador se fija su puntaje en Ranking y se anota solo si
cae dentro del rango de la categoría anunciada — nadie aprueba nada a
mano.

Las primeras 3-4 semanas conviene recordar activamente llenar el
formulario después de cada partido, hasta que se forme el hábito.

## Cómo funciona el QR y la detección de horario (punto 6)

Un solo link/QR para todo el club (el de la web app). Al abrirlo,
`getContext()` calcula qué bloque de 90 minutos terminó dentro de la
ventana de detección (30 min por defecto) y decide qué mostrar:

- **Un solo partido pendiente de cargar:** cancha y hora quedan
  precargadas, la persona pasa directo a elegir los 4 jugadores y el
  resultado.
- **Varios partidos recién terminados en distintas canchas:** aparece
  una lista corta de botones, uno por cancha pendiente, con el mismo
  horario detectado (ej. "Cancha 3 (17:30–19:00)", "Cancha 6
  (17:30–19:00)"). Al tocar uno, se precarga y sigue igual que el caso
  anterior.
- **No se detectó ningún bloque recién terminado** (o ya está todo
  cargado): selector manual de cancha y hora, igual que si no hubiera
  QR — esto cubre el caso "si el bloque no aparece por algún motivo".

Un partido ya cargado para una cancha+fecha+hora nunca vuelve a
aparecer como pendiente, y un segundo intento de cargarlo se rechaza
con un error explícito (mismo mecanismo de duplicados que ya existía
para cargas manuales).

## Orden de lanzamiento sugerido

Recomendado: lanzarlo primero compartiendo el link de la web app
directo por WhatsApp (sin imprimir el QR todavía) y probarlo unas
semanas con el grupo real. Una vez que el hábito de cargar resultados
esté instalado, imprimir el QR y pegarlo en el club para que el flujo
con detección automática de horario reemplace al link compartido.
