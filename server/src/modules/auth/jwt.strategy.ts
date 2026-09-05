import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { env } from '../../config/env';
import { Role } from '../../common/enums';

export interface AuthUserPayload {
  sub: string; // user id
  email: string;
  role: Role;
  branch_id: string | null;
  student_id: string | null;
  permissions: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.jwt.secret,
    });
  }

  async validate(payload: AuthUserPayload): Promise<AuthUserPayload> {
    return payload;
  }
}
