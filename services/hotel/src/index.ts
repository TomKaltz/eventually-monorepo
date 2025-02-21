import { app, bootstrap, store } from "@rotorsoft/eventually";
import { ExpressApp, sse } from "@rotorsoft/eventually-express";
import path from "node:path";
import { Hotel } from "./Hotel.projector";
import { Room } from "./Room.aggregate";
import { engine } from "express-handlebars";
import { Next30Days } from "./Next30Days.projector";
import * as routes from "./routes";
import { pgHotelProjectorStore, pgNext30ProjectorStore } from "./stores";
import { HomeView, readHomeView } from "./utils";

void bootstrap(async (): Promise<void> => {
  await store().seed();
  await pgHotelProjectorStore.seed();
  await pgNext30ProjectorStore.seed();

  const express = app(new ExpressApp())
    .with(Room)
    .with(Hotel, { store: pgHotelProjectorStore })
    .with(Next30Days, { store: pgNext30ProjectorStore })
    .build();

  // get some ui to play with it
  express.engine(
    "hbs",
    engine({
      extname: ".hbs"
    })
  );
  express.set("view engine", "hbs");
  express.set("views", path.resolve(__dirname, "./views"));
  express.get("/home", routes.home);

  // setup a SSE monitor to update gui
  const mon = sse<HomeView>("monitor");
  express.get("/monitor", (req, res) => {
    mon.push(req, res);
  });

  app().on("projection", async ({ factory, results }) => {
    console.log(factory.name, results);
    const state = await readHomeView();
    mon.send(state);
  });

  await app().listen();
});
