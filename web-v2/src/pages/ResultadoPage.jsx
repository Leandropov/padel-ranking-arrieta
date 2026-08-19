import { useCallback, useEffect, useState } from 'react';
import { enviarValoracion, getContext, submitResultado } from '@/lib/api';
import { PlayerCombobox } from '@/components/PlayerCombobox';
import { Marcador } from '@/components/Marcador';
import { ganadorDe, serializarResultado, setsCompletos, setsVacios } from '@/lib/marcador';
import { RepartoValoracion } from '@/components/RepartoValoracion';
import { REPARTO_PAREJO, armarValoraciones } from '@/lib/valoracion';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FlowShell } from '@/components/FlowShell';
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
import { CircleCheckIcon, ClipboardCheckIcon, SmartphoneIcon, UsersIcon } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const vacio = {
  quienEres: '',
  cancha: '',
  hora: '',
  equipoA: [],
  equipoB: [],
  // El marcador es la fuente de verdad: `ganador` y `resultado` (lo que
  // realmente viaja al backend) se derivan de acá recién al enviar.
  sets: setsVacios(),
  // Solo se usa cuando el marcador no alcanza para deducir el ganador
  // (partido abandonado con los sets repartidos).
  ganadorManual: '',
  motivo: '',
  pin: '',
};

const ERROR_GANADOR =
  'Con este marcador no podemos deducir quién ganó. Si el partido se abandonó, indícalo abajo.';

