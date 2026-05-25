export type PersonalizeTelemetry = {
  traceId: string;
  requestId: string;
  status: 'SUCCESS' | 'FAILED' | 'INVALID_OUTPUT' | 'TIMEOUT' | 'VALIDATION_FAILED' | 'RETRYING';
  processingTimeMs: number;
  providerLatencyMs?: number;
  tokenInput?: number;
  tokenOutput?: number;
  model?: string;
  provider?: string;
  retryCount?: number;
  variantLabel?: 'A' | 'B';
};
