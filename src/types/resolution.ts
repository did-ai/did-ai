export interface DIDDocumentMetadata {
  created: string;
  updated: string;
  deactivated?: boolean;
  versionId?: string;
  nextVersionId?: string;
  equivalentId: string[];
}

export interface DIDResolutionMetadata {
  contentType: string;
  error?:
    | "notFound"
    | "deactivated"
    | "versionNotFound"
    | "invalidDid"
    | "invalidVersion";
}

export interface ResolutionResponse<T> {
  didDocument?: T;
  didDocumentMetadata?: DIDDocumentMetadata;
  didResolutionMetadata: DIDResolutionMetadata;
}

export function buildDocumentMetadata(
  created: string,
  updated: string,
  options?: {
    deactivated?: boolean;
    versionId?: string;
    nextVersionId?: string;
  },
): DIDDocumentMetadata {
  return {
    created,
    updated,
    equivalentId: [],
    ...(options?.deactivated && { deactivated: true }),
    ...(options?.versionId && { versionId: options.versionId }),
    ...(options?.nextVersionId && { nextVersionId: options.nextVersionId }),
  };
}

export function buildResolutionMetadata(
  contentType: string,
  error?: DIDResolutionMetadata["error"],
): DIDResolutionMetadata {
  return {
    contentType,
    ...(error && { error }),
  };
}
