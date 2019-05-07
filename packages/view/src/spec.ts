export const PART_ATTR = 0;
export const PART_PROP = 1;
export const PART_EVENT = 2;
export const PART_NODE = 3;

export const TEMPLATE = "t";
export const TEMPLATE_RESULT = "r";

export const MASK = 0b11;
export const BITS = 2;

export function partValue( newMark: boolean, type: number ) {
  const newMarkBit = newMark ? 1 : 0;
  return ( newMarkBit << BITS ) | type;
}
