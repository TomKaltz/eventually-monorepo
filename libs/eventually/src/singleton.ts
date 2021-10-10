/**
 * Wraps creation of singletons around factory functions
 * @param target the factory function
 * @returns the singleton function
 */
const instances: { [name: string]: unknown } = {};
export const singleton =
  <T, U>(target: (arg?: U) => T) =>
  (arg?: U): T => {
    if (!instances[target.name]) instances[target.name] = target(arg);
    return instances[target.name] as T;
  };
