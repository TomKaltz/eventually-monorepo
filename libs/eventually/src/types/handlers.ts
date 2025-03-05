import type {
  Actor,
  CommittedEvent,
  Message,
  Messages,
  Patch,
  State,
  Snapshot,
  CommandTarget
} from "./messages";
import type { ProjectionMap, ProjectionPatch } from "./projection";
import type { CommandHandlerFactory } from "./factories";
import { Client } from "./client";

/**
 * Context provided to Policy and ProcessManager event handlers with utilities for dispatching commands
 */
export type EventHandlerContext = {
  command: <S2 extends State, C2 extends Messages, E2 extends Messages, N extends keyof C2>(
    factory: CommandHandlerFactory<S2, C2, E2>,
    name: N,
    data: C2[N],
    target: CommandTarget,
    skipValidation?: boolean
  ) => Promise<Snapshot<S2, E2> | undefined>,
  read: Client['read'],
  load: Client['load']
};

/**
 * State reducers apply partial state patches to a state, and returns the new state
 * - `state` the original state
 * - `patch` the patches to apply, considering rules like:
 *    - using `undefined` values to delete fields from the original state
 *    - recursively merging vs copying objects (like arrays)
 */
export type StateReducer<S extends State> = (
  state: Readonly<S>,
  patch: Readonly<Patch<S>> | undefined
) => Readonly<S>;

/**
 * Event reducers apply events to a reduced state, and returns the new patch
 * - `state` the current reduced state
 * - `event` the event to be applied
 */
export type EventReducer<
  S extends State,
  E extends Messages,
  K extends keyof E
> = (
  state: Readonly<S>,
  event: CommittedEvent<Pick<E, K>>
) => Readonly<Patch<S>>;

/**
 * Projector reducers apply events as "state patches" to the resulting projection map
 * - `event` the committed event being projected
 * - `map` a reference to the resulting projection map
 */
export type ProjectorReducer<
  S extends State,
  E extends Messages,
  K extends keyof E
> = (
  event: CommittedEvent<Pick<E, K>>,
  map: ProjectionMap<S>,
  ctx: Pick<EventHandlerContext, 'read' | 'load'>
) => Promise<ProjectionPatch<S>[]>;

/**
 * Command handlers handle commands and emit events
 * - `data` the command's payload
 * - `state` the state of the artifact handling this command - Empty for systems
 * - `actor?` the actor invoking the command
 */
export type CommandHandler<
  S extends State,
  C extends Messages,
  E extends Messages,
  K extends keyof C
> = (
  data: Readonly<C[K]>,
  state: Readonly<S>,
  actor?: Actor
) => Promise<Message<E>[]>;

/**
 * Invariants validate aggregate preconditions before processing commands,
 * allowing state and authorization checks in a declarative way
 */
export type Invariant<S extends State> = {
  description: string;
  valid: (state: Readonly<S>, actor?: Actor) => boolean;
};

/**
 * Actor handlers extract process manager actor ids from input events
 * - `event` the committed event being handled
 */
export type ActorHandler<E extends Messages, K extends keyof E> = (
  event: CommittedEvent<Pick<E, K>>
) => string;
