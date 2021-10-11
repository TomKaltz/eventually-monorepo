import {
  Aggregate,
  AggregateFactory,
  aggregatePath,
  AppBase,
  broker,
  committedSchema,
  config,
  Errors,
  Evt,
  Msg,
  Payload,
  Snapshot,
  ValidationError
} from "@rotorsoft/eventually";
import cors from "cors";
import express, {
  NextFunction,
  Request,
  Response,
  Router,
  urlencoded
} from "express";
import { Server } from "http";

type GetCallback = <M extends Payload, C, E>(
  aggregate: Aggregate<M, C, E>
) => Promise<Snapshot<M> | Snapshot<M>[]>;

export class ExpressApp extends AppBase {
  private _app = express();
  private _router = Router();
  private _server: Server;

  private _buildStreamRoute(): void {
    this._router.get(
      "/stream/:event?",
      async (
        req: Request<
          { event?: string },
          Evt[],
          any,
          { after?: number; limit?: number }
        >,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const { event } = req.params;
          const { after, limit } = req.query;
          const result = await this.read(
            event,
            after && +after,
            limit && +limit
          );
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info("green", "[GET]", "/stream/[event]?after=-1&limit=1");
  }

  private _buildGetter<M extends Payload, C, E>(
    factory: AggregateFactory<M, C, E>,
    callback: GetCallback,
    suffix?: string
  ): void {
    const path = aggregatePath(factory).concat(suffix || "");
    this._router.get(
      path,
      async (
        req: Request<{ id: string }>,
        res: Response,
        next: NextFunction
      ) => {
        try {
          const { id } = req.params;
          const result = await callback(factory(id));
          let etag = "-1";
          if (Array.isArray(result)) {
            if (result.length)
              etag = result[result.length - 1].event.version.toString();
          } else if (result.event) {
            etag = result.event.version.toString();
          }
          res.setHeader("ETag", etag);
          return res.status(200).send(result);
        } catch (error) {
          next(error);
        }
      }
    );
    this.log.info("green", `[GET ${factory.name}]`, path);
  }

  private _buildCommandHandlers(): void {
    const aggregates: Record<
      string,
      AggregateFactory<Payload, unknown, unknown>
    > = {};
    Object.values(this._handlers.commandHandlers).map(
      ({ type, factory, command, path }) => {
        if (type === "aggregate")
          aggregates[factory.name] = factory as AggregateFactory<
            Payload,
            unknown,
            unknown
          >;
        this._router.post(
          path,
          async (
            req: Request<{ id: string }>,
            res: Response,
            next: NextFunction
          ) => {
            try {
              const { error, value } = command
                .schema()
                .validate(req.body, { abortEarly: false });
              if (error) throw new ValidationError(error);
              const snapshots = await this.command(
                factory(req.params.id),
                value,
                type === "aggregate" ? +req.headers["if-match"] : undefined
              );
              res.setHeader(
                "ETag",
                snapshots[snapshots.length - 1].event.version
              );
              return res.status(200).send(snapshots);
            } catch (error) {
              next(error);
            }
          }
        );
      }
    );

    Object.values(aggregates).map((factory) => {
      this._buildGetter(factory, this.load.bind(this));
      this._buildGetter(factory, this.stream.bind(this), "/stream");
    });
  }

  private _buildEventHandlers(): void {
    Object.values(this._handlers.eventHandlers).map(
      ({ factory, event, path }) => {
        this._router.post(
          path,
          async (req: Request, res: Response, next: NextFunction) => {
            try {
              const message = broker().decode(req.body);
              const validator = committedSchema(
                (event as unknown as Msg).schema()
              );
              const { error, value } = validator.validate(message, {
                abortEarly: false
              });
              if (error) throw new ValidationError(error);
              const response = await this.event(factory, value);
              return res.status(200).send(response);
            } catch (error) {
              next(error);
            }
          }
        );
      }
    );
  }

  build(): express.Express {
    super.build();

    this._buildCommandHandlers();
    this._buildEventHandlers();
    this._buildStreamRoute();

    this._app.set("trust proxy", true);
    this._app.use(cors());
    this._app.use(urlencoded({ extended: false }));
    this._app.use(express.json());
    this._app.use(this._router);
    this._app.use(
      // eslint-disable-next-line
      (error: Error, req: Request, res: Response, next: NextFunction) => {
        this.log.error(error);
        // eslint-disable-next-line
        const { message, stack, ...other } = error;
        if (message === Errors.ValidationError)
          res.status(400).send({ message, ...other });
        else if (message === Errors.ConcurrencyError)
          res.status(409).send({ message, ...other });
        else res.status(500).send({ message });
      }
    );

    return this._app;
  }

  /**
   * Starts listening
   * @param silent flag to skip express listening when using cloud functions
   */
  async listen(silent = false): Promise<void> {
    await super.listen();
    if (silent) this.log.info("white", "Config", config());
    else
      this._server = this._app.listen(config().port, () => {
        this.log.info("white", "Express app is listening", config());
      });
  }

  async close(): Promise<void> {
    await super.close();
    if (this._server) {
      this._server.close();
      delete this._server;
    }
  }
}
