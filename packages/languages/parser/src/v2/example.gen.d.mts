type $Empty = Readonly<Record<string, never>>;
type $Position = Readonly<{ pos: number, line: number, column: number }>;
type $Location = Readonly<{ start: $Position, end: $Position }>;
type $_T0 = Readonly<{ y: (null | $_T0), z: (null | $_T0), $loc: $Location }>;
type $AST = Readonly<{ o: Readonly<{ id: number }>, b: (null | Readonly<{ $loc: $Location }>), c: Readonly<{ ret: Readonly<{ x: number, y: number }>, text: (string | null), $loc: $Location }>, d: readonly string[], t: $_T0, external: boolean, $loc: $Location }>;
type $Externals = Readonly<{ externalCall: ((_0: Readonly<{ id: number }>, _1: Readonly<{ ret: Readonly<{ x: number, y: number }>, text: (string | null), $loc: $Location }>) => boolean) }>;
export function parse(external: $Externals, string: string, $arg: string): $AST;
