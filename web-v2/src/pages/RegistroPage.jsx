import { useCallback, useEffect, useMemo, useState } from 'react';
import { getContext, registrarJugador } from '@/lib/api';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlowShell } from '@/components/FlowShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CircleCheckIcon } from 'lucide-react';

/**
 * Alta de jugador. Reemplaza al Google Form que se usaba antes.
 *
 * La razón de que esto viva en la app y no en un formulario de Google es
 * el aviso en vivo de nombre repetido: si ya hay un "Juan Pérez", el
 * segundo Juan Pérez tiene que enterarse MIENTRAS escribe. Es el único
 * momento en que está presente la única persona que sabe que son dos
 * personas distintas. Un Google Form no puede mirar la lista de
 * jugadores, así que ahí el duplicado entraba sin que nadie lo notara y
 * después ya no había forma de distinguirlos: ni para quien carga un
 * resultado (ve dos opciones idénticas) ni para el club.
 *
 * El backend vuelve a chequear el duplicado al guardar (ver
 * registrarJugador_ en Jugadores.js). Este chequeo del cliente es solo
 * para avisar antes de que la persona toque el botón.
 */
export default function RegistroPage() {
  const [estado, setEstado] = useState('cargando');
  const [ctx, setCtx] = useState(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [registrado, setRegistrado] = useState(null);

  const cargar = useCallback(() => {
    setEstado('cargando');
    getContext()
      .then((data) => {
        setCtx(data);
        setEstado('form');
      })
      .catch((err) => {
        console.error(err);
        setEstado('error');
      });
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Misma normalización que normalizarNombre_ en apps-script/Jugadores.js:
  // sin acentos, sin mayúsculas y sin espacios de más, para que "Juan
  // Pérez" y "juan perez" cuenten como el mismo nombre. Si se cambia una,
  // hay que cambiar la otra.
  const normalizar = (texto) =>
    String(texto || '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const yaExiste = useMemo(() => {
    if (!ctx || normalizar(nombre).length < 3) return null;
    const clave = normalizar(nombre);
    return ctx.jugadores.find((j) => normalizar(j.nombre) === clave) || null;
  }, [ctx, nombre]);

  function enviar() {
    setError('');
    setEnviando(true);
    registrarJugador({ nombre, categoria })
      .then((jugador) => setRegistrado(jugador))
      .catch((err) => setError(err.message))
      .finally(() => setEnviando(false));
  }

  const puedeEnviar = normalizar(nombre).length >= 3 && categoria && !yaExiste && !enviando;

  if (estado === 'cargando') {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-white">
          <img src="/pelota-tenis.svg" alt="" className="size-6 animate-spin" />
          Cargando…
        </div>
      </div>
    );
  }

  if (estado === 'error') {
    return (
      <div className="mx-auto max-w-md space-y-4 p-4">
        <Alert variant="error">
          <AlertDescription>No pudimos cargar el registro. Revisa tu conexión e inténtalo de nuevo.</AlertDescription>
        </Alert>
        <Button variant="secondary" className="w-full" onClick={cargar}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (registrado) {
    return (
      <FlowShell>
        <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#16432c]">
          <CircleCheckIcon className="size-7 text-primary" />
        </div>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">¡Listo, {registrado.nombre}!</CardTitle>
          <p className="text-base text-muted-foreground">
            Ya estás en el ranking, en {registrado.categoria}, con {registrado.puntaje} puntos.
            Tu puntaje se va a mover solo a medida que cargues resultados.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button className="w-full" render={<a href="#ranking" />}>
            Ver ranking
          </Button>
        </CardContent>
      </FlowShell>
    );
  }

  return (
    <FlowShell>
      <svg
        aria-hidden="true"
        viewBox="0 0 460 175"
        preserveAspectRatio="xMidYMid slice"
        className="aspect-[21/9] w-full rounded-t-[calc(var(--radius-2xl)-1px)]"
      >
        <rect width="460" height="175" fill="#16432c" />
        <circle cx="150" cy="90" r="34" fill="none" stroke="#83e17e" strokeWidth="4" />
        <circle cx="150" cy="90" r="9" fill="#83e17e" />
        <circle cx="300" cy="60" r="22" fill="none" stroke="#83e17e" strokeWidth="4" opacity="0.5" />
        <circle cx="340" cy="120" r="14" fill="none" stroke="#83e17e" strokeWidth="3" opacity="0.32" />
      </svg>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">Regístrate en el ranking</CardTitle>
          <p className="text-base text-muted-foreground">
            Se hace una sola vez. Tu puntaje inicial sale de la categoría que elijas.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre y apellido</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Juan Pérez"
              autoComplete="name"
              size="lg"
            />
            {yaExiste && (
              <Alert variant="error">
                <AlertDescription>
                  <p>
                    Ya hay un jugador registrado como <strong>{yaExiste.nombre}</strong>.
                  </p>
                  <p>
                    <strong>¿Eres tú?</strong> Ya estás en el ranking, no necesitas
                    registrarte de nuevo.
                  </p>
                  <p>
                    <strong>¿Eres otra persona con el mismo nombre?</strong> Agrega algo que
                    te distinga <strong>en este mismo campo, después de tu nombre</strong>.
                    Por ejemplo:
                  </p>
                  <div className="flex flex-col gap-1 rounded-md bg-foreground/5 px-3 py-2 font-medium text-foreground">
                    <span>{yaExiste.nombre} M.</span>
                    <span>{yaExiste.nombre} (Colo)</span>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">¿Qué categoría consideras tener?</Label>
            <Select
              aria-label="Categoría"
              items={(ctx.categorias || []).map((c) => ({ label: c, value: c }))}
              value={categoria || null}
              onValueChange={setCategoria}
            >
              <SelectTrigger id="categoria" size="lg">
                <SelectValue placeholder="Elige tu categoría" />
              </SelectTrigger>
              <SelectPopup>
                {(ctx.categorias || []).map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
          </div>

          {error && (
            <Alert variant="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button className="w-full" onClick={enviar} disabled={!puedeEnviar}>
            {enviando ? 'Registrando…' : 'Registrarme'}
          </Button>
        </CardContent>
    </FlowShell>
  );
}
