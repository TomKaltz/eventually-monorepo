import { MessageFactory } from "@rotorsoft/eventually";
import { Keys } from "./Calculator.Model";
import { PressKeySchema, ResetSchema } from "../Schemas/Calculator.Schemas";

export type CalculatorCommands = {
  PressKey: { key: Keys };
  Reset: undefined;
};

// Aggregate HTTP POST endpoints receiving commands from human actors and brokers (from policies)
export const CalculatorCommandsFactory: MessageFactory<CalculatorCommands> = {
  PressKey: (data: { key: Keys }) => ({
    name: "PressKey",
    data,
    schema: () => PressKeySchema
  }),

  Reset: () => ({
    name: "Reset",
    schema: () => ResetSchema
  })
};
