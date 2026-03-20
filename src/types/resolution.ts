export interface DIDDocumentMetadata {
  readonly created: string;
  readonly updated: string;
  readonly deactivated: boolean;
  readonly versionId?: string;
}

export interface DIDResolutionMetadata {
  readonly contentType?: string;
  readonly error?: string;
  readonly deprecatedNetwork?: boolean;
}

export interface DIDResolutionResult {
  readonly didDocument: Record<string, unknown> | null;
  readonly didDocumentMetadata: DIDDocumentMetadata;
  readonly didResolutionMetadata: DIDResolutionMetadata;
}

export function buildResolutionResult(
  doc: Record<string, unknown> | null,
  created: string,
  updated: string,
  deactivated: boolean,
  options?: {
    versionId?: string;
    error?: string;
    contentType?: string;
  },
): DIDResolutionResult {
  return {
    didDocument: doc,
    didDocumentMetadata: {
      created,
      updated,
      deactivated,
      ...(options?.versionId && { versionId: options.versionId }),
    },
    didResolutionMetadata: {
      ...(options?.contentType && { contentType: options.contentType }),
      ...(options?.error && { error: options.error }),
    },
  };
}
