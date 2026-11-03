import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { normalizeM1UserId } from '../../../common/decorators';
import { AddCrewMembersDto, CrewMemberInputDto } from './add-crew-members.dto';
import { CreateCrewZoneAssignmentDto } from './crew-zone-assignment.dto';
import { CreateCrewDto } from './create-crew.dto';
import { UpdateCrewDto } from './update-crew.dto';

/** #365: los ids de integrantes y líder son ids de M1 (numéricos), no texto libre. */
describe('ids de usuario de cuadrillas', () => {
  const base = {
    name: 'C1',
    crewType: 'MUNICIPAL',
    defaultShift: 'MORNING',
    specialty: 'COLLECTION',
  };

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

  it('el tope es de 19 dígitos: 19 pasan y 20 se rechazan', async () => {
    const ok = await validate(
      plainToInstance(CreateCrewDto, { ...base, leaderUserId: '9'.repeat(19) }),
    );
    const mal = await validate(
      plainToInstance(CreateCrewDto, { ...base, leaderUserId: '9'.repeat(20) }),
    );
    expect(ok).toEqual([]);
    expect(mal.map((e) => e.property)).toContain('leaderUserId');
  });

  describe('integrantes con nombre (#454)', () => {
    it('members con nombre opcional es válido', async () => {
      const dto = plainToInstance(AddCrewMembersDto, {
        members: [{ userId: '10', displayName: 'Lucía Fernández' }, { userId: '11' }],
      });
      expect(await validate(dto)).toEqual([]);
      expect(dto.members?.[0]).toBeInstanceOf(CrewMemberInputDto);
    });

    it('el userId de cada member también tiene que ser un id de M1', async () => {
      const errs = await validate(
        plainToInstance(AddCrewMembersDto, { members: [{ userId: 'usr-1' }] }),
      );
      expect(errs.map((e) => e.property)).toContain('members');
    });

    it('un nombre de más de 120 caracteres se rechaza', async () => {
      const errs = await validate(
        plainToInstance(AddCrewMembersDto, {
          members: [{ userId: '10', displayName: 'x'.repeat(121) }],
        }),
      );
      expect(errs.map((e) => e.property)).toContain('members');
    });

    /** Con los dos campos, cada uno se valida igual: antes uno quedaba sin revisar. */
    describe('con members y userIds a la vez', () => {
      const members = [{ userId: '10', displayName: 'Lucía' }];
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      });
      const rechaza = (body: unknown) =>
        pipe.transform(body, { type: 'body', metatype: AddCrewMembersDto }).then(
          () => 'ok',
          (e) => (e instanceof BadRequestException ? 'rechazado' : `error:${String(e)}`),
        );

      it.each([
        ['userIds como string', { members, userIds: '999' }],
        ['userIds con un id no numérico', { members, userIds: ['abc'] }],
        ['userIds vacío', { members, userIds: [] }],
        ['members vacío', { userIds: ['1'], members: [] }],
        ['members con userId inválido', { userIds: ['1'], members: [{ userId: 'x' }] }],
        [
          'displayName de 121 caracteres',
          { userIds: ['1'], members: [{ userId: '2', displayName: 'x'.repeat(121) }] },
        ],
        ['pedido vacío', {}],
      ])('%s se rechaza con 400', async (_nombre, body) => {
        await expect(rechaza(body)).resolves.toBe('rechazado');
      });

      it('los dos campos válidos pasan', async () => {
        await expect(rechaza({ members, userIds: ['1', '2'] })).resolves.toBe('ok');
      });

      it('displayName de exactamente 120 caracteres pasa', async () => {
        await expect(
          rechaza({ members: [{ userId: '2', displayName: 'x'.repeat(120) }] }),
        ).resolves.toBe('ok');
      });
    });

    it('hace falta members o userIds; con cualquiera de los dos alcanza', async () => {
      expect((await validate(plainToInstance(AddCrewMembersDto, {}))).length).toBeGreaterThan(0);
      expect(
        (await validate(plainToInstance(AddCrewMembersDto, { members: [] }))).map(
          (e) => e.property,
        ),
      ).toContain('members');
      expect(await validate(plainToInstance(AddCrewMembersDto, { userIds: ['1'] }))).toEqual([]);
    });
  });

  describe('PATCH: lo que nunca puede ser null (#455)', () => {
    it.each(['specialty', 'name', 'defaultShift'])('%s: null se rechaza', async (campo) => {
      const errs = await validate(plainToInstance(UpdateCrewDto, { [campo]: null }));
      expect(errs.map((e) => e.property)).toEqual([campo]);
    });

    it('lo que no viene no se valida, y los valores buenos pasan', async () => {
      expect(await validate(plainToInstance(UpdateCrewDto, {}))).toEqual([]);
      expect(
        await validate(
          plainToInstance(UpdateCrewDto, {
            name: 'Nueva',
            specialty: 'TREES',
            defaultShift: 'NIGHT',
          }),
        ),
      ).toEqual([]);
    });

    it('los nombres de persona y la zona base sí aceptan null para borrarlos', async () => {
      const dto = plainToInstance(UpdateCrewDto, {
        leaderName: null,
        organizationName: null,
        homeZoneId: null,
      });
      expect(await validate(dto)).toEqual([]);
    });
  });

  describe('especialidad y zona (#455)', () => {
    it('specialty es obligatoria al crear y tiene que ser del enum', async () => {
      const sinEspecialidad = { ...base, specialty: undefined };
      const falta = await validate(plainToInstance(CreateCrewDto, sinEspecialidad));
      expect(falta.map((e) => e.property)).toContain('specialty');

      const mala = await validate(plainToInstance(CreateCrewDto, { ...base, specialty: 'OTRA' }));
      expect(mala.map((e) => e.property)).toContain('specialty');
    });

    it('homeZoneId tiene que ser un UUID; en el PATCH acepta null para borrarla', async () => {
      const mal = await validate(plainToInstance(CreateCrewDto, { ...base, homeZoneId: '12' }));
      expect(mal.map((e) => e.property)).toContain('homeZoneId');

      expect(await validate(plainToInstance(UpdateCrewDto, { homeZoneId: null }))).toEqual([]);
    });

    it('la reubicación exige zona, fechas reales y motivo', async () => {
      const ok = {
        zoneId: '55555555-5555-4555-8555-555555555555',
        validFrom: '2026-11-02',
        reason: 'Refuerzo',
      };
      expect(await validate(plainToInstance(CreateCrewZoneAssignmentDto, ok))).toEqual([]);

      const mal = await validate(
        plainToInstance(CreateCrewZoneAssignmentDto, {
          zoneId: 'x',
          validFrom: '2026-02-30',
          validTo: 'mañana',
          reason: '  ',
        }),
      );
      expect(mal.map((e) => e.property).sort()).toEqual([
        'reason',
        'validFrom',
        'validTo',
        'zoneId',
      ]);
    });
  });
});
