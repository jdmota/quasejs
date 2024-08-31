import encoding from "./encoding";
import { SourceMapExtractor } from "./extractor";
import SourceMapExtractorBase, { SourceMapType } from "./extractor-base";
import { SourceMapConsumer, SourceMapGenerator, Position } from "source-map";

export { SourceMapExtractor, SourceMapExtractorBase };
export { SourceMapConsumer, SourceMapGenerator };

export async function joinSourceMaps(maps: SourceMapType[]) {
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
  if (!encoding.encode) {
    throw new Error(
      "Unsupported environment: `window.btoa` or `Buffer` should be supported."
    );
  }
  return (
    "data:application/json;charset=utf-8;base64," +
    encoding.encode(sourceMapToString(map))
  );
}

export const SOURCE_MAP_URL = "source" + "MappingURL"; // eslint-disable-line

export function sourceMapComment(url: string) {
  return `\n//# ${SOURCE_MAP_URL}=${url}`;
}

export function getOriginalLocation(
  map: SourceMapType,
  generated: Position & { bias?: number }
) {
  return SourceMapConsumer.with(map, null, consumer => {
    return consumer.originalPositionFor(generated);
  });
}
