// logCatch provides helpers for non-silent error handling. Replace every
// `.catch(logCatch("async"))` / empty catch block with these so errors are visible.

/**
 * Wraps a catch handler to log errors. Use as:
 *   `.catch(logCatch("ListTabs"))`
 *   `.catch(logCatch("OpenProjectTab", []))`  — keeps fallback value []
 *   `.catch(logCatch("OpenProjectTab", undefined))`
 */
export function logCatch<T>(context: string, fallback?: T): (err: unknown) => T {
  return (err: unknown) => {
    console.error(`[catch] ${context}:`, err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
    return fallback as T;
  };
}

/**
 * For try-catch blocks. Use as:
 *   } catch (err) { logCatchErr("parseConfig", err); }
 */
export function logCatchErr(context: string, err: unknown): void {
  console.error(`[catch] ${context}:`, err instanceof Error ? `${err.message}\n${err.stack}` : String(err));
}
