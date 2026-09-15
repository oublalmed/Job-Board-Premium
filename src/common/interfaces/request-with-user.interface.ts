import { Request } from 'express';
import { Role } from '../enums/role.enum.js';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
  // ENF-06 — true when this session satisfied MFA (TOTP or backup code).
  // Optional for backward compatibility with tokens minted before MFA and
  // with sessions of users who have no MFA requirement.
  mfa?: boolean;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
