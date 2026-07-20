import { useEffect, useState } from 'react';
import { getContext, submitResultado } from '@/lib/api';
import { PlayerCombobox } from '@/components/PlayerCombobox';
import { ResultadoInput } from '@/components/ResultadoInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatearFechaLegible } from '@/lib/utils';
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CircleCheckIcon, ClipboardCheckIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const vacio = {
  quienEres: '',
  cancha: '',
  hora: '',
  equipoA: [],
  equipoB: [],
  ganador: 'A',
  resultado: '',
  motivo: '',
  pin: '',
};

export default function ResultadoPage() {
  const [paso, setPaso] = useState('cargando');
  const [errorCarga, setErrorCarga] = useState(false);
  const [ctx, setCtx] = useState(null);
  const [form, setForm] = useState(vacio);
  const [fecha, setFecha] = useState('');
  const [modoAdmin, setModoAdmin] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultadoEnvio, setResultadoEnvio] = useState(null);
  const [bloqueElegido, setBloqueElegido] = useState(false);

  useEffect(() => {
    getContext()
      .then((data) => {
        setCtx({ ...data, jugadores: [...data.jugadores].sort((a, b) => a.localeCompare(b, 'es')) });
        setFecha(data.fecha);
        if (data.modo === 'auto') {
          const cancha = data.candidatos[0];
          setForm((f) => ({ ...f, cancha, hora: data.bloque.fin }));
        } else if (data.modo !== 'elegir') {
          // manual: nada precargado
        }
        setPaso('form');
      })
      .catch((err) => {
        console.error(err);
        setErrorCarga(true);
      });
  }, []);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // Al elegir "quién eres" lo ubicamos solo en un equipo, para que no
  // tenga que buscarse a sí mismo de nuevo entre los jugadores. Si ya
  // había elegido un nombre y lo cambia, movemos ese cambio al mismo
  // lugar donde había quedado. En modo administración no aplica: quien
  // carga no necesariamente jugó el partido.
  function elegirQuienEres(v) {
    setForm((f) => {
      let equipoA = f.equipoA;
      let equipoB = f.equipoB;
      if (!modoAdmin && v && !equipoA.includes(v) && !equipoB.includes(v)) {
        if (equipoA.includes(f.quienEres)) {
          equipoA = equipoA.map((n) => (n === f.quienEres ? v : n));
        } else if (equipoB.includes(f.quienEres)) {
          equipoB = equipoB.map((n) => (n === f.quienEres ? v : n));
        } else if (equipoA.length < 2) {
          equipoA = [...equipoA, v];
        }
      }
      return { ...f, quienEres: v, equipoA, equipoB };
    });
  }

  function elegirBloque(cancha, hora) {
    setForm((f) => ({ ...f, cancha, hora }));
    setBloqueElegido(true);
  }

  function cancelarAdmin() {
    setModoAdmin(false);
    setFecha(ctx.fecha);
    actualizar('motivo', '');
    actualizar('pin', '');
  }

  // Estas reglas duplican a mano las de validarPayload_ en
  // apps-script/WebApp.js (no hay forma de compartir código entre un
  // proyecto de Vite y uno de Apps Script sin un build extra) -- si se
  // cambia una regla acá, hay que replicarla ahí, y viceversa.
  function validar(p) {
    if (!p.quienEres) return 'Elige tu nombre de la lista.';
    if (!p.cancha) return 'Elige la cancha.';
    if (!p.hora) return 'Elige el horario del partido.';
    if (p.equipoA.length !== 2) return 'Elige exactamente 2 jugadores para el equipo A.';
    if (p.equipoB.length !== 2) return 'Elige exactamente 2 jugadores para el equipo B.';
    if (!modoAdmin && !p.equipoA.includes(p.quienEres) && !p.equipoB.includes(p.quienEres)) {
      return 'Quien completa el formulario debe ser uno de los 4 jugadores del partido. Si no jugaste, usa la opción de administración.';
    }
    if (!p.resultado) return 'Falta el resultado (ej: 6-4, 6-3).';
    if (!/^\d-\d(, \d-\d){1,2}$/.test(p.resultado)) return 'Completa el resultado de al menos 2 sets (ej: 6-4, 6-3).';
    if (modoAdmin && !p.motivo) return 'Las cargas por administración necesitan un motivo.';
    if (modoAdmin && !p.pin) return 'Ingresa el PIN de administración.';
    return null;
  }

  function irAConfirmar() {
    const err = validar(form);
    setFormError(err || '');
    if (err) return;
    setPaso('confirm');
  }

  function confirmarEnvio() {
    setConfirmError('');
    setEnviando(true);
    submitResultado({ ...form, fecha, cargaAdministracion: modoAdmin })
      .then((res) => {
        setResultadoEnvio(res);
        setPaso('done');
      })
      .catch((err) => setConfirmError(err.message))
      .finally(() => setEnviando(false));
  }

  if (paso === 'cargando') {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center p-4">
        {errorCarga ? (
          <Alert variant="error">
            <AlertDescription>No pudimos cargar los datos del partido. Intenta de nuevo en un momento.</AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col items-center gap-3 text-foreground">
            <img src="/pelota-tenis.svg" alt="" className="size-6 animate-spin" />
            Cargando datos del partido…
          </div>
        )}
      </div>
    );
  }

  if (paso === 'done') {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card>
          <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#202020]">
            <CircleCheckIcon className="size-7 text-success" />
          </div>
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">¡Resultado registrado!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <FilaDelta label={resultadoEnvio.equipoA.join(' / ')} delta={resultadoEnvio.deltaA} />
              <FilaDelta label={resultadoEnvio.equipoB.join(' / ')} delta={resultadoEnvio.deltaB} />
            </div>
            <Button className="w-full" render={<a href="#ranking" />}>
              Ver ranking
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paso === 'confirm') {
    return (
      <div className="mx-auto max-w-md p-4">
        <Card>
          <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#202020]">
            <ClipboardCheckIcon className="size-7 text-primary" />
          </div>
          <CardHeader className="text-center">
            <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">Revisa los datos antes de enviar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Fila label="Quién carga" valor={form.quienEres} />
            <Fila label="Cancha" valor={form.cancha} />
            <Fila label="Fecha" valor={fecha} />
            <Fila label="Hora" valor={form.hora} />
            <Fila label="Equipo A" valor={form.equipoA.join(' / ')} />
            <Fila label="Equipo B" valor={form.equipoB.join(' / ')} />
            <Fila label="Ganador" valor={'Equipo ' + form.ganador} />
            <Fila label="Resultado" valor={form.resultado} />
            {modoAdmin && <Fila label="Carga por administración" valor={form.motivo} />}

            {confirmError && (
              <Alert variant="error">
                <AlertDescription>{confirmError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-4 pt-2">
              <Button onClick={confirmarEnvio} disabled={enviando}>
                {enviando ? 'Enviando…' : 'Confirmar y enviar'}
              </Button>
              <Button variant="secondary" onClick={() => setPaso('form')} disabled={enviando}>
                Corregir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // paso === 'form'
  const modo = ctx.modo;
  const labelEquipoA = form.equipoA.length === 2 ? form.equipoA.join(' / ') : 'Equipo A';
  const labelEquipoB = form.equipoB.length === 2 ? form.equipoB.join(' / ') : 'Equipo B';

  return (
    <div className="relative min-h-svh">
      <div className="mx-auto max-w-md p-4">
      <Card>
        <svg
          aria-hidden="true"
          viewBox="0 0 460 175"
          preserveAspectRatio="xMidYMid slice"
          className="aspect-[21/9] w-full rounded-t-[calc(var(--radius-2xl)-1px)]"
        >
          <defs>
            <radialGradient id="revMeshForm" cx="30%" cy="22%" r="95%">
              <stop offset="0%" stopColor="#ff6a3d" />
              <stop offset="42%" stopColor="#ea2804" />
              <stop offset="100%" stopColor="#c01f00" />
            </radialGradient>
          </defs>
          <rect width="460" height="175" fill="url(#revMeshForm)" />
          <circle cx="150" cy="90" r="34" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.9" />
          <circle cx="150" cy="90" r="9" fill="#ffffff" />
          <circle cx="300" cy="60" r="22" fill="none" stroke="#ffffff" strokeWidth="4" opacity="0.5" />
          <circle cx="340" cy="120" r="14" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.35" />
        </svg>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">Anota el resultado de tu partido</CardTitle>
          <p className="text-base text-muted-foreground">Completa los datos del partido para actualizar el ranking.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {modo === 'elegir' && !bloqueElegido ? (
            <div className="space-y-4">
              <p className="text-sm">Selecciona la cancha en la que acabas de jugar</p>
              {ctx.candidatos.map((cancha) => (
                <Button
                  key={cancha}
                  variant="secondary"
                  className="w-full"
                  onClick={() => elegirBloque(cancha, ctx.bloque.fin)}
                >
                  {cancha} ({ctx.bloque.inicio}–{ctx.bloque.fin})
                </Button>
              ))}
            </div>
          ) : (
            <>
              {modo === 'auto' && (
                <Alert variant="info">
                  <AlertDescription>
                    Detectamos que {ctx.candidatos[0]} terminó a las {ctx.bloque.fin}. Si no es correcto, corrígelo
                    abajo.
                  </AlertDescription>
                </Alert>
              )}
              {modo === 'elegir' && bloqueElegido && (
                <Alert variant="info">
                  <AlertDescription className="text-center">
                    Resultados de {form.cancha} ({ctx.bloque.inicio}–{ctx.bloque.fin}).{' '}
                    <button
                      type="button"
                      className="underline"
                      onClick={() => setBloqueElegido(false)}
                    >
                      Elegir otra cancha
                    </button>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label>¿Quién eres?</Label>
                <PlayerCombobox
                  players={ctx.jugadores}
                  value={form.quienEres}
                  onChange={elegirQuienEres}
                  placeholder="Escribe tu nombre…"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Cancha</Label>
                <Select
                  aria-label="Cancha"
                  items={ctx.canchas.map((c) => ({ label: c, value: c }))}
                  value={form.cancha || null}
                  onValueChange={(v) => actualizar('cancha', v)}
                >
                  <SelectTrigger size="lg">
                    <SelectValue placeholder="Elige una cancha" />
                  </SelectTrigger>
                  <SelectPopup>
                    {ctx.canchas.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>

              {modoAdmin ? (
                <div className="space-y-1.5">
                  <Label>Fecha del partido</Label>
                  <Input
                    type="date"
                    value={fecha}
                    max={ctx.fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    size="lg"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <Label>Fecha del partido</Label>
                  <span className="text-sm text-muted-foreground">Hoy ({formatearFechaLegible(fecha)})</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Hora en que terminó</Label>
                <Select
                  aria-label="Hora"
                  items={ctx.bloquesDelDia.map((b) => ({ label: `${b.inicio}–${b.fin}`, value: b.fin }))}
                  value={form.hora || null}
                  onValueChange={(v) => actualizar('hora', v)}
                >
                  <SelectTrigger size="lg">
                    <SelectValue placeholder="Elige un horario" />
                  </SelectTrigger>
                  <SelectPopup>
                    {ctx.bloquesDelDia.map((b) => (
                      <SelectItem key={b.fin} value={b.fin}>
                        {b.inicio}–{b.fin}
                      </SelectItem>
                    ))}
                  </SelectPopup>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Equipo A (elige 2)</Label>
                <PlayerCombobox
                  players={ctx.jugadores}
                  value={form.equipoA}
                  onChange={(v) => actualizar('equipoA', v)}
                  exclude={form.equipoB}
                  multiple
                />
              </div>

              <div className="space-y-1.5">
                <Label>Equipo B (elige 2)</Label>
                <PlayerCombobox
                  players={ctx.jugadores}
                  value={form.equipoB}
                  onChange={(v) => actualizar('equipoB', v)}
                  exclude={form.equipoA}
                  multiple
                />
              </div>

              <div className="space-y-1.5">
                <Label>¿Qué equipo ganó?</Label>
                {/* variant="default" + gap-2.5: dos píldoras SEPARADAS con
                    espacio, en vez del control segmentado pegado (que con el
                    radio pill quedaba como "cápsula torcida"). Cada ítem lleva
                    su propio borde; seleccionado = inversión oscura. */}
                <ToggleGroup
                  aria-label="Ganador"
                  variant="default"
                  size="lg"
                  orientation="vertical"
                  className="w-full gap-2.5"
                  value={[form.ganador]}
                  onValueChange={(vals) => vals.length && actualizar('ganador', vals[0])}
                >
                  {/* h-auto + whitespace-normal: los nombres de una pareja
                      pueden ser largos y el Toggle por defecto es nowrap */}
                  <ToggleGroupItem
                    value="A"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal border-input bg-card px-4 py-2.5 text-left data-pressed:border-foreground data-pressed:bg-foreground data-pressed:text-background"
                  >
                    {labelEquipoA}
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="B"
                    className="h-auto min-h-11 w-full justify-start whitespace-normal border-input bg-card px-4 py-2.5 text-left data-pressed:border-foreground data-pressed:bg-foreground data-pressed:text-background"
                  >
                    {labelEquipoB}
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>

              <div className="space-y-1.5">
                <Label>Resultado exacto (ej: 6-4, 6-3)</Label>
                <ResultadoInput value={form.resultado} onChange={(v) => actualizar('resultado', v)} />
              </div>

              {formError && (
                <Alert variant="error">
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <Button className="w-full" onClick={irAConfirmar}>
                Revisar antes de enviar
              </Button>

              {!modoAdmin ? (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline"
                    onClick={() => setModoAdmin(true)}
                  >
                    ¿El partido no se cargó a tiempo?
                  </button>
                </div>
              ) : (
                <Alert variant="warning">
                  <div className="w-full space-y-3">
                    <div className="space-y-1.5">
                      <Label>Motivo de la carga tardía</Label>
                      <Input
                        value={form.motivo}
                        placeholder="Ej: el jugador se olvidó de cargarlo"
                        onChange={(e) => actualizar('motivo', e.target.value)}
                        size="lg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>PIN de administración</Label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        value={form.pin}
                        onChange={(e) => actualizar('pin', e.target.value)}
                        size="lg"
                      />
                    </div>
                    <Button variant="secondary" className="w-full" onClick={cancelarAdmin}>
                      Cancelar
                    </Button>
                  </div>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function Fila({ label, valor }) {
  return (
    <div className="flex justify-between border-b py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong>{valor}</strong>
    </div>
  );
}

function FilaDelta({ label, delta }) {
  return (
    <div className="flex justify-between border-b py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <strong className={'font-mono tabular-nums ' + (delta > 0 ? 'text-success' : 'text-destructive')}>{fmtDelta(delta)}</strong>
    </div>
  );
}

function fmtDelta(n) {
  return (n > 0 ? '+' : '') + n;
}
