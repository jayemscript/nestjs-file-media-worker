import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import {
  FileMediaError,
  FileMediaErrorCode,
} from '../../../common/errors/file-media.error';
import { StorageConfiguration } from '../../../config/storage.config';
import { TransferConfiguration } from '../../../config/transfer.config';
import { IncomingFile } from '../domain/file-operations';
import {
  TransferAuthorizationResponse,
  TransferOperation,
  TransferTokenClaims,
  UploadAuthorizationConstraints,
} from '../domain/transfer-authorization';
import { TRANSFER_AUTHORIZATION_REPOSITORY } from '../repositories/transfer-authorization.repository.interface';
import type { TransferAuthorizationRepository } from '../repositories/transfer-authorization.repository.interface';
import { AppContextService } from './app-context.service';
import { FilesService } from './files.service';

const TOKEN_VERSION = 'v1';
const TOKEN_ID_PATTERN = /^[a-f\d]{32}$/;
const MONGODB_OBJECT_ID = /^[a-f\d]{24}$/i;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]+$/;
const MIME_ALIASES: Readonly<Record<string, string>> = {
  'image/jpg': 'image/jpeg',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
};

@Injectable()
export class TransferAuthorizationService {
  private readonly configuration: TransferConfiguration;
  private readonly maxFileSizeBytes: number;
  private readonly allowedMimeTypes: Set<string>;
  private readonly publicBaseUrl: string;

  constructor(
    @Inject(TRANSFER_AUTHORIZATION_REPOSITORY)
    private readonly repository: TransferAuthorizationRepository,
    private readonly appContextService: AppContextService,
    private readonly filesService: FilesService,
    configService: ConfigService,
  ) {
    this.configuration =
      configService.getOrThrow<TransferConfiguration>('transfer');
    const storage = configService.getOrThrow<StorageConfiguration>('storage');
    this.maxFileSizeBytes = storage.maxFileSizeBytes;
    this.allowedMimeTypes = new Set(
      storage.allowedMimeTypes.map((mimeType) => mimeType.toLowerCase()),
    );
    this.publicBaseUrl = this.configuration.publicBaseUrl.replace(/\/+$/, '');
  }

  async authorizeUpload(
    appIdValue: unknown,
    constraints: UploadAuthorizationConstraints,
  ): Promise<TransferAuthorizationResponse> {
    this.requireEnabled();
    const appId = this.appContextService.requireAppId(appIdValue);
    const maxSizeBytes = this.resolveMaxSize(constraints.maxSizeBytes);
    const allowedMimeTypes = this.resolveAllowedMimeTypes(
      constraints.allowedMimeTypes,
    );
    const claims = this.createClaims(appId, TransferOperation.UPLOAD, {
      maxSizeBytes,
      allowedMimeTypes,
    });
    return this.persistAndCreateResponse(
      claims,
      `${this.publicBaseUrl}/files/authorized-upload`,
      'POST',
    );
  }

  async authorizeDownload(
    appIdValue: unknown,
    fileId: string,
  ): Promise<TransferAuthorizationResponse> {
    this.requireEnabled();
    const appId = this.appContextService.requireAppId(appIdValue);
    await this.filesService.ensureFileDownloadable(appId, fileId);
    const claims = this.createClaims(appId, TransferOperation.DOWNLOAD, {
      fileId,
    });
    return this.persistAndCreateResponse(
      claims,
      `${this.publicBaseUrl}/files/${fileId}/authorized-download`,
      'GET',
    );
  }

