import { useEffect, useMemo, useState } from 'react';
import { getRanking } from '@/lib/api';
import { formatearFechaLegible } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, SearchIcon } from 'lucide-react';

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

  // Un color por categoría, en una progresión continua de frío (nivel
  // bajo) a cálido (nivel alto) -- se lee como "subiendo de nivel" en
  // vez de una mezcla de colores sueltos. Si el club agrega más
  // categorías que colores definidos, se repite el último tono.
  // Paleta acotada a los acentos terciarios de Wise (cyan/naranja) más
  // neutros, para no competir con el verde primario (reservado a CTAs).
  const ESCALA_CATEGORIAS = ['#1786ab', '#c76a1f', '#0e0f0c', '#454745', '#868685'];
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
        <svg
          aria-hidden="true"
          viewBox="0 0 640 210"
          preserveAspectRatio="xMidYMid slice"
          className="aspect-[21/9] w-full rounded-t-[calc(var(--radius-2xl)-1px)]"
        >
          <rect width="640" height="210" className="fill-primary/25" />
          <g className="fill-none stroke-primary" strokeWidth="3" opacity="0.9">
            <rect x="40" y="30" width="560" height="150" rx="10" />
            <line x1="320" y1="30" x2="320" y2="180" />
            <line x1="150" y1="30" x2="150" y2="180" />
            <line x1="490" y1="30" x2="490" y2="180" />
          </g>
          <circle cx="320" cy="105" r="5" className="fill-foreground/80" />
        </svg>
        <CardHeader className="text-center">
          <CardTitle className="text-[32px] leading-[38.4px] font-semibold tracking-[-0.96px]">Ranking Oficial</CardTitle>
          <p className="text-sm text-muted-foreground">Busca tu nombre y mira cómo cambiaste después del último partido.</p>
          <p className="text-xs text-muted-foreground/70">Última actualización: {formatearFechaLegible(data.actualizado)}</p>
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
          <TableHead className="w-12">N°</TableHead>
          <TableHead>Nombre</TableHead>
          {mostrarCategoria && <TableHead>Categoría</TableHead>}
          <TableHead className="text-right">Puntaje</TableHead>
          <TableHead className="text-right">Tendencia</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtrados.map((j) => (
          <TableRow key={j.nombre}>
            <TableCell className="text-muted-foreground">{j.posicion}</TableCell>
            <TableCell className="font-medium">{j.nombre}</TableCell>
            {mostrarCategoria && (
              <TableCell>
                <Badge
                  variant="outline"
                  style={{
                    color: coloresPorCategoria[j.categoria],
                    borderColor: coloresPorCategoria[j.categoria],
                  }}
                >
                  {j.categoria}
                </Badge>
              </TableCell>
            )}
            <TableCell className="text-right">{redondear1_(j.puntaje)}</TableCell>
            <TableCell className="text-right">
              <Tendencia delta={j.deltaUltimoPartido} fecha={j.fechaUltimoPartido} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Tendencia({ delta, fecha }) {
  if (delta === null || delta === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  const titulo = fecha ? 'Último partido: ' + formatearFechaLegible(fecha) : undefined;
  if (delta > 0) {
    return (
      <Badge variant="success" title={titulo}>
        <ArrowUpIcon /> +{delta}
      </Badge>
    );
  }
  if (delta < 0) {
    return (
      <Badge variant="error" title={titulo}>
        <ArrowDownIcon /> {delta}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" title={titulo}>
      <MinusIcon /> 0
    </Badge>
  );
}
