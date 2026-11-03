import { ConfigService } from '@nestjs/config';
import { CoreClient } from './core.client';
import { CoreRegistryService } from './core-registry.service';
import { parsearArgs } from './unregister-args';

const SUBS: Record<string, unknown>[] = [
  { id: 'a1', eventType: 'zoneNotServiced', moduleName: 'ambiente' },
  { id: 'b2', eventType: 'streetClousureEnded', moduleName: 'ambiente' },
  { id: 'c3', eventType: 'otroEvento', moduleName: 'transito' },
];

function montar(
  opts: {
    subs?: unknown;
    getStatus?: number;
    deleteStatus?: number;
    deleteThrows?: (path: string) => boolean;
  } = {},
) {
  const request = jest.fn((path: string, init: RequestInit = {}) => {
    if (init.method === 'DELETE') {
      if (opts.deleteThrows?.(path)) return Promise.reject(new TypeError('fetch failed'));
      return Promise.resolve(new Response(null, { status: opts.deleteStatus ?? 204 }));
    }
    return Promise.resolve(
      new Response(JSON.stringify(opts.subs ?? SUBS), { status: opts.getStatus ?? 200 }),
    );
  });
  const core = { enabled: true, request } as unknown as CoreClient;
  const config = { get: (_k: string, d: unknown) => d } as unknown as ConfigService;
  return { svc: new CoreRegistryService(core, config), request };
}

const deletes = (request: jest.Mock) =>
  request.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'DELETE');

describe('CoreRegistryService.darDeBaja', () => {
  it('simulacro: no llama DELETE', async () => {
    const { svc, request } = montar();
    const res = await svc.darDeBaja(['zoneNotServiced'], false);
    expect(res).toEqual([{ eventType: 'zoneNotServiced', estado: 'simulacro', cantidad: 1 }]);
    expect(deletes(request)).toHaveLength(0);
  });

  it('--apply: DELETE solo de lo pedido, con el id de la suscripción', async () => {
    const { svc, request } = montar();
    const res = await svc.darDeBaja(['zoneNotServiced'], true);
    expect(res).toEqual([{ eventType: 'zoneNotServiced', estado: 'baja', cantidad: 1 }]);
    expect(deletes(request).map(([p]) => p)).toEqual(['/api/v1/subscriptions/a1']);
  });

  it('id numérico: se usa como string', async () => {
    const { svc, request } = montar({
      subs: [{ id: 7, eventType: 'zoneNotServiced', moduleName: 'ambiente' }],
    });
    await svc.darDeBaja(['zoneNotServiced'], true);
    expect(deletes(request).map(([p]) => p)).toEqual(['/api/v1/subscriptions/7']);
  });

  it.each([
    ['containerDamaged', 'declarado por M6'],
    ['streetClosureEnded', 'declarado por M6'],
    ['../x', 'inválido'],
  ])('rechaza %s sin tocar el Core', async (tipo, msg) => {
    const { svc, request } = montar();
    await expect(svc.darDeBaja(['zoneNotServiced', tipo], true)).rejects.toThrow(msg);
    if (msg === 'declarado por M6') {
      await expect(svc.darDeBaja([tipo], true)).rejects.toThrow(tipo);
    }
    expect(request).not.toHaveBeenCalled();
  });

  it('tolera un tipo no suscripto, de otro módulo o sin moduleName (no se borra)', async () => {
    const { svc, request } = montar({
      subs: [...SUBS, { id: 'z9', eventType: 'sinDueno' }],
    });
    const res = await svc.darDeBaja(['noExiste', 'otroEvento', 'sinDueno'], true);
    expect(res.map((r) => r.estado)).toEqual(['no-suscripto', 'no-suscripto', 'no-suscripto']);
    expect(deletes(request)).toHaveLength(0);
  });

  it('GET con HTTP no-ok o body que no es lista: falla sin DELETE', async () => {
    const a = montar({ getStatus: 500 });
    await expect(a.svc.darDeBaja(['zoneNotServiced'], true)).rejects.toThrow('HTTP 500');
    const b = montar({ subs: { foo: 1 } });
    await expect(b.svc.darDeBaja(['zoneNotServiced'], true)).rejects.toThrow('no es una lista');
    expect(deletes(a.request).length + deletes(b.request).length).toBe(0);
  });

  it.each(['../x', 'a/b'])('id inseguro %s: error y sin DELETE', async (id) => {
    const { svc, request } = montar({
      subs: [{ id, eventType: 'zoneNotServiced', moduleName: 'ambiente' }],
    });
    const res = await svc.darDeBaja(['zoneNotServiced'], true);
    expect(res[0].estado).toBe('error');
    expect(deletes(request)).toHaveLength(0);
  });

  it('error HTTP del DELETE se reporta y sigue con el resto', async () => {
    const { svc } = montar({ deleteStatus: 403 });
    const res = await svc.darDeBaja(['zoneNotServiced', 'streetClousureEnded'], true);
    expect(res.map((r) => [r.eventType, r.estado, r.detalle])).toEqual([
      ['zoneNotServiced', 'error', 'DELETE respondió HTTP 403'],
      ['streetClousureEnded', 'error', 'DELETE respondió HTTP 403'],
    ]);
  });

  it('un DELETE que lanza no pierde lo ya borrado y solo expone el name', async () => {
    const { svc } = montar({ deleteThrows: (p) => p.endsWith('/b2') });
    const res = await svc.darDeBaja(['zoneNotServiced', 'streetClousureEnded'], true);
    expect(res).toEqual([
      { eventType: 'zoneNotServiced', estado: 'baja', cantidad: 1 },
      {
        eventType: 'streetClousureEnded',
        estado: 'error',
        cantidad: 1,
        detalle: 'DELETE falló (TypeError)',
      },
    ]);
  });

  it('tipo duplicado en la entrada: se procesa una vez', async () => {
    const { svc, request } = montar();
    const res = await svc.darDeBaja(['zoneNotServiced', 'zoneNotServiced'], true);
    expect(res).toHaveLength(1);
    expect(deletes(request)).toHaveLength(1);
  });

  it('varias suscripciones del mismo tipo (incluida una inactiva): baja todas e informa la cantidad', async () => {
    const { svc, request } = montar({
      subs: [
        { id: 'a1', eventType: 'zoneNotServiced', moduleName: 'ambiente' },
        { id: 'a2', eventType: 'zoneNotServiced', moduleName: 'ambiente', active: false },
      ],
    });
    const res = await svc.darDeBaja(['zoneNotServiced'], true);
    expect(res).toEqual([{ eventType: 'zoneNotServiced', estado: 'baja', cantidad: 2 }]);
    expect(deletes(request)).toHaveLength(2);
  });
});

describe('parsearArgs', () => {
  it('simulacro por defecto y --type repetible', () => {
    expect(parsearArgs(['--type', 'a', '--type', 'b'])).toEqual({
      tipos: ['a', 'b'],
      apply: false,
    });
  });

  it('--apply activa el borrado', () => {
    expect(parsearArgs(['--type', 'a', '--apply'])).toEqual({ tipos: ['a'], apply: true });
  });

  it.each([
    [['--type', 'a', '--dry-run', '--apply']],
    [['--type', 'a', '--apply=true']],
    [['--type', 'a', '--aply']],
    [['--type=a']],
    [['--type', 'a', 'suelto']],
    [['--apply']],
    [[]],
  ])('falla con %j', (argv) => {
    expect(() => parsearArgs(argv)).toThrow();
  });
});
