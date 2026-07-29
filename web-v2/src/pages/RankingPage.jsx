import { useEffect, useMemo, useState } from 'react';
import { getRanking } from '@/lib/api';
import { formatearFechaLegible } from '@/lib/utils';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlowShell } from '@/components/FlowShell';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownIcon, ArrowUpIcon, SearchIcon, XIcon } from 'lucide-react';

function redondear1_(n) {
  return Math.round(n * 10) / 10;
}

// Forma corta de la categoría para las tags del ranking: el backend
// devuelve el nombre completo ("Tercera") y acá lo mostramos como "3ra".
// Si aparece una categoría no mapeada, se muestra tal cual.
const ABREV_CATEGORIA = {
  primera: '1era',
  segunda: '2da',
  tercera: '3era',
  cuarta: '4ta',
  quinta: '5ta',
  sexta: '6ta',
  séptima: '7ma',
  septima: '7ma',
  octava: '8va',
  novena: '9na',
};
function abreviarCategoria_(nombre) {
  return ABREV_CATEGORIA[String(nombre).trim().toLowerCase()] || nombre;
}

export default function RankingPage() {
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [data, setData] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    getRanking()
      .then((d) => {
        setData(d);
        setEstado('listo');
      })
      .catch((err) => {
        console.error(err);
        setEstado('error');
      });
  }, []);

  const tabs = useMemo(() => {
    if (!data) return [];
    const categorias = [...(data.categorias || [])].reverse();
    return [{ valor: 'global', etiqueta: 'Global' }, ...categorias.map((c) => ({ valor: c, etiqueta: c }))];
  }, [data]);

  // Coinbase de manual sería monocromático, pero acá codificamos las
  // categorías por color a pedido. Se resuelve al estilo Coinbase: la
  // píldora lleva un fondo tintado suave (color al 12%) con el texto en
  // el color pleno, no un bloque saturado. La progresión va de un nivel
  // a otro; si el club agrega más categorías que colores, repite el
  // último. Se evita verde/rojo puros porque son los de la tendencia
  // (▲/▼) y no deben confundirse.
  const ESCALA_CATEGORIAS = ['#0052ff', '#7c3aed', '#d97706', '#db2777', '#0e9d8a', '#64748b'];
  const coloresPorCategoria = useMemo(() => {
    const categorias = data?.categorias || [];
    const mapa = {};
    categorias.forEach((c, i) => {
      mapa[c] = ESCALA_CATEGORIAS[Math.min(i, ESCALA_CATEGORIAS.length - 1)];
    });
    return mapa;
  }, [data]);

  if (estado === 'cargando') {
    return (
      <div className="mx-auto flex min-h-svh max-w-2xl items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-foreground">
          <img src="/pelota-tenis.svg" alt="" className="size-6 animate-spin" />
          Cargando ranking…
        </div>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Alert variant="error">
          <AlertDescription>No pudimos cargar el ranking. Intenta de nuevo en un momento.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <FlowShell ancho="2xl">
        {/* Cover verde bosque (#16432c) con la cancha en lima — el par
            oscuro+lima de la referencia. */}
        <svg
          aria-hidden="true"
          viewBox="0 0 640 210"
          preserveAspectRatio="xMidYMid slice"
          className="aspect-[21/9] w-full rounded-t-[calc(var(--radius-2xl)-1px)]"
        >
          <rect width="640" height="210" fill="#16432c" />
          <g stroke="#83e17e" strokeWidth="3" fill="none">
            <rect x="40" y="30" width="560" height="150" rx="14" />
            <line x1="320" y1="30" x2="320" y2="180" />
            <line x1="150" y1="30" x2="150" y2="180" opacity="0.5" />
            <line x1="490" y1="30" x2="490" y2="180" opacity="0.5" />
          </g>
          <circle cx="320" cy="105" r="6" fill="#83e17e" />
        </svg>
        <CardHeader className="text-center">
          {/* Peso 700 con tracking apretado: la tipografía display pesada de
              Replicate (grotesca condensada), no la calma de Coinbase. */}
          <CardTitle className="font-heading text-[36px] leading-[1.0] font-bold tracking-[-0.035em]">Ranking Oficial</CardTitle>
          <p className="text-base text-muted-foreground">Busca tu nombre y mira cómo cambiaste después del último partido.</p>
          <p className="text-sm text-muted-foreground/70">Última actualización: {formatearFechaLegible(data.actualizado)}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar jugador…"
              className="pl-8 pr-10"
              size="lg"
            />
            {/* Borrar en un toque. A propósito NO devolvemos el foco al
                input: en el celular el teclado tapaba media tabla, así que
                al limpiar conviene que se cierre y se vea el ranking. */}
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-1 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/24 focus-visible:outline-none"
              >
                <XIcon className="size-4" />
              </button>
            )}
          </div>

          <Tabs defaultValue="global">
            <div className="overflow-x-auto">
              <TabsList>
                {tabs.map((t) => (
                  <TabsTrigger key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
            {tabs.map((t) => (
              <TabsContent key={t.valor} value={t.valor}>
                <RankingCategoria
                  jugadores={t.valor === 'global' ? data.jugadores : data.jugadores.filter((j) => j.categoria === t.valor)}
                  busqueda={busqueda}
                  mostrarCategoria={t.valor === 'global'}
                  coloresPorCategoria={coloresPorCategoria}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
    </FlowShell>
  );
}

/**
 * El ranking tiene cinco datos por jugador (puesto, nombre, categoría,
 * puntaje y tendencia) y en un celular de 390px no entran en cinco
 * columnas: la tabla terminaba con scroll horizontal y el puntaje --que
 * es el dato que la gente viene a buscar-- quedaba cortado fuera de
 * pantalla.
 *
 * Así que en celular no es una tabla sino una lista de filas, donde el
 * nombre es lo único que puede partirse en dos líneas y el resto se
 * ordena en columnas de ancho fijo a la derecha. De `sm` para arriba
 * sigue siendo la tabla de siempre, que ahí entra sin problema.
 */
function RankingCategoria({ jugadores, busqueda, mostrarCategoria, coloresPorCategoria }) {
  const filtrados = useMemo(() => {
    const conPosicion = jugadores.map((j, i) => ({ ...j, posicion: i + 1 }));
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return conPosicion;
    return conPosicion.filter((j) => j.nombre.toLowerCase().includes(texto));
  }, [jugadores, busqueda]);

  if (jugadores.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">Todavía no hay jugadores en esta categoría.</p>;
  }

  if (busqueda.trim() && filtrados.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">No encontramos a nadie con ese nombre.</p>;
  }

  return (
    <>
      <ul className="sm:hidden">
        {filtrados.map((j) => (
          <FilaJugador
            key={j.id}
            jugador={j}
            mostrarCategoria={mostrarCategoria}
            coloresPorCategoria={coloresPorCategoria}
          />
        ))}
      </ul>
      <div className="hidden sm:block">
        <TablaCategoria
          filtrados={filtrados}
          mostrarCategoria={mostrarCategoria}
          coloresPorCategoria={coloresPorCategoria}
        />
      </div>
    </>
  );
}

function CategoriaBadge({ categoria, coloresPorCategoria, className }) {
  return (
    <Badge
      variant="secondary"
      className={'text-xs tracking-wide ' + (className || '')}
      style={{
        color: coloresPorCategoria[categoria],
        backgroundColor: `color-mix(in srgb, ${coloresPorCategoria[categoria]} 12%, transparent)`,
      }}
    >
      {abreviarCategoria_(categoria)}
    </Badge>
  );
}

/**
 * Una fila del ranking en celular.
 *
 * Los cinco datos entran en un renglón. El nombre es el único elemento
 * elástico --el único de largo impredecible-- y puede partirse en dos
 * líneas; el `line-clamp-2` evita que un nombre disparatado genere una
 * fila de tres.
 *
 * La jerarquía se resuelve sin tocar tamaños (los tres números comparten
 * `text-sm`) y con solo dos pesos: bold para puesto y puntaje, que son
 * los datos que la gente busca, y medium para nombre y delta. Cada dato
 * se distingue por un canal distinto en vez de por acumulación: los
 * números por peso, el delta por color, y el nombre por familia
 * tipográfica (sans contra el mono de los números).
 */
function FilaJugador({ jugador, mostrarCategoria, coloresPorCategoria }) {
  return (
    <li className="flex items-center gap-2 border-b py-3 last:border-b-0">
      <span className="w-5 shrink-0 text-right font-mono text-sm font-bold tabular-nums">
        {jugador.posicion}
      </span>
      <p className="line-clamp-2 min-w-0 flex-1 font-medium break-words">{jugador.etiqueta}</p>
      {/* Las tres columnas de la derecha llevan ancho fijo y el mismo gap.
          Con los anchos justos --apenas más que su contenido-- la
          separación visual entre número y número queda en ~14px, menos
          que los 24px del padding de la pantalla: así el grupo se lee
          como un bloque de datos y no como tres cosas suel­tas, y el
          delta deja de tener ese hueco raro contra el puntaje. */}
      <div className="flex shrink-0 items-center gap-2">
        {/* La píldora arranca desde la izquierda de su columna, no
            pegada al puntaje: con ancho fijo todas las categorías
            empiezan en la misma x y se leen como columna. El min-w deja
            que crezca si alguna vez aparece una categoría sin abreviatura
            mapeada (ahí se muestra el nombre completo). */}
        <span className="flex min-w-11 shrink-0 justify-start">
          {mostrarCategoria && (
            <CategoriaBadge
              categoria={jugador.categoria}
              coloresPorCategoria={coloresPorCategoria}
              className="px-1.5"
            />
          )}
        </span>
        <span className="w-10 text-right font-mono text-sm font-bold tabular-nums">
          {redondear1_(jugador.puntaje)}
        </span>
        {/* Sin flecha: el signo ya dice la dirección y el color lo
            refuerza, así que la flecha era un tercer canal para el mismo
            dato -- y encima caía justo en el hueco que separa el delta
            del puntaje, haciendo que se leyeran como un solo número. */}
        <span className="w-10 text-right text-sm">
          <Tendencia
            delta={jugador.deltaUltimoPartido}
            fecha={jugador.fechaUltimoPartido}
            conFlecha={false}
          />
        </span>
      </div>
    </li>
  );
}

function TablaCategoria({ filtrados, mostrarCategoria, coloresPorCategoria }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-right">N°</TableHead>
          <TableHead>Nombre</TableHead>
          {mostrarCategoria && <TableHead>Categoría</TableHead>}
          <TableHead className="text-right">Puntaje</TableHead>
          <TableHead className="text-right">Tendencia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtrados.map((j) => (
          // key por id y no por nombre: dos jugadores pueden llamarse
          // igual, y con la key repetida React reusa mal las filas.
          <TableRow key={j.id}>
            {/* Números en font-mono con tabular-nums: el aire de tablero
                financiero preciso de Coinbase (CoinbaseMono). */}
            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{j.posicion}</TableCell>
            <TableCell className="font-medium">{j.etiqueta}</TableCell>
            {mostrarCategoria && (
              <TableCell>
                <CategoriaBadge categoria={j.categoria} coloresPorCategoria={coloresPorCategoria} />
              </TableCell>
            )}
            <TableCell className="text-right font-mono tabular-nums">{redondear1_(j.puntaje)}</TableCell>
            <TableCell className="text-right">
              <Tendencia delta={j.deltaUltimoPartido} fecha={j.fechaUltimoPartido} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// Tendencia al estilo Coinbase: solo color de texto verde/rojo con flecha,
// SIN píldora de fondo (regla estricta del sistema: "color only, never
// background fill"), y el número en mono.
function Tendencia({ delta, fecha, conFlecha = true }) {
  if (delta === null || delta === undefined) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  const titulo = fecha ? 'Último partido: ' + formatearFechaLegible(fecha) : undefined;
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono tabular-nums font-medium text-success" title={titulo}>
        {conFlecha && <ArrowUpIcon className="size-3.5" />} +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono tabular-nums font-medium text-destructive" title={titulo}>
        {conFlecha && <ArrowDownIcon className="size-3.5" />} {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-muted-foreground/60" title={titulo}>
      0
    </span>
  );
}
