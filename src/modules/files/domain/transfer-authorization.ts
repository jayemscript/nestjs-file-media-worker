export enum TransferOperation {
  UPLOAD = 'upload',
  DOWNLOAD = 'download',
}

export interface TransferTokenClaims {
  version: 1;
  tokenId: string;
  appId: string;
  operation: TransferOperation;
  issuedAt: number;
  expiresAt: number;
  fileId?: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface CreateTransferAuthorization {
  tokenIdHash: string;
  appId: string;
  operation: TransferOperation;
  expiresAt: Date;
}

export interface TransferAuthorizationResponse {
  url: string;
  method: 'GET' | 'POST';
  headers: {
    Authorization: string;
  };
  expiresAt: Date;
  requiresFinalization: false;
}

export interface UploadAuthorizationConstraints {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}
