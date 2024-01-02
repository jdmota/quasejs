import { typeBuilder } from "./types-builder";

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

export const runtimeTypes = {
  $Empty: EMPTY_OBJ_TYPE,
  $Position: POSITION_TYPE,
  $Location: LOCATION_TYPE,
};

export const runtimeFuncs = {
  getIndex: func([], int()),
  getText: func([int()], string()),
  getPos: func([], POSITION_TYPE),
  getLoc: func([POSITION_TYPE], LOCATION_TYPE),
};
