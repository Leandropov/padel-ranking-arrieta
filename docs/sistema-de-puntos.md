# Cómo funciona el sistema de puntos y categorías

Documento de referencia para entender de punta a punta cómo se calculan los puntos, cómo se decide la categoría de cada jugador, y qué ajustes puede hacer el club sin tocar código. Todo lo que describe este documento corresponde al código real en `apps-script/` (Config.js, Elo.js, Ranking.js, RegistroTrigger.js, WebApp.js).

## 1. La planilla de Google Sheets

El sistema vive en 4 pestañas:

| Pestaña | Para qué sirve | Quién la edita |
|---|---|---|
| **Jugadores** | Un jugador por fila: nombre, categoría declarada, puntaje inicial, puntaje actual (fórmula) | Se llena sola (formulario de registro + fórmula) |
| **Categorías** | Rangos de puntos por categoría + toda la configuración ajustable del club (K, D, canchas, horarios, PIN) | El club, a mano, cuando quiera ajustar algo |
| **Historial** | Un partido por fila: fecha, cancha, hora, los 4 jugadores, ganador, resultado, delta de cada equipo | Se llena sola al cargar un resultado |
| **Ranking** | Vista de solo lectura, ordenada por puntaje, derivada 100% de Jugadores | Nadie la edita a mano |

### Columnas de "Jugadores"

| Columna | Contenido | ¿Se recalcula sola? |
|---|---|---|
| A - Nombre completo | Lo que la persona escribió al registrarse | No |
| B - Categoría declarada | La categoría que la persona *cree* tener, elegida una sola vez al registrarse | **No, queda fija para siempre** (es solo un dato histórico) |
| C - Puntaje inicial | Punto medio del rango de la categoría declarada | No |
| D - Puntaje actual | `= Puntaje inicial + suma de todos los deltas de Historial donde jugó` | **Sí, es una fórmula, se recalcula sola con cada partido** |

**Importante:** la columna B ("Categoría declarada") *no* es la que ves en el ranking. Lo que ves en el ranking se recalcula por separado, con el puntaje actual — ver sección 4.

## 2. Qué pasa cuando alguien se registra

1. Completa el formulario de registro con su nombre y elige la categoría que cree tener (ej. "Cuarta").
2. El sistema busca esa categoría en la pestaña Categorías y calcula el **punto medio del rango**: con Cuarta = 21 a 30, arranca en `round((21+30)/2) = 26`.
3. Se agrega una fila a Jugadores con ese puntaje inicial. Desde ahí, cada partido que juegue va a mover su puntaje actual (columna D), pero el puntaje inicial (columna C) y la categoría declarada (columna B) nunca cambian.

Si alguien se anota mal (dice ser de una categoría que no le corresponde), el sistema no lo corrige solo al registrarse — se corrige con el tiempo, a medida que juega partidos reales (ver sección 5).

## 3. Cómo se calculan los puntos de cada partido (Elo)

Cada partido mueve el puntaje de los 4 jugadores usando una fórmula tipo Elo (la misma familia de algoritmo que usa el ajedrez y que usa Playtomic). Dos números la controlan, configurables en Categorías:

- **K = 2** (fila 9): el máximo que se puede mover un puntaje en un solo partido.
- **D = 20** (fila 10): qué tanto pesa la diferencia de nivel entre los equipos al decidir qué tan "esperado" era el resultado.

### La fórmula

```
promedioA = (puntaje jugador 1 equipo A + puntaje jugador 2 equipo A) / 2
promedioB = lo mismo para el equipo B

esperadoA = 1 / (1 + 10^((promedioB - promedioA) / D))
   -> "probabilidad" de que gane el equipo A, según la diferencia de nivel

deltaA = K × (resultado_real_A - esperadoA)
   -> resultado_real_A es 1 si ganó A, 0 si perdió A

deltaB = -deltaA   (es de suma cero: lo que gana un equipo lo pierde el otro)
```

El delta que le toca a un equipo se le suma **igual a los 2 jugadores de esa pareja**, sin importar quién jugó mejor ese partido puntual.

### Ejemplos concretos (con K=2, D=20)

| Situación | promedioA | promedioB | esperadoA | Si gana A | Si pierde A |
|---|---|---|---|---|---|
| Partido parejo | 26 | 26 | 0.50 | **+1.0** | **-1.0** |
| A le gana a un rival más fuerte | 26 | 35 | 0.26 | **+1.5** | **-0.5** |
| A le gana a un rival más flojo | 26 | 15 | 0.78 | **+0.4** | **-1.6** |

**La idea, en una frase:** ganarle a alguien mejor suma mucho, ganarle a alguien peor suma poco. Perder contra alguien peor cuesta caro, perder contra alguien mejor casi no duele.

## 4. Cómo se decide la categoría que ves en el ranking

Cada vez que se carga el ranking, el sistema toma el **puntaje actual** de cada jugador (columna D de Jugadores) y lo compara contra los rangos de la pestaña Categorías, para decidir en qué pestaña (Sexta, Quinta, Cuarta, Tercera, Segunda...) aparece. La "Categoría declarada" (columna B) no se usa para esto — solo queda como dato histórico de cuando esa persona se registró.

Esto significa que la categoría de cada jugador **se recalcula sola, en cada actualización del ranking**, sin que nadie tenga que reasignarla a mano.

