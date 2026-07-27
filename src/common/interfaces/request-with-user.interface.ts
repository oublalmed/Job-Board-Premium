import { Request } from 'express';
import { Role } from '../enums/role.enum.js';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: Role[];
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
