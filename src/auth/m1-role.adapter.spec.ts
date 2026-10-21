import { M1RoleAdapter } from './m1-role.adapter';
import { M6Role } from './m6-role';

const OPERATIVOS = [
  M6Role.M6_OFICINA_OPERACIONES,
  M6Role.M6_OFICINA_AMBIENTAL,
  M6Role.M6_CAMPO_CUADRILLA,
  M6Role.M6_CAMPO_INSPECTOR,
];

describe('M1RoleAdapter', () => {
  const adapter = new M1RoleAdapter();

  it.each([['CIUDADANO'], ['PERSONA'], ['MESA_ENTRADAS'], ['SERVICIO']])(
    '%s no tiene ningún rol de M6',
    (rol) => expect(adapter.assignableRoles(rol)).toEqual([]),
  );

  it('ADMINISTRATIVO: los cuatro operativos, sin admin', () => {
    expect([...adapter.assignableRoles('ADMINISTRATIVO')].sort()).toEqual([...OPERATIVOS].sort());
  });

  it('RESPONSABLE_AREA: los de ADMINISTRATIVO más M6_ADMIN', () => {
    expect([...adapter.assignableRoles('RESPONSABLE_AREA')].sort()).toEqual(
      [...OPERATIVOS, M6Role.M6_ADMIN].sort(),
    );
  });

  it('AUDITOR: solo M6_AUDITOR', () => {
    expect(adapter.assignableRoles('AUDITOR')).toEqual([M6Role.M6_AUDITOR]);
  });

  it.each([['ADMIN'], [''], ['administrativo'], ['constructor'], ['__proto__']])(
    'valor desconocido %p: ninguno y warn',
    (rol) => {
      const warn = jest.spyOn(adapter['logger'], 'warn').mockImplementation();
      expect(adapter.assignableRoles(rol)).toEqual([]);
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    },
  );
});
