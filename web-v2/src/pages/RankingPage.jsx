import { useEffect, useMemo, useState } from 'react';
import { getRanking } from '@/lib/api';
import { formatearFechaLegible } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownIcon, ArrowUpIcon, SearchIcon } from 'lucide-react';

function redondear1_(n) {
  return Math.round(n * 10) / 10;
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
    <div className="mx-auto max-w-2xl p-4">
      <Card>
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
              className="pl-8"
              size="lg"
            />
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
                <TablaCategoria
                  jugadores={t.valor === 'global' ? data.jugadores : data.jugadores.filter((j) => j.categoria === t.valor)}
                  busqueda={busqueda}
                  mostrarCategoria={t.valor === 'global'}
                  coloresPorCategoria={coloresPorCategoria}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TablaCategoria({ jugadores, busqueda, mostrarCategoria, coloresPorCategoria }) {
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
          <TableRow key={j.nombre}>
            {/* Números en font-mono con tabular-nums: el aire de tablero
                financiero preciso de Coinbase (CoinbaseMono). */}
            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">{j.posicion}</TableCell>
            <TableCell className="font-medium">{j.nombre}</TableCell>
            {mostrarCategoria && (
              <TableCell>
                <Badge
                  variant="secondary"
                  className="text-xs uppercase tracking-wide"
                  style={{
                    color: coloresPorCategoria[j.categoria],
                    backgroundColor: `color-mix(in srgb, ${coloresPorCategoria[j.categoria]} 12%, transparent)`,
                  }}
                >
                  {j.categoria}
                </Badge>
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
function Tendencia({ delta, fecha }) {
  if (delta === null || delta === undefined) {
    return <span className="text-muted-foreground/60">—</span>;
  }
  const titulo = fecha ? 'Último partido: ' + formatearFechaLegible(fecha) : undefined;
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono tabular-nums font-medium text-success" title={titulo}>
        <ArrowUpIcon className="size-3.5" /> +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono tabular-nums font-medium text-destructive" title={titulo}>
        <ArrowDownIcon className="size-3.5" /> {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 font-mono tabular-nums text-muted-foreground/60" title={titulo}>
      0
    </span>
  );
}
