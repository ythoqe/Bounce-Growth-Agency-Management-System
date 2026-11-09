/**
 * Recursively strips all keys with undefined values from objects and arrays
 * to prevent Firestore "Function setDoc() called with invalid data. Unsupported field value: undefined" errors.
 */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  const clean = (val: any): any => {
    if (val === undefined) {
      return undefined;
    }
    if (val === null) {
      return null;
    }
    if (Array.isArray(val)) {
      return val
        .map(clean)
        .filter((v) => v !== undefined);
    }
    if (typeof val === 'object' && !(val instanceof Date)) {
      const res: Record<string, any> = {};
      for (const k of Object.keys(val)) {
        const cleaned = clean(val[k]);
        if (cleaned !== undefined) {
          res[k] = cleaned;
        }
      }
      return res;
    }
    return val;
  };

  const intermediate = clean(obj);
  try {
    return JSON.parse(JSON.stringify(intermediate));
  } catch {
    return (intermediate ?? {}) as T;
  }
}
