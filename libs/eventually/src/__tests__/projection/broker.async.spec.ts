import { InMemoryBroker } from "../../adapters";
import { app, client } from "../../ports";
import { dispose } from "../../port";
import { MatchProjector } from "./Match.projector";
import { MatchSystem } from "./Match.system";

describe("async broker", () => {
  const broker = InMemoryBroker({ timeout: 1000, limit: 10, throttle: 500 });

  beforeAll(async () => {
    app().with(MatchSystem).with(MatchProjector).build();
    await app().listen();
  });

  afterAll(async () => {
    await dispose()();
  });

  it("should project", async () => {
    await client().command(
      "CreateCustomer",
      {
        id: 1,
        name: "testing name"
      },
      { stream: "test" }
    );
    await client().command(
      "ChangeCustomerName",
      {
        id: 1,
        name: "changed the name"
      },
      { stream: "test" }
    );
    await client().command(
      "CreateCustomer",
      {
        id: 2,
        name: "testing name"
      },
      { stream: "test" }
    );
    //await client().query({ limit: 5 }, (e) => log().events([e]));
    await broker.drain();
    let p = { watermark: 0 };
    await client().read(MatchProjector, "MatchSystem", (r) => (p = r));
    expect(p).toBeDefined();
    expect(p.watermark).toBe(2);
    await broker.dispose();
  });
});
