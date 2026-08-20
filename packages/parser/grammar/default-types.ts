import { builtin } from "../../schema/builtin-types";
import type { AnySchema, SchemaType } from "../../schema/schema-type";

const { unknown, literal, number, string, object, array, tuple, func, union } =
  builtin;

const EMPTY_OBJ_TYPE = object({});

const POSITION_TYPE = object({
  pos: number,
  line: number,
  column: number,
});

const LOCATION_TYPE = object({
  start: POSITION_TYPE,
  end: POSITION_TYPE,
});

const MARKER_TYPE = object({
  pos: number,
});

export const runtimeTypes = {
  $Empty: EMPTY_OBJ_TYPE,
  $Position: POSITION_TYPE,
  $Location: LOCATION_TYPE,
};

export const runtimeFuncs = {
  $startText: func(tuple([]), MARKER_TYPE),
  $endText: func(tuple([MARKER_TYPE]), string),
  $getPos: func(tuple([]), POSITION_TYPE),
  $getLoc: func(tuple([POSITION_TYPE]), LOCATION_TYPE),
};

export function getResultType(astType: AnySchema, gll: boolean) {
  if (gll) {
    return union(
      object({
        ok: literal(true),
        asts: array(astType),
      }),
      object({
        ok: literal(false),
        errors: array(tuple([number, unknown])),
      })
    );
  }
  return union(
    object({
      ok: literal(true),
      ast: astType,
    }),
    object({
      ok: literal(false),
      error: unknown,
    })
  );
}
