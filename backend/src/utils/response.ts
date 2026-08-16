// Shared response shape so every endpoint returns the same envelope.
export function ok<T>(res: any, data: T, meta?: Record<string, any>) {
  return res.json({
    success: true,
    data,
    ...(meta ? { meta } : {}),
  });
}

export function fail(res: any, status: number, message: string, code?: string) {
  return res.status(status).json({
    success: false,
    error: {
      message,
      code: code || 'ERROR',
    },
  });
}
