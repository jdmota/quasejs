import fnName from "./util/fn-name";
import optionChain from "./option-chain";
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
    if ( metadata.type === "test" || metadata.type === "group" ) {
      metadata.status = metadata.status || parentMetadata.status;
    }
    if ( parentMetadata.allowNoPlan ) {
      metadata.allowNoPlan = true;
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
    strict: false,
    status: "",
    fastBail: false,
    allowNoPlan: false
  },
  chainableMethods: {
    test: { type: "test" },
    before: { type: "before" },
    after: { type: "after" },
    beforeEach: { type: "beforeEach" },
    afterEach: { type: "afterEach" },
    group: { type: "group" },
    strict: { strict: true },
    serial: { serial: true },
    only: { exclusive: true },
    skip: { status: "skipped" },
    todo: { status: "todo" },
    failing: { status: "failing" },
    fastBail: { fastBail: true },
    allowNoPlan: { allowNoPlan: true }
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
