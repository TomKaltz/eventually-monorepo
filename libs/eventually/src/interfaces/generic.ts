/**
 * Resource disposer function
 */
export type Disposer = () => Promise<void>;

/**
 * Resource Seeder function
 */
export type Seeder = () => Promise<void>;

/**
 * Disposable resources
 */
export interface Disposable {
  readonly name: string;
  dispose: Disposer;
}

/**
 * Seedable resources (i.e. to initialize or run store migrations)
 */
export interface Seedable {
  seed: Seeder;
}
