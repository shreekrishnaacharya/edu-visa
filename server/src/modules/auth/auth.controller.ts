import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './public.decorator';
import { AuthService } from './auth.service';
import { LoginDto, RefreshDto } from './dto/login.dto';
import { env } from '../../config/env';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  // Tighter cap than the global default — login is the classic brute-force target.
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.ttlMs } })
  @ApiOperation({ summary: 'Sign in with email + password, returns an access + refresh token pair.' })
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Public()
  @Throttle({ default: { limit: env.throttle.authLimit, ttl: env.throttle.ttlMs } })
  @ApiOperation({ summary: 'Exchange a refresh token for a new access + refresh token pair.' })
  @Post('token')
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refresh_token);
  }
}
