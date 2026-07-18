//src/common/dtos/error-response.dto.ts
export class ErrorResponseDto<T> {
  statusCode!: number;
  message!: string;
  error?: string;
  timestamp!: string;
  path?: string;
  details?: Record<string, T>;
}
