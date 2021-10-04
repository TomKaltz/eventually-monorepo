import { AppBase } from "./AppBase";
import { Singleton } from "./utils";
import { InMemoryApp } from "./__dev__";

export * from "./AppBase";
export * from "./Broker";
export * from "./config";
export * from "./Store";
export * from "./types";
export * from "./utils";
export * from "./log";
export * from "./__dev__";

export const App = Singleton(function App(base?: AppBase) {
  return base || new InMemoryApp();
});
