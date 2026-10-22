import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeM1UserId } from '../../../common/decorators';
import { AddCrewMembersDto } from './add-crew-members.dto';
import { CreateCrewDto } from './create-crew.dto';
import { UpdateCrewDto } from './update-crew.dto';

/** #365: los ids de integrantes y líder son ids de M1 (numéricos), no texto libre. */
describe('ids de usuario de cuadrillas', () => {
  const base = { name: 'C1', crewType: 'MUNICIPAL', defaultShift: 'MORNING' };

  it.each(['usr-m1-0101', 'abc', '12a', '-5', '1.5', ' 7', ''])(
    'leaderUserId %p se rechaza',
    async (leaderUserId) => {
      const errs = await validate(plainToInstance(CreateCrewDto, { ...base, leaderUserId }));
      expect(errs.map((e) => e.property)).toContain('leaderUserId');
      const upd = await validate(plainToInstance(UpdateCrewDto, { leaderUserId }));
      expect(upd.map((e) => e.property)).toContain('leaderUserId');
    },
  );

  it('acepta ids numéricos, también con ceros a la izquierda (se normalizan en el service)', async () => {
    for (const leaderUserId of ['42', '0042', '9004']) {
      expect(await validate(plainToInstance(CreateCrewDto, { ...base, leaderUserId }))).toEqual([]);
    }
    expect(normalizeM1UserId('0042')).toBe('42');
  });

  it('userIds: uno solo inválido rechaza el pedido', async () => {
    const mal = await validate(plainToInstance(AddCrewMembersDto, { userIds: ['10', 'usr-1'] }));
    expect(mal.map((e) => e.property)).toContain('userIds');
    expect(await validate(plainToInstance(AddCrewMembersDto, { userIds: ['10', '011'] }))).toEqual(
      [],
    );
  });
});
