import optionChain from "../external/option-chain";
import fnName from "../util/fn-name";
import validate from "./validate";
import { GroupPlaceholder, TestPlaceholder } from "./placeholders";

function createTest( name, callback, metadata, parent ) {

  if ( typeof name === "function" ) {
    callback = name;
    name = undefined;
  }

  const { metadata: parentMetadata } = parent;

  if ( parentMetadata ) {
    if ( parentMetadata.strict ) {
      metadata.strict = true;
    }
  }

  validate( name, callback, metadata );

  if ( parentMetadata ) {
    if ( parentMetadata.failing ) {
      metadata.failing = true;
    }
    if ( parentMetadata.todo ) {
      metadata.todo = true;
    }
    if ( parentMetadata.skipped ) {
      metadata.skipped = true;
    }
  }

  name = name || fnName( callback || ( () => {} ) );

  return metadata.type === "group" ? new GroupPlaceholder( name, callback, metadata, parent ) : new TestPlaceholder( name, callback, metadata, parent );
}

const chain = {
  defaults: {
    type: "test",
    serial: false,
    exclusive: false,
    skipped: false,
    strict: false,
    todo: false,
    failing: false,
    fastBail: false
  },
  chainableMethods: {
    test: { type: "test" },
    before: { type: "before" },
    after: { type: "after" },
    beforeEach: { type: "beforeEach" },
    afterEach: { type: "afterEach" },
    group: { type: "group" },
    skip: { skipped: true },
    strict: { strict: true },
    serial: { serial: true },
    only: { exclusive: true },
    todo: { todo: true },
    failing: { failing: true },
    fastBail: { fastBail: true }
  }
};

function addTest( options, title, callback ) {
  const placeholder = createTest( title, callback, options, this._current );
  this._current.addTest( placeholder );
  return placeholder.api;
}

export default function( clazz ) {
  optionChain( chain, addTest, clazz.prototype );
}
