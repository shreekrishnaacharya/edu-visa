import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUserPayload } from './jwt.strategy';

/** Pulls the authenticated user off the request (set by JwtAuthGuard/JwtStrategy). */
export const AuthUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUserPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user;
  },
);
