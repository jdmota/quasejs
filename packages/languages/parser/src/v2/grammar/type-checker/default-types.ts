import { typeBuilder } from "./types-builder.ts";

const { int, string, readObject, func } = typeBuilder;

const EMPTY_OBJ_TYPE = readObject({});

const POSITION_TYPE = readObject({
  pos: int(),
  line: int(),
  column: int(),
});

const LOCATION_TYPE = readObject({
  start: POSITION_TYPE,
  end: POSITION_TYPE,
});

const MARKER_TYPE = readObject({
  pos: int(),
});

export const runtimeTypes = {
  $Empty: EMPTY_OBJ_TYPE,
  $Position: POSITION_TYPE,
  $Location: LOCATION_TYPE,
};

export const runtimeFuncs = {
  $startText: func([], MARKER_TYPE),
  $endText: func([MARKER_TYPE], string()),
  $getPos: func([], POSITION_TYPE),
  $getLoc: func([POSITION_TYPE], LOCATION_TYPE),
};
