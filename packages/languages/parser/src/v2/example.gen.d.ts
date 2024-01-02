type $Empty = Readonly<Record<string, never>>;
type $Position = Readonly<{ "pos": number, "line": number, "column": number }>;
type $Location = Readonly<{ "start": $Position, "end": $Position }>;
type $_T0 = Readonly<{ "x": (null | $_T0), "y": (null | $_T0), "z": (null | $_T0) }>;
type $AST = Readonly<{ "o": Readonly<{ "id": number }>, "b": (null | $Empty), "c": Readonly<{ "ret": Readonly<{ "x": number, "y": number }>, "text": (string | null) }>, "d": (never[] | (never | string)[]), "t": $_T0, "external": boolean }>;
type $Externals = Readonly<{ "externalCall": ((_0: Readonly<{ "id": number }>, _1: Readonly<{ "ret": Readonly<{ "x": number, "y": number }>, "text": (string | null) }>) => boolean) }>;
export function parse(external: $Externals, string: string): $AST;
