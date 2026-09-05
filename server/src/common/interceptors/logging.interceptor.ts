import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/** One line per request: method, path, status, duration, caller — for production log aggregation. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const start = Date.now();
    const user = (req as any).user?.email ?? 'anonymous';

    return next.handle().pipe(
      tap({
        next: () => this.log(req, res, start, user),
        error: () => this.log(req, res, start, user),
      }),
    );
  }

  private log(req: Request, res: Response, start: number, user: string) {
    const ms = Date.now() - start;
    this.logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms - ${user}`);
  }
}
