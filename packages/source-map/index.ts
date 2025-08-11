import { encodeBase64 } from "../util/encoding";
import { SourceMapExtractor } from "./extractor";
import { type SourceMapType, SourceMapExtractorBase } from "./extractor-base";
import {
  SourceMapConsumer,
  SourceMapGenerator,
  type Position,
} from "source-map";

export { SourceMapExtractor, SourceMapExtractorBase };
export { SourceMapConsumer, SourceMapGenerator };

// Likely that this produces a low resolution source map. Resources to consider:
// https://github.com/mozilla/source-map/issues/216
// https://github.com/Rich-Harris/sorcery
// https://github.com/aleclarson/sorcery
// https://github.com/rollup/rollup/blob/master/src/utils/collapseSourcemaps.ts
// https://github.com/babel/babel/blob/master/packages/babel-core/src/transformation/file/merge-map.js
export async function joinSourceMaps(maps: readonly SourceMapType[]) {
  if (maps.length === 0) {
    throw new Error(`No sourcemaps provided`);
  }

  if (maps.length === 1) {
    throw new Error(`Only 1 sourcemap provided`);
  }

  const consumer0 = await new SourceMapConsumer(maps[0]);
  const mergedGenerator = SourceMapGenerator.fromSourceMap(consumer0);
  consumer0.destroy();

  for (const map of maps.slice(1)) {
    const consumer = await new SourceMapConsumer(map);
    mergedGenerator.applySourceMap(consumer);
    consumer.destroy();
  }

  return mergedGenerator.toJSON();
}

export function sourceMapToString(map: SourceMapType) {
  return JSON.stringify(map);
}

export function sourceMapToUrl(map: SourceMapType) {
  return (
    "data:application/json;charset=utf-8;base64," +
    encodeBase64(sourceMapToString(map))
  );
}

// Prevent tooling from mistaking this for an actual sourceMappingURL
export const SOURCE_MAP_URL = "source" + "MappingURL";

export function sourceMapComment(url: string) {
  return `\n//# ${SOURCE_MAP_URL}=${url}`;
}

export function getOriginalLocation(
  map: SourceMapType,
  generated: Readonly<Position & { bias?: number }>
) {
  return SourceMapConsumer.with(map, null, consumer => {
    return consumer.originalPositionFor(generated);
  });
}
