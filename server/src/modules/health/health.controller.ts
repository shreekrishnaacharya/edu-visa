import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Liveness — the process is up. Used by container orchestrators to restart a hung pod. */
  @Public()
  @Get()
  check() {
    return { status: 'ok', time: new Date().toISOString() };
  }

  /** Readiness — the process AND its database are usable. Used to gate traffic. */
  @Public()
  @Get('ready')
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
    } catch (e) {
      throw new ServiceUnavailableException(`database unreachable: ${(e as Error).message}`);
    }
    return { status: 'ready', db: 'ok', time: new Date().toISOString() };
  }
}
