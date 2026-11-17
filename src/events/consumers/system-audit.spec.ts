import { M4_ACTOR_ID } from '../../common/audit/audit-actors';
import { sistema } from './system-audit';

describe('sistema', () => {
  it('el actor de M4 coincide con el que enmascara AuditService.findHistory', () => {
    expect(sistema('m4').userId).toBe(M4_ACTOR_ID);
  });
});
