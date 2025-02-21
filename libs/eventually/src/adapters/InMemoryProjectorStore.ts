import { ProjectorStore } from "../interfaces";
import {
  Condition,
  Projection,
  ProjectionQuery,
  ProjectionRecord,
  ProjectionResults,
  State,
  StateWithId
} from "../types";
import { clone } from "../utils";

/**
 * @category Adapters
 * @remarks In-memory projector store
 */
export const InMemoryProjectorStore = <
  S extends State
>(): ProjectorStore<S> => {
  let _projections: Record<string, ProjectionRecord<S>> = {};

  const select = (
    watermark: number,
    filter?: Partial<S>
  ): ProjectionRecord<S>[] => {
    const key = filter
      ? Object.entries(filter)
          .map(([k, v]) => `${k}=${v}`)
          .join(";")
      : undefined;
    return filter
      ? Object.values(_projections).filter(
          (p) =>
            p.watermark < watermark &&
            key ===
              Object.entries(p.state)
                .filter(([k]) => filter[k])
                .map(([k, v]) => `${k}=${v}`)
                .join(";")
        )
      : [];
  };

  return {
    name: "InMemoryProjectionStore",
    dispose: () => {
      _projections = {};
      return Promise.resolve();
    },

    seed: () => Promise.resolve(),

    load: (ids: string[]): Promise<ProjectionRecord<S>[]> =>
      Promise.resolve(ids.map((id) => _projections[id]).filter(Boolean)),

    commit: async (
      projection: Projection<S>,
      watermark: number
    ): Promise<ProjectionResults<S>> => {
      const results: ProjectionResults<S> = {
        upserted: [],
        deleted: [],
        watermark
      };

      projection.upserts &&
        projection.upserts.forEach(({ where, values }) => {
          const id = where.id;
          id &&
            !_projections[id] &&
            (_projections[id] = {
              state: { id, ...values } as unknown as StateWithId<S>,
              watermark: -1
            });

          const to_upsert = select(watermark, where);
          to_upsert.forEach(
            (p) =>
              (_projections[p.state.id] = {
                state: clone<StateWithId<S>>(p.state, values),
                watermark
              })
          );
          results.upserted.push({ where, count: to_upsert.length });
        });

      projection.deletes &&
        projection.deletes.forEach(({ where }) => {
          const to_delete = select(watermark, where).map((p) => p.state.id);
          to_delete.forEach((id) => delete _projections[id]);
          results.deleted.push({ where, count: to_delete.length });
        });

      return Promise.resolve(results);
    },

    query: (
      query: ProjectionQuery<S>,
      callback: (record: ProjectionRecord<S>) => void
    ): Promise<number> => {
      let count = 0;
      Object.values(_projections).forEach((record) => {
        // TODO: apply sort and select clauses
        const match = query.where
          ? Object.entries(query.where).reduce(
              (match, [key, condition]: [string, Condition<any>]) => {
                const val = record.state[key];
                switch (condition.operator) {
                  case "eq":
                    return match && val == condition.value;
                  case "neq":
                    return match && val != condition.value;
                  case "lt":
                    return match && val < condition.value;
                  case "lte":
                    return match && val <= condition.value;
                  case "gt":
                    return match && val > condition.value;
                  case "gte":
                    return match && val >= condition.value;
                  case "in":
                    return match && val == condition.value;
                  case "nin":
                    return match && val != condition.value;
                }
              },
              true
            )
          : true;
        if (match) {
          count++;
          if (query.limit && count > query.limit) return count;
          callback(record);
        }
      });
      return Promise.resolve(count);
    }
  };
};
