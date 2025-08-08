/* eslint-disable */
const serializerstring = (str: string): string => JSON.stringify(str);
export type EnvContext = string;
export const serializerEnvContext = serializerstring;
type $1 = Readonly<{}>;
const serializer$1 = (o: $1): string => `{}`;
export type TransformsConfig = $1;
export const serializerTransformsConfig = serializer$1;
type $4 = readonly EnvContext[];
const serializer$4 = (a: $4): string =>
  `[${a.map(serializerEnvContext).join(",")}]`;
type $3 = $4 | null;
const serializer$3 = (v: $3): string => (v == null ? "null" : serializer$4(v));
type $5 = TransformsConfig | null;
const serializer$5 = (v: $5): string =>
  v == null ? "null" : serializerTransformsConfig(v);
type $2 = Readonly<{
  env: $3;
  path: string;
  target: string;
  transforms: TransformsConfig | null;
}>;
const serializer$2 = (o: $2): string =>
  `{"env":${serializer$3(o.env)},"path":${serializerstring(
    o.path
  )},"target":${serializerstring(o.target)},"transforms":${serializer$5(
    o.transforms
  )}}`;
export type AssetRequest = $2;
export const serializerAssetRequest = serializer$2;
const serializernumber = (num: number): string => JSON.stringify(num);
type $7 = number | null;
const serializer$7 = (v: $7): string =>
  v == null ? "null" : serializernumber(v);
type $6 = Readonly<{ column: number | null; line: number }>;
const serializer$6 = (o: $6): string =>
  `{"column":${serializer$7(o.column)},"line":${serializernumber(o.line)}}`;
export type Position = $6;
export const serializerPosition = serializer$6;
type $9 = Position | null;
const serializer$9 = (v: $9): string =>
  v == null ? "null" : serializerPosition(v);
type $10 = string | null;
const serializer$10 = (v: $10): string =>
  v == null ? "null" : serializerstring(v);
type $8 = Readonly<{
  end: Position | null;
  filePath: string | null;
  start: Position;
}>;
const serializer$8 = (o: $8): string =>
  `{"end":${serializer$9(o.end)},"filePath":${serializer$10(
    o.filePath
  )},"start":${serializerPosition(o.start)}}`;
export type Loc = $8;
export const serializerLoc = serializer$8;
type $11 = Readonly<{}>;
const serializer$11 = (o: $11): string => `{}`;
export type Meta = $11;
export const serializerMeta = serializer$11;
const serializerboolean = (b: boolean): string => (b ? "true" : "false");
type $13 = Loc | null;
const serializer$13 = (v: $13): string =>
  v == null ? "null" : serializerLoc(v);
type $14 = Meta | null;
const serializer$14 = (v: $14): string =>
  v == null ? "null" : serializerMeta(v);
type $15 = string | null;
const serializer$15 = (v: $15): string =>
  v == null ? "null" : serializerstring(v);
type $16 = boolean | null;
const serializer$16 = (v: $16): string =>
  v == null ? "null" : serializerboolean(v);
type $17 = TransformsConfig | null;
const serializer$17 = (v: $17): string =>
  v == null ? "null" : serializerTransformsConfig(v);
type $12 = Readonly<{
  async: boolean;
  entry: boolean;
  env: $3;
  glob: boolean;
  loc: Loc | null;
  meta: Meta | null;
  resolved: string | null;
  specifier: string;
  splitPoint: boolean | null;
  target: string;
  transforms: TransformsConfig | null;
  url: boolean;
  weak: boolean;
}>;
const serializer$12 = (o: $12): string =>
  `{"async":${serializerboolean(o.async)},"entry":${serializerboolean(
    o.entry
  )},"env":${serializer$3(o.env)},"glob":${serializerboolean(
    o.glob
  )},"loc":${serializer$13(o.loc)},"meta":${serializer$14(
    o.meta
  )},"resolved":${serializer$15(o.resolved)},"specifier":${serializerstring(
    o.specifier
  )},"splitPoint":${serializer$16(o.splitPoint)},"target":${serializerstring(
    o.target
  )},"transforms":${serializer$17(o.transforms)},"url":${serializerboolean(
    o.url
  )},"weak":${serializerboolean(o.weak)}}`;
export type DependencyRequest = $12;
export const serializerDependencyRequest = serializer$12;
type $18 = Readonly<{ id: string; request: AssetRequest; type: string }>;
const serializer$18 = (o: $18): string =>
  `{"id":${serializerstring(o.id)},"request":${serializerAssetRequest(
    o.request
  )},"type":${serializerstring(o.type)}}`;
export type DepParent = $18;
export const serializerDepParent = serializer$18;
type $19 = Readonly<{ dependency: DependencyRequest; parent: DepParent }>;
const serializer$19 = (o: $19): string =>
  `{"dependency":${serializerDependencyRequest(
    o.dependency
  )},"parent":${serializerDepParent(o.parent)}}`;
export type DepRequestAndParent = $19;
export const serializerDepRequestAndParent = serializer$19;
