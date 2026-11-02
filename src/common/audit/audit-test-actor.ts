import { M6Role } from '../../auth/m6-role';
import { AuditActor } from './audit.service';

/** Actor fijo para los specs: lo que `@CurrentUser()` entregaría del token. */
export const ACTOR: AuditActor = { userId: '42', roles: [M6Role.M6_ADMIN] };
