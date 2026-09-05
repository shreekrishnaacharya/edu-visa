import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as argon2 from 'argon2';
import { User } from './user.entity';
import { env } from '../../config/env';
import { AuthUserPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.users.findOne({ where: { email, active: true } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const ok = await argon2.verify(user.password_hash, password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    return this.issueTokens(user);
  }

  issueTokens(user: User) {
    const payload: AuthUserPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      student_id: user.student_id,
      permissions: user.permissions ?? [],
    };
    const access_token = this.jwt.sign(payload, {
      expiresIn: env.jwt.accessTtl,
    });
    const refresh_token = this.jwt.sign(payload, {
      expiresIn: env.jwt.refreshTtl,
    });
    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        branch: user.branch,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwt.verify<AuthUserPayload>(refreshToken);
      const user = await this.users.findOne({ where: { id: payload.sub, active: true } });
      if (!user) throw new UnauthorizedException();
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  static async hash(password: string): Promise<string> {
    return argon2.hash(password);
  }
}
