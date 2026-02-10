export type Result<T, E = Error> =
  | { data: T; error: null }
  | { data: null; error: E };

export function success<T>(data: T): Result<T, never> {
  return { data, error: null };
}

export function failure<T = never, E = Error>(error: E): Result<T, E> {
  return { data: null, error } as Result<T, E>;
}

export function isSuccess<T, E>(result: Result<T, E>): result is { data: T; error: null } {
  return result.error === null;
}

export async function wrap<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    const data = await promise;
    return success(data);
  } catch (e) {
    return failure<T>(e instanceof Error ? e : new Error(String(e)));
  }
}
