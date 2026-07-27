import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../enums/audit-action.enum.js';

export const AUDIT_ACTION_KEY = 'audit_action';
export const Audit = (action: AuditAction) =>
  SetMetadata(AUDIT_ACTION_KEY, action);