// El marcador decide; `ganadorManual` solo entra si el marcador no
// alcanza (sets repartidos y sin tercero, o sea un abandono).
function ganadorDelPartido(f) {
  return ganadorDe(f.sets) || f.ganadorManual || null;
}

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
  const [pedirGanador, setPedirGanador] = useState(false);
  // Valoración. `repartoUno` es lo que reparte quien cargó sobre la
  // pareja rival; `repartoDos`, lo que reparte un rival sobre la de quien
  // cargó. Quedan en null si esa pantalla se saltó: el backend entiende
  // "sin valorar" y reparte mitad y mitad.
  const [repartoUno, setRepartoUno] = useState(REPARTO_PAREJO);
  const [repartoDos, setRepartoDos] = useState(REPARTO_PAREJO);
  const [puntosA, setPuntosA] = useState(null);
  const [puntosB, setPuntosB] = useState(null);
  const [deltasFinales, setDeltasFinales] = useState(null);

  const cargar = useCallback(() => {
    setErrorCarga(false);
    getContext()
      .then((data) => {
        setCtx({
          ...data,
          jugadores: [...data.jugadores].sort((a, b) => a.etiqueta.localeCompare(b.etiqueta, 'es')),
        });
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

  useEffect(() => {
    cargar();
  }, [cargar]);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  // El formulario guarda ids de jugador (dos personas pueden llamarse
  // igual), pero en pantalla hay que mostrar nombres. `etiqueta` ya
  // viene resuelta del backend: es el nombre, o el nombre más la
  // categoría si hay otro jugador que se llama igual.
  function etiquetaDe(id) {
    const jugador = ctx?.jugadores.find((j) => j.id === id);
    return jugador ? jugador.etiqueta : '';
  }

  function etiquetasDe(ids) {
    return ids.map(etiquetaDe).join(' / ');
  }

  // Lo que se guarda es la hora en que terminó (la de fin del bloque),
  // pero lo que la persona eligió fue el bloque entero "19:00–20:30".
  // Al revisar, ver sólo "20:30" cuesta reconocerlo como el mismo dato.
  function bloqueDe(hora) {
    const bloque = ctx?.bloquesDelDia.find((b) => b.fin === hora);
    return bloque ? bloque.inicio + '–' + bloque.fin : hora;
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
    if (setsCompletos(p.sets).length < 2) {
      return 'Completa el marcador: al menos 2 sets, con los juegos de los dos equipos.';
    }
    if (setsCompletos(p.sets).some((s) => s.a === s.b)) {
      return 'Un set no puede terminar empatado. Revisa el marcador.';
    }
    if (!ganadorDelPartido(p)) return ERROR_GANADOR;
    if (modoAdmin && !p.motivo) return 'Las cargas por administración necesitan un motivo.';
    if (modoAdmin && !p.pin) return 'Ingresa el PIN de administración.';
    return null;
  }

  function irAConfirmar() {
    const err = validar(form);
    setFormError(err || '');
    if (err) {
      // El selector manual de ganador no vive en el formulario: aparece
      // solo cuando el marcador no alcanzó, para no meterle un campo de
      // más al caso normal.
      if (err === ERROR_GANADOR) setPedirGanador(true);
      return;
    }
    setPaso('confirm');
  }

  // --- Valoración -------------------------------------------------------
  // Quien cargó valora a sus RIVALES, nunca a su compañero: los dos
  // compañeros se reparten el mismo total, así que opinar sobre ese
  // reparto sería opinar sobre el puntaje propio. Por eso hacen falta dos
  // personas y por eso el teléfono se pasa una vez.

  // En modo administración quien carga puede no haber jugado, y entonces
  // no tiene nada que valorar.
  function sePuedeValorar() {
    return !modoAdmin && (form.equipoA.includes(form.quienEres) || form.equipoB.includes(form.quienEres));
  }

  const soyDeA = form.equipoA.includes(form.quienEres);
  // La pareja que valora quien cargó es siempre la contraria a la suya.
  const parejaRival = soyDeA ? form.equipoB : form.equipoA;
  const parejaPropia = soyDeA ? form.equipoA : form.equipoB;

  // Guarda el reparto de la pantalla en el lado que corresponda: el mismo
  // control sirve para las dos pantallas, pero según de qué equipo sea
  // quien cargó, lo que sale de cada una es puntosA o puntosB.
  function guardarReparto(puntos, sobreLaPropia) {
    const esEquipoA = sobreLaPropia ? soyDeA : !soyDeA;
    if (esEquipoA) setPuntosA(puntos);
    else setPuntosB(puntos);
    return esEquipoA ? { a: puntos, b: puntosB } : { a: puntosA, b: puntos };
  }

  // Manda la valoración y termina. `pendiente` permite pasar el valor que
  // se acaba de elegir sin esperar a que React aplique el setState.
  function terminarValoracion(pendiente) {
    const a = pendiente && 'a' in pendiente ? pendiente.a : puntosA;
    const b = pendiente && 'b' in pendiente ? pendiente.b : puntosB;

    if (a === null && b === null) {
      setPaso('done');
      return;
    }

    setEnviando(true);
    enviarValoracion({
      fecha,
      cancha: form.cancha,
      hora: form.hora,
      quienEres: form.quienEres,
      valoraciones: armarValoraciones(a, b),
    })
      .then((res) => setDeltasFinales(res.jugadores))
      // Una valoración que no llega no puede arruinar el envío: el
      // partido ya está guardado con el reparto mitad y mitad. Se sigue
      // a la pantalla final igual, sin cartel de error.
      .catch(() => {})
      .finally(() => {
        setEnviando(false);
        setPaso('done');
      });
  }

  function confirmarEnvio() {
    setConfirmError('');
    setEnviando(true);
    // El backend sigue esperando `ganador` ('A'/'B') y `resultado` como
    // string con los juegos del ganador primero; `sets` y `ganadorManual`
    // son del formulario y no viajan.
    const { sets, ganadorManual: _descartado, ...datos } = form;
    const ganador = ganadorDelPartido(form);
    submitResultado({
      ...datos,
      ganador,
      resultado: serializarResultado(sets, ganador),
      fecha,
      cargaAdministracion: modoAdmin,
    })
      .then((res) => {
        setResultadoEnvio(res);
        // El partido ya está guardado y a salvo. Recién ahora se pide la
        // valoración: si alguien abandona de acá en adelante, lo único
        // que se pierde es el matiz de quién jugó mejor.
        setPaso(sePuedeValorar() ? 'valorar-rivales' : 'done');
      })
      .catch((err) => setConfirmError(err.message))
      .finally(() => setEnviando(false));
  }

  if (paso === 'cargando') {
    return (
      <div className="mx-auto flex min-h-svh max-w-md items-center justify-center p-4">
        {errorCarga ? (
          <div className="w-full space-y-4">
            <Alert variant="error">
              <AlertDescription>
                No pudimos cargar los datos del partido. Revisa tu conexión e inténtalo de nuevo.
              </AlertDescription>
            </Alert>
            <Button variant="secondary" className="w-full" onClick={cargar}>
              Reintentar
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-foreground">
            <img src="/pelota-tenis.svg" alt="" className="size-6 animate-spin" />
            Cargando datos del partido…
          </div>
        )}
      </div>
    );
  }

  // Las tres pantallas de la valoración van DESPUÉS del envío: el partido
  // ya está guardado, así que abandonar acá no cuesta nada.
  if (paso === 'valorar-rivales') {
    return (
      <PasoValoracion
        icono={<UsersIcon className="size-7 text-primary" />}
        titulo="¿Quién jugó mejor de los rivales?"
        bajada={'Reparte 6 puntos entre ellos. No suman al ranking: deciden cómo se reparte, entre los dos, lo que ya ganó o perdió esa pareja.'}
        nombreUno={etiquetaDe(parejaRival[0])}
        nombreOtro={etiquetaDe(parejaRival[1])}
        puntos={repartoUno}
        onChange={setRepartoUno}
        enviando={enviando}
        onContinuar={() => {
          guardarReparto(repartoUno, false);
          setPaso('pasar-telefono');
        }}
        onSaltar={() => terminarValoracion(null)}
      />
    );
  }

  if (paso === 'pasar-telefono') {
    return (
      <FlowShell>
        <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#16432c]">
          <SmartphoneIcon className="size-7 text-primary" />
        </div>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">
            Pásale el teléfono a {etiquetaDe(parejaRival[0])}
          </CardTitle>
          <p className="text-base text-muted-foreground">
            Falta que alguien de la otra pareja diga quién jugó mejor de ustedes dos. Tú no puedes
            hacerlo: se repartirían tus propios puntos.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Button className="w-full" onClick={() => setPaso('valorar-propia')} disabled={enviando}>
            Listo, lo tengo
          </Button>
          <Button variant="secondary" onClick={() => terminarValoracion(null)} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Saltar esto'}
          </Button>
        </CardContent>
      </FlowShell>
    );
  }

  if (paso === 'valorar-propia') {
    return (
      <PasoValoracion
        icono={<UsersIcon className="size-7 text-primary" />}
        titulo={'¿Quién jugó mejor de los dos?'}
        bajada={'Reparte 6 puntos entre ellos, como te haya parecido el partido desde el otro lado de la red.'}
        nombreUno={etiquetaDe(parejaPropia[0])}
        nombreOtro={etiquetaDe(parejaPropia[1])}
        puntos={repartoDos}
        onChange={setRepartoDos}
        enviando={enviando}
        textoContinuar="Terminar"
        onContinuar={() => terminarValoracion(guardarReparto(repartoDos, true))}
        onSaltar={() => terminarValoracion(null)}
      />
    );
  }

  if (paso === 'done') {
    return (
      <FlowShell>
        <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#16432c]">
          <CircleCheckIcon className="size-7 text-primary" />
        </div>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">¡Resultado registrado!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Un renglón por jugador y no por pareja: desde que los rivales
              valoran, dos compañeros pueden llevarse distinto, y verlo acá
              es lo que hace que la valoración se explique sola. Si no se
              valoró, los dos números de una pareja son iguales. */}
          <div className="space-y-2">
            {(deltasFinales || deltasPorJugador(resultadoEnvio)).map((j, i) => (
              <FilaDelta key={i} jugadores={[j.nombre]} delta={j.delta} />
            ))}
          </div>
          <Button className="w-full" render={<a href="#ranking" />}>
            Ver ranking
          </Button>
        </CardContent>
      </FlowShell>
    );
  }

  if (paso === 'confirm') {
    return (
      <FlowShell>
        <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#16432c]">
          <ClipboardCheckIcon className="size-7 text-primary" />
        </div>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">Revisa los datos antes de enviar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Fila label="Quién carga" valor={etiquetaDe(form.quienEres)} />
          <Fila label="Cancha" valor={form.cancha} />
          <Fila label="Fecha" valor={formatearFechaLegible(fecha)} />
          <Fila label="Hora" valor={bloqueDe(form.hora)} />
          {modoAdmin && <Fila label="Carga por administración" valor={form.motivo} />}

          {/* El mismo marcador que llenó, en solo lectura: lo que confirma
              se ve igual a lo que escribió, en vez de traducido a las filas
              "Equipo A / Ganador / Resultado" que había antes. */}
          <div className="pt-2">
            <Marcador
              readOnly
              sets={form.sets}
              labelA={etiquetasDe(form.equipoA)}
              labelB={etiquetasDe(form.equipoB)}
            />
          </div>
          {/* Sin frase "Gana X": el check y la negrita del marcador ya lo
              dicen. La excepción es el ganador puesto a mano (partido
              abandonado): ahí el marcador muestra sets repartidos y la
              marca contradice lo que se ve, así que hay que explicar de
              dónde salió. */}
          {ganadorDe(form.sets) === null && (
            <p className="pt-1 text-sm text-muted-foreground">
              Sets repartidos: el ganador lo indicaste tú, no sale del marcador.
            </p>
          )}

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
      </FlowShell>
    );
  }

  // paso === 'form'
  const modo = ctx.modo;
  const labelEquipoA = form.equipoA.length === 2 ? etiquetasDe(form.equipoA) : 'Equipo A';
  const labelEquipoB = form.equipoB.length === 2 ? etiquetasDe(form.equipoB) : 'Equipo B';

  return (
    <div className="relative min-h-svh">
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
                <Label>Marcador — los juegos de cada equipo, set por set</Label>
                <Marcador
                  sets={form.sets}
                  onChange={(v) => actualizar('sets', v)}
                  labelA={labelEquipoA}
                  labelB={labelEquipoB}
                />
              </div>

              {pedirGanador && (
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
                    className="w-full flex-col gap-2.5"
                    value={form.ganadorManual ? [form.ganadorManual] : []}
                    onValueChange={(vals) => vals.length && actualizar('ganadorManual', vals[0])}
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
              )}

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
      </FlowShell>
    </div>
  );
}

// La etiqueta nunca se parte (`shrink-0`): sin eso, un valor largo la
// comprimía y "Equipo A" caía en dos líneas. El valor se alinea a la
// derecha para que, cuando entre en varias líneas, siga leyéndose como
// una columna y no como texto suelto.
function Fila({ label, valor }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <strong className="min-w-0 text-right break-words">{valor}</strong>
    </div>
  );
}

// Los dos jugadores van uno por línea, y acá los nombres son la
// etiqueta y el
// puntaje el valor: el delta no se comprime nunca y queda centrado
// contra el bloque de nombres.
function FilaDelta({ jugadores, delta }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-1.5 text-sm">
      <div className="min-w-0 text-muted-foreground">
        {jugadores.map((nombre, i) => (
          <span key={i} className="block break-words">
            {nombre}
          </span>
        ))}
      </div>
      <strong className={'shrink-0 font-mono tabular-nums ' + (delta > 0 ? 'text-success' : 'text-destructive')}>{fmtDelta(delta)}</strong>
    </div>
  );
}

