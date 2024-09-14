import fs from "fs-extra";
import path from "path";
import _writeFileAtomic from "write-file-atomic";
import crypto from "crypto";
import zlib from "zlib";
import { promisify } from "util";
import concordance, {
  type Options as ConcordanceOpts,
  type Descriptor,
} from "concordance";
import {
  coloredConcordanceOptions,
  plainConcordanceOptions,
} from "./concordance-options";
import { prettify, prettifyPath } from "../../../../util/path-url";
import { UUIDMap } from "../../../../util/data-structures/uuid-map";

const zip = promisify(zlib.gzip);
const unzip = promisify(zlib.gunzip);

export type SnapshotStats = {
  added: number;
  updated: number;
  removed: number;
  //
  missing: number;
  missmatch: number;
  obsolete: number;
  //
  total: number;
};

export type SnapshotResult =
  | Readonly<{
      type: "ok";
    }>
  | Readonly<{
      type: "missing";
      expectedDescribe: Descriptor;
      actualDescribe: Descriptor;
      diff: string;
    }>
  | Readonly<{
      type: "missmatch";
      expectedDescribe: Descriptor;
      actualDescribe: Descriptor;
      diff: string;
    }>;

export class SnapshotError extends Error {
  constructor(
    message: string,
    public readonly diff: string
  ) {
    super(message);
  }
}

type SnapLoc = undefined | string | ((file: string) => string);

export function getSnapshotLocation(
  filePath: string,
  snapshotLocation: SnapLoc
): string {
  if (snapshotLocation) {
    if (typeof snapshotLocation === "string") {
      return path.resolve(snapshotLocation);
    }
    if (typeof snapshotLocation === "function") {
      const out = snapshotLocation(filePath);
      if (typeof out === "string") {
        return path.resolve(out);
      }
    }
    throw new Error(
      `Expected 'snapshotLocation' to be a 'string' or 'string => string'`
    );
  }
  return path.resolve(filePath, "..", "__snapshots__", path.basename(filePath));
}

export class Snapshot {
  constructor(
    public readonly key: string,
    public readonly message: string,
    private readonly manager: SnapshotsOfFile,
    private descriptor: Descriptor | null,
    private buffer: Buffer | null
  ) {}

  getDescriptor(): Descriptor {
    return (
      this.descriptor ??
      (this.descriptor = concordance.deserialize(
        this.getBuffer(),
        this.manager.plainOpts
      ))
    );
  }

  getBuffer(): Buffer {
    return (
      this.buffer ?? (this.buffer = concordance.serialize(this.getDescriptor()))
    );
  }

  format() {
    return concordance.formatDescriptor(
      this.getDescriptor(),
      this.manager.plainOpts
    );
  }
}

export class SnapshotsOfTest {
  private updating: boolean = false;
  private snapshotKeys = new UUIDMap();
  private newSnapshots: Map<string, Snapshot> = new Map();
  private stats: SnapshotStats = {
    added: 0,
    updated: 0,
    removed: 0,
    missing: 0,
    missmatch: 0,
    obsolete: 0,
    total: 0,
  };

  constructor(
    private readonly manager: SnapshotsOfFile,
    public readonly key: string,
    public readonly title: readonly string[],
    private readonly prevSnapshots: ReadonlyMap<string, Snapshot>
  ) {}

  setUpdating(updating: boolean) {
    this.updating = updating;
  }

  matchesSnapshot(message: string, something: unknown): SnapshotResult {
    const { id: snapKey, first } = this.snapshotKeys.makeUnique(message);

    if (!first) {
      this.manager.addWarning(`Duplicate snapshot message: ${message}`);
    }

    const actual = new Snapshot(
      snapKey,
      message,
      this.manager,
      concordance.describe(something, this.manager.plainOpts),
      null
    );
    this.newSnapshots.set(snapKey, actual);
    this.stats.total++;

    const expected = this.prevSnapshots.get(snapKey);

    if (this.updating) {
      if (expected == null) {
        this.stats.added++;
      } else if (!expected.getBuffer().equals(actual.getBuffer())) {
        this.stats.updated++;
      }
      return { type: "ok" };
    }

    if (expected == null) {
      this.stats.missing++;
      const expectedDescriptor = concordance.describe(
        undefined,
        this.manager.plainOpts
      );
      return {
        type: "missing",
        expectedDescribe: expectedDescriptor,
        actualDescribe: actual.getDescriptor(),
        diff: concordance.diffDescriptors(
          actual.getDescriptor(),
          expectedDescriptor,
          this.manager.coloredOpts
        ),
      };
    }

    if (
      concordance.compareDescriptors(
        expected.getDescriptor(),
        actual.getDescriptor()
      )
    ) {
      return { type: "ok" };
    }

    this.stats.missmatch++;

    return {
      type: "missing",
      expectedDescribe: expected.getDescriptor(),
      actualDescribe: actual.getDescriptor(),
      diff: concordance.diffDescriptors(
        actual.getDescriptor(),
        expected.getDescriptor(),
        this.manager.coloredOpts
      ),
    };
  }

