export type ApiErrorCode =
  | 'invalid_body'
  | 'target_not_allowed'
  | 'test_not_found'
  | 'rate_limited'
  | 'internal';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}

/** One consistent JSON error shape for every failure: {error:{code,message}}. */
export function errorResponse(
  status: number,
  code: ApiErrorCode,
  message: string,
  headers?: Record<string, string>
): Response {
  const body: ApiErrorBody = { error: { code, message } };
  return Response.json(body, { status, headers });
}
