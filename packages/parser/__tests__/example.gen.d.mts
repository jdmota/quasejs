export type $Empty = Readonly<Record<string, never>>;
export type $Position = Readonly<{ pos: number, line: number, column: number }>;
export type $Location = Readonly<{ start: $Position, end: $Position }>;
export type $_T0 = Readonly<{ y: (null | $_T0), z: (null | $_T0), $loc: $Location }>;
export type $AST = Readonly<{ o: Readonly<{ id: number }>, b: (null | Readonly<{ $loc: $Location }>), c: Readonly<{ ret: Readonly<{ x: number, y: number }>, text: (string | null), $loc: $Location }>, d: readonly string[], t: $_T0, external: boolean, $loc: $Location }>;
export type $Externals = Readonly<{ externalCall: ((_0: Readonly<{ id: number }>, _1: Readonly<{ ret: Readonly<{ x: number, y: number }>, text: (string | null), $loc: $Location }>) => boolean) }>;
export type $Result = Readonly<{ ok: true; asts: readonly $AST[] }> | Readonly<{ ok: false; errors: readonly (readonly [number, unknown])[] }>;
export function parse(external: $Externals, string: string, $arg: string): $Result;
