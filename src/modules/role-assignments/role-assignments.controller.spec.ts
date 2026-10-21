import 'reflect-metadata';
import { M6Role } from '../../auth/m6-role';
import { ROLES_KEY } from '../../common/decorators';
import { RoleAssignmentsController } from './role-assignments.controller';
import { RoleAssignmentsService } from './role-assignments.service';

describe('RoleAssignmentsController', () => {
  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    replace: jest.fn(),
    remove: jest.fn(),
  };
  const controller = new RoleAssignmentsController(service as unknown as RoleAssignmentsService);

  it('todo el recurso es solo de M6_ADMIN (lo aplica el RolesGuard global)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, RoleAssignmentsController)).toEqual([M6Role.M6_ADMIN]);
  });

  it('delega con el actor del token', () => {
    controller.replace('42', { roles: [M6Role.M6_AUDITOR] }, '1');
    expect(service.replace).toHaveBeenCalledWith('1', '42', [M6Role.M6_AUDITOR]);
    controller.remove('42', '1');
    expect(service.remove).toHaveBeenCalledWith('1', '42');
    controller.findOne('42');
    expect(service.findOne).toHaveBeenCalledWith('42');
    const q = {} as never;
    controller.findAll(q);
    expect(service.findAll).toHaveBeenCalledWith(q);
  });
});
