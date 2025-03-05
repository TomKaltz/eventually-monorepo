import { randomUUID } from "crypto";
import { client, log } from "../ports";
import type {
  CommittedEvent,
  CommittedEventMetadata,
  EventHandlerFactory,
  EventResponse,
  Message,
  Messages,
  State,
  CommandHandlerFactory,
} from "../types";
import type { EventHandlerContext } from "../types/handlers";
import { bind, validateMessage } from "../utils";
import command from "./command";
import message from "./message";

/**
 * Validates and handles event message
 * @param factory the event handler factory (policy or process manager)
 * @param event the committed event to be handled
 * @returns response, including command side effects
 */
export default async function event<
  S extends State,
  C extends Messages,
  E extends Messages
>(
  factory: EventHandlerFactory<S, C, E>,
  event: CommittedEvent<E>
): Promise<EventResponse<S, C>> {
  log().magenta().trace(`\n>>> ${factory.name}`, event);
  const { data } = validateMessage(event);
  const { id, name, stream } = event;

  const artifact = factory();
  Object.setPrototypeOf(artifact, factory as object);

  const actor: string = "actor" in artifact ? artifact.actor[name](event) : "";
  const metadata: CommittedEventMetadata = {
    correlation: event.metadata?.correlation || randomUUID(),
    causation: { event: { name, stream, id } }
  };

  let cmd: Message<C> | undefined;
  const snapshots = await message(
    factory,
    artifact,
    { actor },
    async (snapshot) => {
      // Create a context with a bound command function for event handlers
      const ctx: EventHandlerContext = {
        command: async <S2 extends State, C2 extends Messages, E2 extends Messages, N extends keyof C2>(
          factory: CommandHandlerFactory<S2, C2, E2>,
          name: N,
          data: C2[N],
          skipValidation = false
        ) => {
          return command<S2, C2, E2>(
            {
              name: name as string,
              data: data as Readonly<C2[string]>,
              actor: {
                id: actor || factory.name,
                name: factory.name,
                expectedCount: actor ? snapshot.applyCount : undefined
              }
            },
            metadata,
            skipValidation
          );
        },
        read: client().read,
        load: client().load
      };
      
      // Check if this is a policy (no state schema) or a process manager (has state schema)
      if (!("state" in artifact.schemas)) {
        // It's a policy, pass the context
        cmd = await (artifact as any).on[name](event, ctx);
      } else {
        // It's a process manager, pass the state and context
        cmd = await (artifact as any).on[name](event, snapshot.state, ctx);
      }
      
      if (cmd) {
        // command side effects are handled synchronously, thus event handlers can fail
        await command<S, C, E>(
          {
            ...cmd,
            actor: {
              id: actor || factory.name,
              name: factory.name,
              expectedCount: actor ? snapshot.applyCount : undefined
            }
          },
          metadata
        );
      }
      return [bind(name, data)];
    },
    metadata
  );
  return {
    id,
    command: cmd,
    state: snapshots.at(-1)?.state
  };
}
