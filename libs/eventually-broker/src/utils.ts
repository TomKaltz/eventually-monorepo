import { log, Payload } from "@rotorsoft/eventually";
import { AxiosRequestHeaders } from "axios";

const usnf = new Intl.NumberFormat("en-US");
const usdf = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short"
});

export const formatInt = (int: number): string => {
  try {
    return usnf.format(int);
  } catch {
    return "-";
  }
};

export const formatDate = (date: Date): string => {
  try {
    return usdf.format(date);
  } catch {
    return "-";
  }
};

export const formatDateLocal = (date: Date): string => {
  try {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000)
      .toISOString()
      .substring(0, 16);
  } catch {
    return "";
  }
};

/**
 * Ensures argument is returned as an array
 * @param anyOrArray The argument
 * @returns The ensured array
 */
export const ensureArray = (anyOrArray: any | any[]): any[] =>
  Array.isArray(anyOrArray) ? anyOrArray : [anyOrArray];

/**
 * Builds query string from payload
 */
const toQS = (key: string, val: any): string => `&${key}=${val.toString()}`;
export const toQueryString = (payload: Payload): string =>
  Object.entries(payload)
    .filter(([, val]) => val)
    .reduce(
      (q, [key, val]) =>
        Array.isArray(val)
          ? val.map((v) => q.concat(toQS(key, v))).join("")
          : q.concat(toQS(key, val)),
      ""
    );

/**
 * Builds headers from payload
 */
export const toAxiosRequestHeaders = (payload: Payload): AxiosRequestHeaders =>
  Object.entries(payload).reduce((h, [key, val]) => {
    h[key] =
      typeof val === "boolean" || typeof val === "number"
        ? val
        : (val as any).toString();
    return h;
  }, {} as AxiosRequestHeaders);

// export const safeStringify = (val: any): string => {
//   let cache: Array<any> = [];
//   const result = JSON.stringify(
//     val,
//     (key, value) =>
//       typeof value === "object" && value !== null
//         ? cache.includes(value)
//           ? `circular:${key}`
//           : cache.push(value) && value
//         : value,
//     2
//   );
//   cache = null;
//   return result;
// };

/**
 * Loops are infinite FIFO queues of async actions executed sequentially
 * Loops are started/restarted by pushing new actions to it
 * Loops can also be stopped
 * Optional callback after action is completed
 * Optional delay before action is enqueued
 */
type Action = {
  id: string;
  action: () => Promise<boolean | undefined>;
  callback?: (id: string, result: boolean | undefined) => void;
  delay?: number;
};
export type Loop = {
  push: (action: Action) => void;
  stop: () => Promise<void>;
  stopped: () => boolean;
};

/**
 * Loop factory
 * @param name The name of the loop
 * @returns A new loop
 */
export const loop = (name: string): Loop => {
  const queue: Array<Action> = [];
  let pending: Record<string, NodeJS.Timeout> = {};
  let running = false;
  let status: "running" | "stopping" | "stopped" = "running";

  const push = (action: Action): void => {
    queue.push(action);
    status = "running";
    setImmediate(run);
  };

  const run = async (): Promise<void> => {
    if (!running) {
      running = true;
      while (queue.length) {
        if (status === "stopping") break;
        const action = queue.shift();
        if (action) {
          const result = await action.action();
          action.callback && action.callback(action.id, result);
        }
      }
      status = "stopped";
      running = false;
    }
  };

  return {
    push: (action: Action): void => {
      if (action.delay) {
        pending[action.id] && clearTimeout(pending[action.id]);
        pending[action.id] = setTimeout(() => {
          delete pending[action.id];
          push(action);
        }, action.delay);
      } else push(action);
    },
    stop: async (): Promise<void> => {
      if (queue.length > 0 && status === "running") {
        status = "stopping";
        for (let i = 1; status === "stopping" && i <= 30; i++) {
          log().trace(
            "red",
            `[${process.pid}] Stopping loop [${name}] (${i})...`
          );
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      // reset on stop
      queue.length = 0;
      Object.values(pending).forEach((timeout) => clearTimeout(timeout));
      pending = {};
    },
    stopped: () => status !== "running"
  };
};
