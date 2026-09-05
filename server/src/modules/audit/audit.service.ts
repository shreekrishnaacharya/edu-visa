import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuthUserPayload } from '../auth/jwt.strategy';

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async record(
    user: AuthUserPayload,
    studentId: string,
    action: string,
    ip: string | null = null,
  ): Promise<void> {
    await this.repo.save(
      this.repo.create({
        user_id: user.sub,
        user_email: user.email,
        student_id: studentId,
        action,
        ip,
      }),
    );
  }

  forStudent(studentId: string) {
    return this.repo.find({
      where: { student_id: studentId },
      order: { created_at: 'DESC' },
      take: 200,
    });
  }
}
