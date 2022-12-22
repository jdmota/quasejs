import { JsonValue, Jsonify, JsonPrimitive } from "type-fest";

type PluginRegistry = { readonly [key: string]: Plugin<any, any, any, any> };

type Plugin<
  R extends PluginRegistry,
  I extends JsonValue,
  O extends JsonValue,
  M extends FileRequest<R, keyof R>
> = (
  file: string,
  arg: I
) => Promise<{
  readonly data: O;
  readonly more: readonly M[];
}>;

type PluginInput<P> = P extends Plugin<any, infer I, any, any> ? I : unknown;

type PluginOutput<P> = P extends Plugin<any, any, infer O, any> ? O : unknown;

type PluginMore<P> = P extends Plugin<any, any, any, infer M> ? M : unknown;

type FileRequest<R extends PluginRegistry, N extends keyof R> = {
  readonly file: string;
  readonly plugin: N;
  readonly data: PluginInput<R[N]>;
};

type RawFileRequest = {
  readonly file: string;
  readonly plugin: string;
  readonly data: JsonValue;
};

export {};