  saveStats(stats: SnapshotStats) {
    for (const key of this.prevSnapshots.keys()) {
      if (!this.newSnapshots.has(key)) {
        if (this.updating) {
          this.stats.removed++;
        } else {
          this.stats.obsolete++;
        }
      }
    }
    stats.added += this.stats.added;
    stats.updated += this.stats.updated;
    stats.removed += this.stats.removed;
    stats.missing += this.stats.missing;
    stats.missmatch += this.stats.missmatch;
    stats.obsolete += this.stats.obsolete;
    stats.total += this.stats.total;
  }

  makeReport(lines: string[]) {
    const map = this.updating ? this.newSnapshots : this.prevSnapshots;
    if (map.size) {
      lines.push(`## ${this.title.join(" > ")}\n`);
      for (const snapshot of map.values()) {
        lines.push(`> ${snapshot.message}\n`);
        lines.push("```");
        lines.push(snapshot.format());
        lines.push("```\n");
      }
    }
  }

  makeSnapshot(encoder: Encoder) {
    const map = this.updating ? this.newSnapshots : this.prevSnapshots;
    if (map.size) {
      encoder.pushString(this.key);
      encoder.pushString(JSON.stringify(this.title));
      encoder.pushInt(map.size);
      for (const snapshot of map.values()) {
        encoder.pushString(snapshot.key);
        encoder.pushString(snapshot.message);
        encoder.pushData(snapshot.getBuffer());
      }
    }
  }

  static decode(decoder: Decoder, manager: SnapshotsOfFile) {
    const key = decoder.readString();
    const title = JSON.parse(decoder.readString()) as readonly string[];
    const snapNum = decoder.readInt();

    const prevSnapshots = new Map<string, Snapshot>();
    for (let i = 0; i < snapNum; i++) {
      const snapKey = decoder.readString();
      const snapMsg = decoder.readString();
      prevSnapshots.set(
        snapKey,
        new Snapshot(
          snapKey,
          snapMsg,
          manager,
          null,
          Buffer.from(decoder.readData())
        )
      );
    }

    return new SnapshotsOfTest(manager, key, title, prevSnapshots);
  }
}

export class SnapshotsOfFile {
  public readonly snapPath: string;
  public readonly reportPath: string;
  private testKeys = new UUIDMap();
  private tests: Map<string, SnapshotsOfTest> = new Map();
  private warnings: string[] = [];

  constructor(
    public readonly plainOpts: ConcordanceOpts,
    public readonly coloredOpts: ConcordanceOpts,
    private readonly filePath: string
  ) {
    const adaptedPath = getSnapshotLocation(filePath, undefined); // TODO customize
    this.snapPath = adaptedPath + ".snap";
    this.reportPath = adaptedPath + ".md";
  }

  addWarning(warn: string) {
    this.warnings.push(warn);
  }

  getSnapshotsForTest(title: readonly string[], updating: boolean) {
    const { id: testKey, first } = this.testKeys.makeUnique(
      JSON.stringify(title)
    );

    if (!first) {
      this.addWarning(`Duplicate test title: ${title.join(" > ")}`);
    }

    const manager =
      this.tests.get(testKey) ??
      new SnapshotsOfTest(this, testKey, title, new Map());
    this.tests.set(testKey, manager);

    manager.setUpdating(updating);
    return manager;
  }

  async save(): Promise<{ stats: SnapshotStats; warnings: readonly string[] }> {
    const stats: SnapshotStats = {
      added: 0,
      updated: 0,
      removed: 0,
      missing: 0,
      missmatch: 0,
      obsolete: 0,
      total: 0,
    };

    for (const manager of this.tests.values()) {
      manager.saveStats(stats);
    }

    if (stats.added || stats.updated || stats.removed) {
      if (stats.total) {
        const p = fs.ensureDir(path.dirname(this.snapPath));
        const array = this.makeSnapshot();
        const report = this.makeReport();

        await p;
        await Promise.all([
          writeSnapFile(this.snapPath, array),
          writeFileAtomic(this.reportPath, report),
        ]);
      } else {
        await Promise.all([
          fs.remove(this.snapPath),
          fs.remove(this.reportPath),
        ]);
      }
    }

    return { stats, warnings: this.warnings };
  }