// Siempre dos decimales y con coma: así los cuatro números quedan
// alineados en columna y se distingue un +0,12 de un +0,05, que es
// justamente lo que la valoración produce en partidos disparejos.
function fmtDelta(n) {
  return (n > 0 ? '+' : n < 0 ? '\u2212' : '') + Math.abs(n).toFixed(2).replace('.', ',');
}

// Aplana la respuesta del envío a un renglón por jugador. Se usa cuando
// no hubo valoración: los dos compañeros comparten el mismo delta, que es
// como funcionaba todo antes.
function deltasPorJugador(res) {
  return [
    ...res.equipoA.map((nombre) => ({ nombre, delta: res.deltaA })),
    ...res.equipoB.map((nombre) => ({ nombre, delta: res.deltaB })),
  ];
}

// Las dos pantallas de valoración son la misma salvo los textos y a quién
// se está valorando, así que comparten cuerpo. El botón de saltar está
// siempre: valorar es opcional y el partido ya quedó guardado.
function PasoValoracion({
  icono,
  titulo,
  bajada,
  nombreUno,
  nombreOtro,
  puntos,
  onChange,
  onContinuar,
  onSaltar,
  enviando,
  textoContinuar = 'Continuar',
}) {
  return (
    <FlowShell>
      <div className="flex aspect-[21/9] w-full items-center justify-center rounded-t-[calc(var(--radius-2xl)-1px)] bg-[#16432c]">
        {icono}
      </div>
      <CardHeader className="text-center">
        <CardTitle className="font-heading text-[34px] leading-[1.0] font-bold tracking-[-0.035em]">
          {titulo}
        </CardTitle>
        <p className="text-base text-muted-foreground">{bajada}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <RepartoValoracion
          nombreUno={nombreUno}
          nombreOtro={nombreOtro}
          puntos={puntos}
          onChange={onChange}
        />
        <div className="flex flex-col gap-4">
          <Button className="w-full" onClick={onContinuar} disabled={enviando}>
            {enviando ? 'Guardando…' : textoContinuar}
          </Button>
          <Button variant="secondary" onClick={onSaltar} disabled={enviando}>
            Saltar
          </Button>
        </div>
      </CardContent>
    </FlowShell>
  );
}
