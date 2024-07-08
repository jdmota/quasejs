import optionChain from "./util/option-chain";
import { GroupPlaceholder, TestPlaceholder } from "./placeholders";
import { MetadataTypes, TestMetadata, GroupMetadata } from "../types";
import Runner from "./runner";

function validateHelper(metadata: TestMetadata | GroupMetadata, callback: any) {
  if (metadata.type !== "test" && metadata.type !== "group") {
    if (metadata.serial) {
      return "The `serial` modifier cannot be used with hooks.";
    }

    if (metadata.exclusive) {
      return "The `only` modifier cannot be used with hooks.";
    }

    if (metadata.status === "failing") {
      return "The `failing` modifier cannot be used with hooks.";
    }

    if (metadata.status === "todo") {
      return "The `todo` modifier is only for documentation of future tests and cannot be used with hooks.";
    }

    if (metadata.allowNoPlan) {
      return "The `allowNoPlan` modifier is not need for hooks.";
    }
  }

  if (
    metadata.status !== "todo" &&
    metadata.type !== "group" &&
    typeof callback !== "function"
  ) {
    return "Expected an implementation.";
  }

  if (metadata.strict) {
    if (
      metadata.exclusive ||
      metadata.status === "failing" ||
      metadata.status === "todo" ||
      metadata.status === "skipped"
    ) {
      return "`only`, `failing`, `todo`, `skipped` modifiers are not allowed in strict mode.";
    }
  }
}

function validate(metadata: TestMetadata | GroupMetadata, callback: any) {
  const msg = validateHelper(metadata, callback);
  if (msg) {
    throw new Error(msg);
  }
}

function createTest(
  this: Runner,
  metadata: TestMetadata | GroupMetadata,
  name: any,
  callback: any
) {
  const runner = this;
  const parent = runner._current;

  if (typeof name === "function") {
    callback = name;
    name = undefined;
  }

  const { metadata: parentMetadata } = parent;

  if (parentMetadata && parentMetadata.strict) {
    metadata.strict = true;
  }

  validate(metadata, callback);

  if (parentMetadata) {
    if (metadata.type === "test" || metadata.type === "group") {
      if (parentMetadata.status === "failing") {
        metadata.status = metadata.status || "failing";
      } else {
        metadata.status = parentMetadata.status || metadata.status;
      }
    }
    if (parentMetadata.allowNoPlan) {
      metadata.allowNoPlan = true;
    }
  }

  name = name || "anonymous";

  const placeholder =
    metadata.type === "group"
      ? new GroupPlaceholder(name, callback, metadata, parent)
      : new TestPlaceholder(name, callback, metadata, parent);

  return placeholder instanceof GroupPlaceholder ? placeholder.api : undefined;
}

function handleType(type: MetadataTypes) {
  return (data: TestMetadata | GroupMetadata) => {
    if (data.type !== "test") {
      throw new Error(`Cannot use '${type}' and '${data.type}' together`);
    }
    data.type = type;
  };
}

const errors = {
  todo: "The `todo` modifier is only for documentation and cannot be used with skip, only, or failing.",
  onlyAndSkip: "`only` tests cannot be skipped.",
};

const chain = {
  defaults: {
    type: "test",
    serial: false,
    exclusive: false,
    strict: false,
    status: "",
    allowNoPlan: false,
  },
  methods: {
    test: handleType("test"),
    before: handleType("before"),
    after: handleType("after"),
    beforeEach: handleType("beforeEach"),
    afterEach: handleType("afterEach"),
    group: handleType("group"),
    strict: (data: TestMetadata | GroupMetadata) => {
      data.strict = true;
    },
    serial: (data: TestMetadata | GroupMetadata) => {
      data.serial = true;
    },
    only: (data: TestMetadata | GroupMetadata) => {
      if (data.status === "todo") {
        throw new Error(errors.todo);
      }
      if (data.status === "skipped") {
        throw new Error(errors.onlyAndSkip);
      }
      data.exclusive = true;
    },
    skip: (data: TestMetadata | GroupMetadata) => {
      if (data.status === "todo") {
        throw new Error(errors.todo);
      }
      if (data.exclusive) {
        throw new Error(errors.onlyAndSkip);
      }
      data.status = "skipped";
    },
    todo: (data: TestMetadata | GroupMetadata) => {
      if (
        data.status === "failing" ||
        data.status === "skipped" ||
        data.exclusive
      ) {
        throw new Error(errors.todo);
      }
      data.status = "todo";
    },
    failing: (data: TestMetadata | GroupMetadata) => {
      if (data.status === "todo") {
        throw new Error(errors.todo);
      }
      data.status = "failing";
    },
    allowNoPlan: (data: TestMetadata | GroupMetadata) => {
      data.allowNoPlan = true;
    },
  },
};

export function createTestChain(ctx: Runner) {
  return optionChain(chain, createTest, ctx);
}

export function extendWithChain(clazz: any) {
  return optionChain(chain, createTest, null, clazz.prototype);
}
