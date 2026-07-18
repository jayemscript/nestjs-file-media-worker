//src/common/interceptors/error.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorResponseDto } from '../dtos/error-response.dto';

@Injectable()
export class ErrorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        const response = context.switchToHttp().getResponse();
        const request = context.switchToHttp().getRequest();

        let status = 500;
        let message = 'Internal server error';
        let errorDetails: any = null;

        if (error instanceof HttpException) {
          status = error.getStatus();
          const exceptionResponse = error.getResponse();
          message = (exceptionResponse as any).message || error.message;
          errorDetails = exceptionResponse as any;
        } else {
          message = error.message || 'An unexpected error occurred';
        }

        const errorResponse: ErrorResponseDto<NestInterceptor> = {
          statusCode: status,
          message,
          timestamp: new Date().toISOString(),
          path: request.url,
          details: errorDetails,
        };

        response.status(status).json(errorResponse);

        return throwError(() => error);
      }),
    );
  }
}
