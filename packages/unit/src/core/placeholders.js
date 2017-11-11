// @flow

import { getStack } from "../../../error/src";
import isPromise from "../util/is-promise";
import { assertTimeout, assertNumber, assertDelay } from "../util/assert-args";
import type Runner from "./runner";
import { type InTestSequence } from "./sequence";
import Test, { Runnable } from "./test";
import TestCollection from "./test-collection";
import Suite from "./suite";
import addChain from "./add-chain";

// Public interface for suite
class GroupApi {
  _current: GroupPlaceholder;

  constructor( placeholder: GroupPlaceholder ) {
    this._current = placeholder;
  }
  delaySetup( promise ) {
    this._current.runner.delaySetup( promise );
  }
  retries( n ) {
    return this._current.retries( n );
  }
  retryDelay( n ) {
    return this._current.retryDelay( n );
  }
  timeout( n ) {
    return this._current.timeout( n );
  }
  slow( n ) {
    return this._current.slow( n );
  }
}

addChain( GroupApi );

type NumOrVoid = number | void;

export class GroupPlaceholder {

  name: ?string;
  fullname: ( ?string )[];
  callback: Function;
  metadata: Object & { type: "group" };
  parent: GroupPlaceholder;
  runner: Runner;
  level: number;
  collection: TestCollection;
  api: GroupApi;
  maxRetries: number;
  retryDelayValue: number;
  maxTimeout: number;
  timeoutStack: ?string;
  minSlow: number;

  constructor( name: ?string, callback: Function, metadata: Object, parent: GroupPlaceholder, root: ?boolean ) {
    this.name = name;
    this.fullname = root ? [] : parent.fullname.concat( name );
    this.metadata = metadata;
    this.parent = parent;
    this.runner = parent.runner;
    this.level = parent.level + 1;
    this.collection = new TestCollection( metadata.fastBail );
    this.api = new GroupApi( this );
    this.maxRetries = parent.maxRetries || 0;
    this.retryDelayValue = parent.retryDelayValue || 0;
    this.maxTimeout = parent.maxTimeout || 0;
    this.timeoutStack = parent.timeoutStack;
    this.minSlow = parent.minSlow || 0;

    if ( typeof callback === "function" ) {
      const prev = this.runner._current;
      this.runner._current = this;
      const ret = callback( this.api );
      if ( isPromise( ret ) ) {
        this.api.delaySetup( ret );
      }
      this.runner._current = prev;
    }
  }

  retries( n: NumOrVoid ) {
    if ( n === undefined ) {
      return this.maxRetries;
    }
    assertNumber( n );
    this.maxRetries = n;
  }

  retryDelay( n: NumOrVoid ) {
    if ( n === undefined ) {
      return this.retryDelayValue;
    }
    assertDelay( n );
    this.retryDelayValue = n;
  }

  timeout( n: NumOrVoid ) {
    if ( n === undefined ) {
      return this.maxTimeout;
    }
    assertTimeout( n );
    this.maxTimeout = n;
    this.timeoutStack = getStack( 3 );
  }

  slow( n: NumOrVoid ) {
    if ( n === undefined ) {
      return this.minSlow;
    }
    assertNumber( n );
    this.minSlow = n;
  }

  addTest( placeholder: Placeholder ) {
    this.collection.addTest( placeholder, this );
  }

  build( parent: ?Suite ): Suite {
    return new Suite( this, parent );
  }

}

export class TestPlaceholder {

  name: ?string;
  fullname: ( ?string )[];
  callback: Function;
  metadata: Object;
  parent: GroupPlaceholder;
  level: number;
  defaultStack: string;

  constructor( name: ?string, callback: Function, metadata: Object, parent: GroupPlaceholder ) {
    this.name = name;
    this.fullname = parent.fullname.concat( name );
    this.callback = callback;
    this.metadata = metadata;
    this.parent = parent;
    this.level = parent.level;
    this.defaultStack = getStack( 2 );
  }

  build( runnable: Runnable | InTestSequence, parent: Suite ): Test {
    return new Test( this, runnable, parent );
  }

  buildRunnable( context: ?Object, parent: Suite ): Runnable {
    return new Runnable( this, context, parent );
  }

}

export type Placeholder = TestPlaceholder | GroupPlaceholder;
