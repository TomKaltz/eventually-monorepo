import joi from "joi";
import { isValidCron } from "cron-validator";
import { Service, Subscription } from "../types";
import * as regex from "./regex";

const pgChannel = joi.string().trim().max(100).regex(regex.pg_channel);
const outboxChannel = joi.string().trim().max(100).regex(regex.outbox_channel);
const voidChannel = joi.string().trim().max(100).regex(regex.void_channel);

// TODO: Have a custom implementation to run macros in a more flexible way
const cronChannel = joi
  .string()
  .trim()
  .max(100)
  .custom((value: string, helpers) => {
    const cronExpression = value.split("//")[1];
    const result = isValidCron(cronExpression, { seconds: true });
    if (!result) return helpers.error("cron expression is not valid");
    return value;
  });

export const editService = joi
  .object<Service>({
    channel: joi
      .alternatives()
      .match("one")
      .try(pgChannel, outboxChannel, voidChannel, cronChannel),
    url: joi.string().trim().uri().max(100)
  })
  .options({ presence: "required" });

export const addService = editService
  .append({
    id: joi.string().trim().max(100).regex(regex.name)
  })
  .options({ presence: "required" });

export const editSubscription = joi
  .object<Subscription>({
    producer: joi.string().trim().max(100).regex(regex.name),
    consumer: joi.string().trim().max(100).regex(regex.name),
    path: joi.string().trim().max(100).regex(regex.name),
    streams: joi.string().trim().max(100),
    names: joi.string().trim().max(250)
  })
  .options({ presence: "required" });

export const addSubscription = editSubscription
  .append({
    id: joi.string().trim().max(100).regex(regex.name)
  })
  .options({ presence: "required" });
