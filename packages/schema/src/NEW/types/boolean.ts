import { createSchemaType } from "../schema";
import { SchemaOpCtx } from "../util/context";

export const booleanType = createSchemaType<unknown, boolean>(
  (value: unknown, ctx: SchemaOpCtx) => {
    return ctx.validate<boolean>(
      typeof value === "boolean",
      "a boolean",
      value
    );
  }
);
