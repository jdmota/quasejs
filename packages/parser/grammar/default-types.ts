import { builtin } from "../../schema/builtin-types";
import type { SchemaType } from "../../schema/schema-type";

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
  $startText: func([], MARKER_TYPE),
  $endText: func([MARKER_TYPE], string),
  $getPos: func([], POSITION_TYPE),
  $getLoc: func([POSITION_TYPE], LOCATION_TYPE),
};

export function getResultType(astType: SchemaType, gll: boolean) {
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
