import { CommittedEvent, Message, Payload } from "./types";

/**
 * Stores persist event messages into streams correlated by aggregate id
 * - produces committed events
 */
export interface Store {
  /**
   * Loads aggregate in memory by reading stream and reducing model
   * @param id aggregate id
   * @param reducer model reducer
   */
  load: <Events>(
    id: string,
    reducer: (event: CommittedEvent<keyof Events & string, Payload>) => void
  ) => Promise<void>;

  /**
   * Commits message into stream of aggregate id
   * @param id aggregate id
   * @param event event message
   * @param expectedVersion optional aggregate expected version to provide optimistic concurrency, raises concurrency exception when not matched
   * @returns committed event
   */
  commit: <Events>(
    id: string,
    event: Message<keyof Events & string, Payload>,
    expectedVersion?: string
  ) => Promise<CommittedEvent<keyof Events & string, Payload>>;

  /**
   * Loads events from stream
   * @param name optional event name filter
   * @param after optional starting point - defaults to -1
   * @param limit optional max number of events to return - defaults to 1
   * @returns events array
   */
  read: (
    name?: string,
    after?: number,
    limit?: number
  ) => Promise<CommittedEvent<string, Payload>[]>;
}