  makeReport() {
    const lines = [
      `# Quase-unit Snapshot Report for \`${prettify(this.filePath)}\`\n`,
    ];
    for (const manager of this.tests.values()) {
      manager.makeReport(lines);
    }
    return lines.join("\n");
  }

  makeSnapshot() {
    const encoder = new Encoder();
    encoder.pushString(HEADER);
    encoder.pushInt(this.tests.size);
    for (const snapshot of this.tests.values()) {
      snapshot.makeSnapshot(encoder);
    }
    return encoder.result();
  }

  static async decode(filePath: string) {
    const manager = new SnapshotsOfFile(
      plainConcordanceOptions,
      coloredConcordanceOptions,
      filePath
    );
    const array = await readSnapFile(manager.snapPath);
    if (array == null) {
      return manager;
    }

    const decoder = new Decoder(array);

    if (!decoder.checkDigest()) {
      throw new ChecksumError(manager.snapPath);
    }

    const header = decoder.readString();
    if (header !== HEADER) {
      throw new HeaderMismatchError(header, manager.snapPath);
    }

    const testsNum = decoder.readInt();
    for (let i = 0; i < testsNum; i++) {
      const test = SnapshotsOfTest.decode(decoder, manager);
      manager.tests.set(test.key, test);
    }

    return manager;
  }
}

class Encoder {
  private readonly chunks: Uint8Array[] = [];
  private readonly md5sum = crypto.createHash("md5");

  private push(array: Uint8Array) {
    this.chunks.push(array);
    this.md5sum.update(array);
  }

  pushInt(int: number) {
    const array = new Uint8Array(4);
    new DataView(array.buffer).setInt32(0, int);
    this.push(array);
  }

  pushString(str: string) {
    this.pushData(new TextEncoder().encode(str));
  }

  pushData(array: Uint8Array) {
    this.pushInt(array.byteLength);
    this.push(array);
  }

  result() {
    this.chunks.push(this.md5sum.digest());

    const { chunks } = this;
    const buffer = new Uint8Array(chunks.reduce((a, c) => a + c.byteLength, 0));
    let offset = 0;
    for (let i = 0; i < chunks.length; i++) {
      buffer.set(chunks[i], offset);
      offset += chunks[i].byteLength;
    }
    return buffer;
  }
}

class Decoder {
  private index: number = 0;
  private readonly view: DataView;

  constructor(private readonly array: Uint8Array) {
    this.view = new DataView(array.buffer);
  }

  readInt() {
    const int = this.view.getInt32(this.index);
    this.index += 4;
    return int;
  }

  readString() {
    return new TextDecoder().decode(this.readData());
  }

  readData() {
    const byteLen = this.readInt();
    const array = this.array.subarray(this.index, this.index + byteLen);
    this.index += byteLen;
    return array;
  }

  readDigest() {
    return this.array.subarray(
      this.array.byteLength - MD5_HASH_LENGTH,
      this.array.byteLength
    );
  }

  checkDigest() {
    const digest = crypto
      .createHash("md5")
      .update(this.array.subarray(0, this.array.byteLength - MD5_HASH_LENGTH))
      .digest();
    return this.readDigest().every((b, i) => b === digest[i]);
  }
}

const MD5_HASH_LENGTH = 16;

// Update this on major updates of concordance or quase-unit
const HEADER = "Quase-unit Snapshot v1";

class SnapshotReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotError";
  }
}

class ChecksumError extends SnapshotReadError {
  snapPath: string;
  constructor(snapPath: string) {
    super(`Checksum mismatch (${prettifyPath(snapPath)})`);
    this.name = "ChecksumError";
    this.snapPath = snapPath;
  }
}

class HeaderMismatchError extends SnapshotReadError {
  snapPath: string;
  actual: string;
  expected: string;
  constructor(header: string, snapPath: string) {
    super(`Unexpected snapshot header (${prettifyPath(snapPath)})`);
    this.name = "HeaderMismatchError";
    this.snapPath = snapPath;
    this.actual = header;
    this.expected = HEADER;
  }
}

async function readSnapFile(snapPath: string) {
  try {
    const compressed = await fs.readFile(snapPath);
    return await unzip(compressed);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      throw err;
    }
    return null;
  }
}

async function writeSnapFile(snapPath: string, array: Uint8Array) {
  const compressed = await zip(array);
  compressed[9] = 0x03; // Override the GZip header containing the OS to always be Linux
  await writeFileAtomic(snapPath, compressed);
}

function writeFileAtomic(filename: string, data: string | Buffer) {
  return new Promise<void>((resolve, reject) => {
    _writeFileAtomic(filename, data, {}, (err: Error | undefined) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
