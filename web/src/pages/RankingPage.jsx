import { useEffect, useMemo, useState } from 'react';
import { getRanking } from '@/lib/api';
import { formatearFechaLegible } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownIcon, ArrowUpIcon, MinusIcon, SearchIcon } from 'lucide-react';

function redondear1_(n) {
  return Math.round(n * 10) / 10;
}

export default function RankingPage() {
  const [estado, setEstado] = useState('cargando'); // cargando | listo | error
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    getRanking()
      .then((d) => {
        setData(d);
        setEstado('listo');
      })
      .catch((err) => {
        setError(err.message);
        setEstado('error');
      });
  }, []);

  const filtrados = useMemo(() => {
    if (!data) return [];
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return data.jugadores;
    return data.jugadores.filter((j) => j.nombre.toLowerCase().includes(texto));
  }, [busqueda, data]);

  if (estado === 'cargando') {
    return (
      <div className="mx-auto flex min-h-svh max-w-2xl items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Spinner className="size-6" />
          Cargando…
        </div>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <Alert variant="error">
          <AlertDescription>No se pudo cargar el ranking: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>Ranking</CardTitle>
            <p className="text-xs text-muted-foreground">Actualizado hoy ({formatearFechaLegible(data.actualizado)})</p>
          </div>
          <a href="#" className="text-xs text-muted-foreground underline">
            Cargar resultado
          </a>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar tu nombre…"
              className="pl-8"
            />
          </div>

          {busqueda.trim() && filtrados.length === 0 && (
            <p className="text-sm text-muted-foreground">No encontramos a nadie con ese nombre.</p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Posición</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead className="text-right">Puntaje</TableHead>
                <TableHead className="text-right">Último partido</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((j) => (
                <TableRow key={j.nombre}>
                  <TableCell className="text-muted-foreground">{j.puesto}</TableCell>
                  <TableCell className="font-medium">{j.nombre}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{j.categoria}</Badge>
                  </TableCell>
                  <TableCell className="text-right">{redondear1_(j.puntaje)}</TableCell>
                  <TableCell className="text-right">
                    <Tendencia delta={j.deltaUltimoPartido} fecha={j.fechaUltimoPartido} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
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