  async consumeUpload(
    token: string | undefined,
    file?: IncomingFile,
  ): Promise<string> {
    const claims = this.verifyToken(token, TransferOperation.UPLOAD);
    if (!file) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_REQUIRED,
        'A multipart file field named file is required',
      );
    }
    if (!claims.maxSizeBytes || file.buffer.length > claims.maxSizeBytes) {
      throw new FileMediaError(
        FileMediaErrorCode.FILE_TOO_LARGE,
        'The file exceeds the authorized upload size',
      );
    }

    const declaredMimeType = this.normalizeMimeType(file.declaredMimeType);
    if (!claims.allowedMimeTypes?.includes(declaredMimeType)) {
      throw new FileMediaError(
        FileMediaErrorCode.UNSUPPORTED_FILE_TYPE,
        'The declared MIME type is not authorized for this upload',
      );
    }

    await this.consumeClaims(claims);
    return claims.appId;
  }

  async consumeDownload(
    token: string | undefined,
    fileId: string,
  ): Promise<string> {
    const claims = this.verifyToken(token, TransferOperation.DOWNLOAD);
    if (claims.fileId !== fileId) {
      throw this.invalidAuthorization();
    }
    await this.consumeClaims(claims);
    return claims.appId;
  }

  private createClaims(
    appId: string,
    operation: TransferOperation,
    scope: Pick<
      TransferTokenClaims,
      'fileId' | 'maxSizeBytes' | 'allowedMimeTypes'
    >,
  ): TransferTokenClaims {
    const issuedAt = Math.floor(Date.now() / 1000);
    return {
      version: 1,
      tokenId: randomBytes(16).toString('hex'),
      appId,
      operation,
      issuedAt,
      expiresAt: issuedAt + this.configuration.tokenTtlSeconds,
      ...(scope.fileId ? { fileId: scope.fileId } : {}),
      ...(scope.maxSizeBytes ? { maxSizeBytes: scope.maxSizeBytes } : {}),
      ...(scope.allowedMimeTypes
        ? { allowedMimeTypes: scope.allowedMimeTypes }
        : {}),
    };
  }

  private async persistAndCreateResponse(
    claims: TransferTokenClaims,
    url: string,
    method: 'GET' | 'POST',
  ): Promise<TransferAuthorizationResponse> {
    await this.repository.create({
      tokenIdHash: this.hashTokenId(claims.tokenId),
      appId: claims.appId,
      operation: claims.operation,
      expiresAt: new Date(claims.expiresAt * 1000),
    });
    const token = this.signClaims(claims);
    return {
      url,
      method,
      headers: { Authorization: `Bearer ${token}` },
      expiresAt: new Date(claims.expiresAt * 1000),
      requiresFinalization: false,
    };
  }

  private signClaims(claims: TransferTokenClaims): string {
    const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
    const signedValue = `${TOKEN_VERSION}.${payload}`;
    const signature = createHmac('sha256', this.configuration.signingKey)
      .update(signedValue)
      .digest('base64url');
    return `${signedValue}.${signature}`;
  }

  private verifyToken(
    token: string | undefined,
    expectedOperation: TransferOperation,
  ): TransferTokenClaims {
    this.requireEnabled();
    if (!token) {
      throw new FileMediaError(
        FileMediaErrorCode.TRANSFER_AUTHORIZATION_REQUIRED,
        'A transfer authorization token is required',
      );
    }

    const parts = token.split('.');
    if (
      parts.length !== 3 ||
      parts[0] !== TOKEN_VERSION ||
      !parts[1] ||
      !parts[2] ||
      !SIGNATURE_PATTERN.test(parts[2])
    ) {
      throw this.invalidAuthorization();
    }

    const signedValue = `${parts[0]}.${parts[1]}`;
    const expectedSignature = createHmac(
      'sha256',
      this.configuration.signingKey,
    )
      .update(signedValue)
      .digest();
    const suppliedSignature = Buffer.from(parts[2], 'base64url');
    if (
      suppliedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(suppliedSignature, expectedSignature)
    ) {
      throw this.invalidAuthorization();
    }

    const claims = this.parseClaims(parts[1]);
    if (
      claims.operation !== expectedOperation ||
      claims.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      if (claims.expiresAt <= Math.floor(Date.now() / 1000)) {
        throw new FileMediaError(
          FileMediaErrorCode.TRANSFER_AUTHORIZATION_EXPIRED,
          'The transfer authorization has expired',
        );
      }
      throw this.invalidAuthorization();
    }
    this.appContextService.requireAppId(claims.appId);
    return claims;
  }

  private parseClaims(encodedPayload: string): TransferTokenClaims {
    try {
      const value: unknown = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8'),
      );
      if (!this.isTransferTokenClaims(value)) {
        throw this.invalidAuthorization();
      }
      return value;
    } catch (error) {
      if (error instanceof FileMediaError) {
        throw error;
      }
      throw this.invalidAuthorization();
    }
  }

  private isTransferTokenClaims(value: unknown): value is TransferTokenClaims {
    if (typeof value !== 'object' || value === null) {
      return false;
    }
    const claims = value as Partial<TransferTokenClaims>;
    if (
      claims.version !== 1 ||
      typeof claims.tokenId !== 'string' ||
      !TOKEN_ID_PATTERN.test(claims.tokenId) ||
      typeof claims.appId !== 'string' ||
      !Object.values(TransferOperation).includes(
        claims.operation as TransferOperation,
      ) ||
      !Number.isSafeInteger(claims.issuedAt) ||
      !Number.isSafeInteger(claims.expiresAt) ||
      (claims.expiresAt ?? 0) <= (claims.issuedAt ?? 0)
    ) {
      return false;
    }

    if (claims.operation === TransferOperation.DOWNLOAD) {
      return (
        typeof claims.fileId === 'string' &&
        MONGODB_OBJECT_ID.test(claims.fileId)
      );
    }

    return (
      Number.isSafeInteger(claims.maxSizeBytes) &&
      (claims.maxSizeBytes ?? 0) > 0 &&
      Array.isArray(claims.allowedMimeTypes) &&
      claims.allowedMimeTypes.length > 0 &&
      claims.allowedMimeTypes.every((mimeType) => typeof mimeType === 'string')
    );
  }

  private async consumeClaims(claims: TransferTokenClaims): Promise<void> {
    const consumed = await this.repository.consume(
      this.hashTokenId(claims.tokenId),
      claims.appId,
      claims.operation,
      new Date(),
    );
    if (!consumed) {
      throw new FileMediaError(
        FileMediaErrorCode.TRANSFER_AUTHORIZATION_USED,
        'The transfer authorization has already been used',
      );
    }
  }

  private resolveMaxSize(requestedSize: number | undefined): number {
    const maxSize = requestedSize ?? this.maxFileSizeBytes;
    if (
      !Number.isSafeInteger(maxSize) ||
      maxSize <= 0 ||
      maxSize > this.maxFileSizeBytes
    ) {
      throw new FileMediaError(
        FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID_REQUEST,
        `maxSizeBytes must be between 1 and ${this.maxFileSizeBytes}`,
      );
    }
    return maxSize;
  }

  private resolveAllowedMimeTypes(
    requestedMimeTypes: string[] | undefined,
  ): string[] {
    const mimeTypes = requestedMimeTypes
      ? requestedMimeTypes.map((mimeType) => this.normalizeMimeType(mimeType))
      : [...this.allowedMimeTypes];
    if (
      mimeTypes.length === 0 ||
      new Set(mimeTypes).size !== mimeTypes.length ||
      mimeTypes.some(
        (mimeType) => !mimeType || !this.allowedMimeTypes.has(mimeType),
      )
    ) {
      throw new FileMediaError(
        FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID_REQUEST,
        'allowedMimeTypes must be a unique subset of configured MIME types',
      );
    }
    return mimeTypes;
  }

  private normalizeMimeType(mimeType: string): string {
    const normalized = mimeType.trim().toLowerCase();
    return MIME_ALIASES[normalized] ?? normalized;
  }

  private hashTokenId(tokenId: string): string {
    return createHash('sha256').update(tokenId).digest('hex');
  }

  private requireEnabled(): void {
    if (!this.configuration.enabled) {
      throw new FileMediaError(
        FileMediaErrorCode.TRANSFER_AUTHORIZATION_DISABLED,
        'Authorized file transfers are disabled',
      );
    }
  }

  private invalidAuthorization(): FileMediaError {
    return new FileMediaError(
      FileMediaErrorCode.TRANSFER_AUTHORIZATION_INVALID,
      'The transfer authorization is invalid',
    );
  }
}
