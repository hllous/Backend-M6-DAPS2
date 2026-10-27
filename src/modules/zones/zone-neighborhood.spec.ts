import { zoneNeighborhoodId } from './zone-neighborhood';

const db = (rows: { neighborhoodId: string }[]) =>
  ({ zoneNeighborhood: { findMany: jest.fn().mockResolvedValue(rows) } }) as never;

describe('zoneNeighborhoodId', () => {
  it('devuelve el barrio cuando la zona tiene exactamente uno', async () => {
    await expect(zoneNeighborhoodId(db([{ neighborhoodId: 'n1' }]), 'z')).resolves.toBe('n1');
  });

  it.each([[[]], [[{ neighborhoodId: 'a' }, { neighborhoodId: 'b' }]]])(
    'con cero o varios barrios no adivina',
    async (rows) => {
      await expect(zoneNeighborhoodId(db(rows), 'z')).resolves.toBeUndefined();
    },
  );
});
