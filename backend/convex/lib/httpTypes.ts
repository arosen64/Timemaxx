import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type HonoEnv = {
  Bindings: {
    ctx: ActionCtx;
    userId: Id<"users">;
  };
};
