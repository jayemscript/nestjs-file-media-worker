import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dtos/error-response.dto';
import { FileMediaError, FileMediaErrorCode } from '../errors/file-media.error';

const FILE_ERROR_STATUS: Readonly<Record<FileMediaErrorCode, HttpStatus>> = {
  [FileMediaErrorCode.INVALID_APP_ID]: HttpStatus.BAD_REQUEST,
  [FileMediaErrorCode.INVALID_FILE_ID]: HttpStatus.BAD_REQUEST,
  [FileMediaErrorCode.FILE_REQUIRED]: HttpStatus.BAD_REQUEST,
  [FileMediaErrorCode.FILE_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [FileMediaErrorCode.FILE_ALREADY_DELETED]: HttpStatus.CONFLICT,
  [FileMediaErrorCode.FILE_NOT_RECOVERABLE]: HttpStatus.CONFLICT,
  [FileMediaErrorCode.FILE_MUST_BE_DELETED]: HttpStatus.CONFLICT,
  [FileMediaErrorCode.FILE_TOO_LARGE]: HttpStatus.PAYLOAD_TOO_LARGE,
  [FileMediaErrorCode.BULK_LIMIT_EXCEEDED]: HttpStatus.PAYLOAD_TOO_LARGE,
  [FileMediaErrorCode.UNSUPPORTED_FILE_TYPE]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [FileMediaErrorCode.STORAGE_OPERATION_FAILED]: HttpStatus.SERVICE_UNAVAILABLE,
  [FileMediaErrorCode.PERSISTENCE_OPERATION_FAILED]:
    HttpStatus.SERVICE_UNAVAILABLE,
  [FileMediaErrorCode.ADMIN_KEY_REQUIRED]: HttpStatus.UNAUTHORIZED,
  [FileMediaErrorCode.ADMIN_KEY_INVALID]: HttpStatus.FORBIDDEN,
  [FileMediaErrorCode.TRANSFER_AUTHORIZATION_DISABLED]:
    HttpStatus.SERVICE_UNAVAILABLE,
  [FileMediaErrorCode.TRANSFER_AUTHORIZATION_REQUIRED]: HttpStatus.UNAUTHORIZED,
  [FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID]: HttpStatus.UNAUTHORIZED,
  [FileMediaErrorCode.TRANSFER_AUTHORIZATION_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [FileMediaErrorCode.TRANSFER_AUTHORIZATION_USED]: HttpStatus.CONFLICT,
  [FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID_REQUEST]:
    HttpStatus.BAD_REQUEST,
  [FileMediaErrorCode.TRANSFER_RATE_LIMIT_EXCEEDED]:
    HttpStatus.TOO_MANY_REQUESTS,
};

interface HttpExceptionBody {
  message?: string | string[];
  error?: string;
}

function isHttpExceptionBody(value: unknown): value is HttpExceptionBody {
  return typeof value === 'object' && value !== null;
}

function getStringProperty(
  value: unknown,
  property: string,
): string | undefined {
  if (typeof value !== 'object' || value === null || !(property in value)) {
    return undefined;
  }
  const propertyValue = value[property as keyof typeof value];
  return typeof propertyValue === 'string' ? propertyValue : undefined;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorCode = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof FileMediaError) {
      status = FILE_ERROR_STATUS[exception.code];
      message = exception.message;
      errorCode = exception.code;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (isHttpExceptionBody(exceptionResponse)) {
        message = exceptionResponse.message ?? exception.message;
        errorCode = exceptionResponse.error ?? exception.name;
      }
    } else if (exception instanceof Error && exception.name === 'MulterError') {
      const multerCode = getStringProperty(exception, 'code');
      status =
        multerCode === 'LIMIT_FILE_SIZE'
          ? HttpStatus.PAYLOAD_TOO_LARGE
          : HttpStatus.BAD_REQUEST;
      message =
        multerCode === 'LIMIT_FILE_SIZE'
          ? 'The uploaded file exceeds the configured size limit'
          : 'The multipart upload exceeds the configured limits';
      errorCode = multerCode ?? 'MULTIPART_LIMIT_EXCEEDED';
    }

    const errorResponse: ErrorResponseDto = {
      statusCode: status,
      message,
      error: errorCode,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    const stack = exception instanceof Error ? exception.stack : undefined;
    this.logger.error(
      `[${request.method}] ${request.originalUrl} - ${status} - ${errorCode}`,
      stack,
    );
    response.status(status).json(errorResponse);
  }
}