### Casos posibles

| Caso | Qué pasa |
|---|---|
| Puntaje cae justo dentro de un rango (ej. 27 puntos, Cuarta es 21-30) | Aparece en esa categoría (Cuarta) |
| Puntaje justo en el borde (ej. exactamente 30) | Cuenta para la categoría de abajo (Cuarta, porque 30 es su máximo) |
| Puntaje justo un punto arriba del borde (ej. 31) | Ya cuenta para la categoría de arriba (Tercera, su mínimo) |
| Puntaje por debajo de la categoría más baja definida (ej. negativo) | Se lo deja en la categoría más baja que exista (no rompe ni desaparece) |
| Puntaje por arriba de la categoría más alta definida | Se lo deja en la categoría más alta que exista, aunque la haya superado (ej. si el club nunca cargó "Primera") |
| El club agrega o saca una categoría en la planilla | Se refleja solo, sin tocar código — todo se lee en vivo de la pestaña Categorías |

## 5. ¿Cuántos partidos hacen falta para subir o bajar de categoría?

No hay un número fijo — depende enteramente contra quién jugás. Usando el ejemplo de subir de Cuarta (26) a Tercera (31 = 5 puntos de diferencia):

| Escenario | Partidos aproximados |
|---|---|
| Jugás siempre parejo y ganás todos | ~5 victorias seguidas (+1 cada una) |
| Le ganás seguido a gente de categorías más altas | ~2-4 partidos (cada victoria suma más) |
| Le ganás solo a gente de categorías más bajas | 10+ partidos (cada victoria suma poco) |
| Jugás siempre parejo con resultados mitad y mitad (50% victorias) | **El puntaje no sube ni baja de forma sostenida** — se mantiene estable, porque cada victoria (+1) se cancela con cada derrota (-1) |

**Para bajar de categoría es el mismo mecanismo, invertido:** perder seguido contra rivales más flojos te baja rápido; perder contra rivales más fuertes casi no te mueve.

## 6. Cómo ajustar las reglas (sin tocar código)

Todo esto se edita directamente en la pestaña **Categorías** de la planilla, en las filas de configuración (debajo de la tabla de rangos). No hace falta ningún deploy ni tocar `apps-script/`.

| Si el club quiere... | Qué tocar | Efecto |
|---|---|---|
| Que cambiar de categoría tarde más | **Bajar K** (ej. de 2 a 1) | Cada partido mueve la mitad de puntos — hacen falta el doble de partidos para cruzar cualquier umbral |
| Que cambiar de categoría tarde menos | **Subir K** (ej. de 2 a 3) | Cada partido mueve más puntos — se cruzan los umbrales más rápido |
| Que las categorías sean "más anchas" (cueste más llegar a la siguiente) | **Agrandar el rango de puntos por categoría** (ej. de 10 a 15 puntos cada una) | Cada partido se mueve igual que antes, pero hace falta acumular más puntos netos para cruzar |
| Que las diferencias de nivel importen más o menos en el resultado esperado | **Bajar o subir D** | D chico = se espera casi siempre que gane el favorito (las sorpresas valen mucho más). D grande = los partidos se tratan más parejo sin importar la diferencia de nivel |
| Agregar categorías nuevas (ej. "Primera") | Agregar una fila más en la tabla de rangos | Aparece sola como pestaña nueva en el ranking, sin tocar código |

La celda "Partidos de referencia para corregir un nivel mal asignado" (hoy = 5) es solo una nota para el club, no la usa ningún cálculo — es el número que se usó para elegir K (`K = ancho de categoría ÷ partidos de referencia = 10 ÷ 5 = 2`). Sirve como recordatorio de la fórmula si en algún momento quieren recalcular K a mano.

## 7. Otras reglas del sistema (para tener el cuadro completo)

- **No se puede cargar 2 veces el mismo partido**: se identifica por fecha + cancha + hora exactas. Si alguien intenta cargar un resultado que ya existe con esa combinación, el sistema lo rechaza.
- **Los 4 jugadores de un partido deben ser todos distintos** (no se puede repetir a nadie entre los 2 equipos).
- **Quien carga el resultado debe ser uno de los 4 jugadores del partido**, salvo que se use la carga por administración.
- **Carga por administración** (para partidos que no se cargaron a tiempo, o cargados por alguien que no jugó): requiere un motivo y un PIN. El PIN se bloquea 15 minutos después de 5 intentos fallidos, para evitar que alguien lo adivine a la fuerza.
- **El resultado debe tener formato de sets válido** (ej. "6-4, 6-3"), 2 o 3 sets.
- **El puntaje no tiene piso ni techo real**: puede bajar de 0 o superar el máximo de la categoría más alta sin problema — lo único que tiene un límite son las categorías *que el club haya definido* en la tabla (ver casos de la sección 4).

## Resumen en una imagen mental

```
Te registrás -> elegís categoría -> arrancás en el punto medio de ese rango
      |
      v
Jugás partidos -> cada uno mueve tu puntaje (Elo: K máximo, según qué tan
                   esperado era el resultado)
      |
      v
Tu puntaje actual (columna D de Jugadores) se recalcula solo, sumando
todos los deltas de tu historial
      |
      v
El ranking mira ese puntaje actual contra los rangos de Categorías y te
muestra en la pestaña que te corresponde HOY -- no en la que declaraste
al registrarte
```
