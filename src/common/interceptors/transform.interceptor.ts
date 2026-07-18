//src/common/interceptors/transform.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        const response = context.switchToHttp().getResponse();
        const statusCode = response.statusCode;

        return {
          statusCode,
          message: this.getMessageByStatusCode(statusCode),
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private getMessageByStatusCode(statusCode: number): string {
    if (statusCode === 200) return 'Success';
    if (statusCode === 201) return 'Created';
    if (statusCode === 204) return 'No Content';
    if (statusCode === 400) return 'Bad Request';
    if (statusCode === 401) return 'Unauthorized';
    if (statusCode === 403) return 'Forbidden';
    if (statusCode === 404) return 'Not Found';
    if (statusCode >= 500) return 'Internal Server Error';
    return 'Success';
  }
}
