# Ranking dinámico — Club de Pádel

Sistema de ranking basado en resultados reales de partidos (estilo Elo),
corriendo enteramente sobre Google Sheets + Google Forms + Google Apps
Script. Cubre los puntos 1 a 9 del diseño original, incluyendo el QR
único con detección automática de bloque horario (punto 6).

## Qué se resolvió distinto al diseño original, y por qué

- **El "formulario de resultado" (punto 3) es una web app aparte
  (carpeta `web-v2/`, React), no un Google Form ni una página nativa de
  Apps Script.** Google Forms no tiene una pantalla nativa de "revisá
  el resumen antes de enviar". Esta web app sí la tiene (paso
  Formulario → Confirmación → Enviado). Apps Script (`WebApp.js`) queda
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

1. **Habilitá la API de Apps Script** en tu cuenta de Google: andá a
   [script.google.com/home/usersettings](https://script.google.com/home/usersettings)
   y activá "Apps Script API". Sin esto, `clasp` no puede pushear código.
2. Instalá dependencias desde la raíz del repo (trae `clasp`, la CLI
   oficial de Apps Script, como dependencia del proyecto):
   ```
   npm install
   ```
   Después logueate con la cuenta de Google del club:
   ```
   npx clasp login
   ```
   El login guarda las credenciales en `~/.clasprc.json`, fuera del
   repo, así que se hace una sola vez por máquina y no por proyecto.
3. Este repo ya tiene un `.clasp.json` apuntando al proyecto real
   (`rootDir: apps-script/`). Si estás armando el proyecto desde cero,
   creá uno nuevo con `npx clasp create-script --type webapp --rootDir
   ./apps-script` y reemplazá el `scriptId` en `.clasp.json`.
4. Subí el código:
   ```
   npm run push
   ```
5. En el editor de Apps Script (`npm run open`), elegí
   `setupClub` en el desplegable de funciones y tocá **Ejecutar**. La
   primera vez pide autorización — es tu propio script accediendo a tus
   propios Sheets/Forms, aceptá los permisos.
6. **Ver → Registros de ejecución** (o `Ctrl+Enter`) para ver los dos
   links que imprime: el de la planilla y el del formulario de
   registro. Guardalos.
7. Publicá el backend (primera vez, desde el editor web): **Implementar
   → Nueva implementación**, tipo **Aplicación web**, ejecutar como
   "Yo", acceso "Cualquier usuario". Copiá el link (termina en `/exec`)
   — responde JSON, no lo abras esperando ver un formulario.
8. Configurá y publicá el frontend: en `web-v2/src/lib/api.js`, pegá ese
   link en `API_URL`. Después `cd web-v2 && npm install && npm run build`
   y publicá `web-v2/dist` en el hosting que elijas. Ese link público es
   el que se comparte con el club y el que se convierte en QR.

**Este proyecto ya está publicado en Vercel**:
[padel-ranking-arrieta-v2.vercel.app](https://padel-ranking-arrieta-v2.vercel.app).
El proyecto de Vercel es `padel-ranking-arrieta-v2` (team `little-busy`),
con Root Directory `web-v2`, conectado a este repo en la rama `main`.
**Cada push a `main` publica solo**, no hace falta correr ningún comando.

Para republicar a mano igual (desde otra máquina, o sin esperar al push):
```
# desde la RAÍZ del repo, no desde web-v2/
VERCEL_ORG_ID=team_AsltlRnWVjqeyPBZJbDQvOfh \
VERCEL_PROJECT_ID=prj_hKDtBch57dUGQ6Ke4zH5qIlXxSTf \
  npx vercel --prod
```
Dos trampas de ese comando, las dos verificadas a mano:

- **Hay que correrlo desde la raíz del repo.** Si se corre desde
  `web-v2/`, Vercel le suma el Root Directory del proyecto y termina
  buscando `web-v2/web-v2`, que no existe.
- **Hay que pasar el `VERCEL_PROJECT_ID`.** El `.vercel/` de la raíz
  apunta al proyecto viejo (`padel-ranking-arrieta`, Root Directory
  `web`), así que sin esas variables se publica la v1.

### La carpeta `web/` es la versión anterior

`web/` es el frontend v1 y **ya no se usa**: quedó como referencia. Su
proyecto de Vercel (`padel-ranking-arrieta`) sigue en línea en
[padel-ranking-arrieta.vercel.app](https://padel-ranking-arrieta.vercel.app)
y en `web-ashy-pi-16.vercel.app`, sirviendo el último build que se le
hizo, para no romperle el link a nadie que lo tenga guardado.

**Su auto-deploy está desconectado desde el 2026-07-29**, así que los
pushes a `main` ya no lo republican y editar `web/` no manda nada a
producción. El proyecto no se borró justamente para no matar esas dos
URLs. Si algún día hiciera falta reconectarlo (no hay comando de CLI para
esto, solo API):
```
POST https://api.vercel.com/v9/projects/prj_fkIs5E920hcnuX1uGwk0Wd3OmeeF/link?teamId=team_AsltlRnWVjqeyPBZJbDQvOfh
{"type":"github","repo":"Leandropov/padel-ranking-arrieta"}
```
Conectar el repo por API **no dispara un build**: hay que provocarlo con
un push.

Ojo si se toca algo de `web/`: ese código **no** tiene el timeout de
`llamar()` que sí tiene la v2, así que ante un backend colgado deja la
pantalla cargando para siempre. No se arregló porque la v1 está
retirada.

### Actualizar el backend después de la instalación

Antes de tocar nada, chequeá que el remoto no tenga ediciones hechas a
mano en el editor web (`push` las pisa sin avisar):
```
npm run pull        # y después git diff
```

El despliegue va **por etapas**, para que producción nunca reciba una
versión sin probar:
```
npm run push                          # 1. sube el código al editor
npm run deploy:test                   # 2. implementación temporal con URL propia
                                      #    → probala con curl -sL "<URL>/exec"
npm run versions                       # 3. anotá el número de versión que creó
npm run promote -- -V <version> -d "descripción del cambio"
npm run undeploy -- <ID_TEMPORAL>     # 4. limpiá la temporal
```

`promote` apunta la implementación de producción a una versión ya
verificada. El ID de producción está fijado dentro del script (en el
`package.json`) a propósito: es el que coincide con la URL `/exec` que
usan `web-v2/src/lib/api.js` y `web/src/lib/api.js`. Si se omite, clasp
crea una implementación **nueva con otra URL** y el frontend deja de
funcionar.

El paso 2 no es opcional por capricho: la implementación `@HEAD` **no
sirve para verificar**, porque pide login de Google y a un `curl`
anónimo le devuelve el HTML de accounts.google.com.

Si el cambio es menor y no amerita la vuelta completa, `npm run
deploy:directo -- -d "descripción"` publica el HEAD actual directo a
producción, sin verificación previa.

Ojo con el `--` en todos los casos: sin él, npm se come las banderas en
vez de pasárselas a clasp.

Otros comandos disponibles:
```
npm run status         # qué archivos subiría el push
npm run deployments    # implementaciones activas y su ID
npm run logs           # últimas entradas de log
npm run open           # abre el editor de Apps Script
npm run whoami         # con qué cuenta estás logueado
```

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
- **Peso del margen del resultado** (fila 18, columna B): cuánto se
  amplifica el K de un partido puntual si el marcador fue contundente
  (ej. doble 6-0 mueve más puntos que un 7-6 en el tercero). 0 lo
  desactiva del todo. En una planilla creada antes de este agregado,
  esta fila no existe todavía y el ajuste queda desactivado (equivale a
  0) hasta que la agregues a mano con esa misma etiqueta.
- **Peso de confiabilidad** (fila 19, columna B): cuánto se ajusta el K
  según qué tan establecido está el jugador menos establecido del
  partido — un debutante mueve más (para encontrarle el nivel real
  rápido), un partido entre puros veteranos mueve menos (para no dejar
  que un mal día puntual les arruine el puntaje). Reutiliza el valor de
  "Partidos de referencia" de abajo como el punto donde el ajuste llega
  a cero. Mismo criterio que el margen: en una planilla vieja esta fila
  no existe y el ajuste queda desactivado hasta que la agregues a mano.
- **Canchas** (fila 11): lista separada por coma, tal cual las vas a
  ofrecer en el desplegable.
- **Horario** (filas 13-16): apertura, cierre, duración de bloque y
  ventana de detección. Vienen cargados con 07:00 a 22:00 en bloques de
  90 minutos (10 bloques por día) y una ventana de detección de 30
  minutos, según lo que confirmaste. Si el club cambia de horario más
  adelante, se edita ahí, sin tocar código.

### Cómo calibrar K y D

La lógica del diseño original: decidí cuántos partidos querés que le
tome a alguien mal anotado corregir su nivel (4 o 5 es razonable). Ese
mismo número ("Partidos de referencia", fila 12) ya no es solo para tu
cálculo a mano: desde el peso de confiabilidad (ver arriba), el código
también lo usa para decidir hasta qué partido tratar a alguien como
debutante.

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
`Elo.js`.

El K de ese cálculo puede amplificarse según qué tan contundente fue el
marcador (ver "Peso del margen del resultado" arriba): nunca lo reduce,
solo le suma peso extra a los partidos muy desparejos, porque de qué
tan parejo se espera el resultado ya se encarga D. Por eso el campo
"Resultado exacto" del formulario pide los juegos del equipo
**ganador** primero en cada set (ej. un partido ganado 6-4, 3-6, 6-2 se
anota así aunque el set del medio se haya perdido) — el orden nunca
depende de quién ganó cada set individual, solo de quién ganó el
partido completo.

El K también se ajusta según qué tan establecido está el jugador menos
establecido de los 4 (ver "Peso de confiabilidad" arriba) — a
diferencia del margen, este sí puede mover el K para abajo: un partido
con un debutante mueve más de lo normal, un partido entre puros
veteranos mueve menos. Los dos ajustes (margen y confiabilidad) se
combinan multiplicando el mismo K base, no se pisan entre sí. El
detalle está en `factorConfiabilidad_`, en `Elo.js`.

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
