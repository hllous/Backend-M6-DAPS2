import { zoneNeighborhoodId } from './zone-neighborhood';

const db = (rows: { neighborhoodId: string }[]) =>
  ({ zoneNeighborhood: { findMany: jest.fn().mockResolvedValue(rows) } }) as never;

const UUID = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

describe('zoneNeighborhoodId', () => {
  it('devuelve el barrio cuando la zona tiene exactamente uno', async () => {
    await expect(zoneNeighborhoodId(db([{ neighborhoodId: UUID }]), 'z')).resolves.toBe(UUID);
  });

  it('un valor que no es UUID (fila vieja de texto libre) se omite', async () => {
    await expect(
      zoneNeighborhoodId(db([{ neighborhoodId: 'barrio-palermo' }]), 'z'),
    ).resolves.toBeUndefined();
  });

  it.each([[[]], [[{ neighborhoodId: 'a' }, { neighborhoodId: 'b' }]]])(
    'con cero o varios barrios no adivina',
    async (rows) => {
      await expect(zoneNeighborhoodId(db(rows), 'z')).resolves.toBeUndefined();
    },
  );
});
