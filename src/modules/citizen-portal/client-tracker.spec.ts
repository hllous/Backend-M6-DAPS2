import { crearGetTracker } from './client-tracker';

const KEY = 'k'.repeat(32);
const pedido = (headers: Record<string, string | string[]>, ip = '10.0.0.1') => ({ ip, headers });

describe('crearGetTracker', () => {
  const tracker = crearGetTracker(KEY);

  it('con la clave correcta usa la IP del vecino', async () => {
    const req = pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': '203.0.113.7' });
    await expect(tracker(req)).resolves.toBe('203.0.113.7');
  });

  it('dos vecinos por el BFF tienen claves distintas', async () => {
    const a = await tracker(pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': '1.1.1.1' }));
    const b = await tracker(pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': '2.2.2.2' }));
    expect(a).not.toBe(b);
  });

  it('con una lista toma la primera IP', async () => {
    const req = pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': ' 203.0.113.7 , 70.0.0.1' });
    await expect(tracker(req)).resolves.toBe('203.0.113.7');
  });

  it('con clave incorrecta (mismo largo) ignora el X-Forwarded-For', async () => {
    const req = pedido({ 'x-m6-bff-key': 'x'.repeat(32), 'x-forwarded-for': '9.9.9.9' });
    await expect(tracker(req)).resolves.toBe('10.0.0.1');
  });

  it('con clave de otro largo ignora el X-Forwarded-For sin lanzar', async () => {
    const req = pedido({ 'x-m6-bff-key': 'corta', 'x-forwarded-for': '9.9.9.9' });
    await expect(tracker(req)).resolves.toBe('10.0.0.1');
  });

  it('sin clave ignora el X-Forwarded-For', async () => {
    await expect(tracker(pedido({ 'x-forwarded-for': '9.9.9.9' }))).resolves.toBe('10.0.0.1');
  });

  it('con la clave repetida (array) la rechaza', async () => {
    const req = pedido({ 'x-m6-bff-key': [KEY, KEY], 'x-forwarded-for': '9.9.9.9' });
    await expect(tracker(req)).resolves.toBe('10.0.0.1');
  });

  it('con clave válida pero sin X-Forwarded-For (o vacío) usa req.ip', async () => {
    await expect(tracker(pedido({ 'x-m6-bff-key': KEY }))).resolves.toBe('10.0.0.1');
    await expect(tracker(pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': ' ' }))).resolves.toBe(
      '10.0.0.1',
    );
  });

  it('con clave válida pero una primera entrada que no es IP usa req.ip', async () => {
    for (const xff of ['basura', 'unknown', '1.2.3.4:5678', "' OR 1=1"]) {
      await expect(tracker(pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': xff }))).resolves.toBe(
        '10.0.0.1',
      );
    }
  });

  it('acepta una IPv6 válida', async () => {
    const req = pedido({ 'x-m6-bff-key': KEY, 'x-forwarded-for': '2001:db8::1' });
    await expect(tracker(req)).resolves.toBe('2001:db8::1');
  });

  it('sin variable configurada nunca confía en el header', async () => {
    for (const k of [undefined, '']) {
      const t = crearGetTracker(k);
      await expect(t(pedido({ 'x-m6-bff-key': '', 'x-forwarded-for': '9.9.9.9' }))).resolves.toBe(
        '10.0.0.1',
      );
    }
  });
});
