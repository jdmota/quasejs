// @flow

import isPromise from "./util/is-promise";
import { assertTimeout, assertNumber, assertDelay } from "./util/assert-args";
import type Runner from "./runner";
import { type InTestSequence } from "./sequence";
import Test, { Runnable } from "./test";
import TestCollection from "./test-collection";
import Suite from "./suite";
import addChain from "./add-chain";
import { type Metadata } from "./types";

const { getStack } = require( "@quase/error" );

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
  reruns( n ) {
    return this._current.defineReruns( n );
  }
  rerunDelay( n ) {
    return this._current.rerunDelay( n );
  }
  timeout( n ) {
    return this._current.timeout( n );
  }
  slow( n ) {
    return this._current.slow( n );
  }
  allowRandomization( b ) {
    return this._current.allowRandomization( b );
  }
  forceSerial( b ) {
    return this._current.forceSerial( b );
  }
}

addChain( GroupApi );

type NumOrVoid = number | void;

export class GroupPlaceholder {

  name: string;
  fullname: string[];
  callback: Function;
  metadata: Metadata;
  parent: GroupPlaceholder;
  runner: Runner;
  level: number;
  collection: TestCollection;
  api: GroupApi;

  maxTimeout: number;
  timeoutStack: ?string;
  minSlow: number;

  maxRetries: number;
  retryDelayValue: number;

  reruns: number;
  rerunDelayValue: number;

  randomizationAllowed: boolean;
  serialForced: boolean;

  constructor( name: string, callback: Function, metadata: Metadata, parent: GroupPlaceholder, root: ?boolean ) {
    this.name = name;
    this.fullname = root ? [] : parent.fullname.concat( this.name );
    this.metadata = metadata;
    this.parent = parent;
    this.runner = parent.runner;
    this.level = parent.level + 1;
    this.collection = new TestCollection( metadata.bail );
    this.api = new GroupApi( this );

    this.maxTimeout = parent.maxTimeout || 0;
    this.timeoutStack = parent.timeoutStack;
    this.minSlow = parent.minSlow || 0;

    this.maxRetries = parent.maxRetries || 0;
    this.retryDelayValue = parent.retryDelayValue || 0;
    this.reruns = parent.reruns || 0;
    this.rerunDelayValue = parent.rerunDelayValue || 0;

    this.randomizationAllowed = parent.randomizationAllowed;
    this.serialForced = parent.serialForced;

    if ( !root ) {
      parent.collection.addTest( this, parent );
    }

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

  defineReruns( n: NumOrVoid ) {
    if ( n === undefined ) {
      return this.reruns;
    }
    assertNumber( n );
    this.reruns = n;
  }

  rerunDelay( n: NumOrVoid ) {
    if ( n === undefined ) {
      return this.rerunDelayValue;
    }
    assertDelay( n );
    this.rerunDelayValue = n;
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

  allowRandomization( b: boolean ) {
    if ( b === undefined ) {
      return this.randomizationAllowed;
    }
    this.randomizationAllowed = b;
  }

  forceSerial( b: boolean ) {
    if ( b === undefined ) {
      return this.serialForced;
    }
    this.serialForced = b;
  }

  build( parent: ?Suite ): Suite {
    return new Suite( this, parent );
  }

}

export class TestPlaceholder {

  name: string;
  fullname: string[];
  callback: Function;
  metadata: Metadata;
  parent: GroupPlaceholder;
  level: number;
  defaultStack: string;

  constructor( name: string, callback: Function, metadata: Metadata, parent: GroupPlaceholder ) {
    this.name = name;
    this.fullname = parent.fullname.concat( this.name );
    this.callback = callback;
    this.metadata = metadata;
    this.parent = parent;
    this.level = parent.level;
    this.defaultStack = getStack( 5 );

    parent.collection.addTest( this, parent );
  }

  build( runnable: Runnable | InTestSequence, parent: Suite ): Test {
    return new Test( this, runnable, parent );
  }

  buildRunnable( context: ?Object, parent: Suite ): Runnable {
    return new Runnable( this, context, parent );
  }

}

export type Placeholder = TestPlaceholder | GroupPlaceholder;
