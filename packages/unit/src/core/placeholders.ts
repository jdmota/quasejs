import { getStack } from "@quase/error";
import {
  TestMetadata,
  GroupMetadata,
  NumOrVoid,
  PublicTestApi,
} from "../types";
import isPromise from "./util/is-promise";
import { assertTimeout, assertNumber, assertDelay } from "./util/assert-args";
import Runner from "./runner";
import { InTestSequence } from "./sequence";
import Test, { Runnable } from "./test";
import TestCollection from "./test-collection";
import Suite from "./suite";
import { extendWithChain } from "./chain";

// Public interface for suite
class GroupApi {
  private _current: GroupPlaceholder; // eslint-disable-line no-use-before-define

  constructor(placeholder: GroupPlaceholder) {
    this._current = placeholder;
  }
  delaySetup(promise: PromiseLike<unknown>) {
    this._current.runner.delaySetup(promise);
  }
  retries(n: NumOrVoid) {
    return this._current.retries(n);
  }
  retryDelay(n: NumOrVoid) {
    return this._current.retryDelay(n);
  }
  reruns(n: NumOrVoid) {
    return this._current.defineReruns(n);
  }
  rerunDelay(n: NumOrVoid) {
    return this._current.rerunDelay(n);
  }
  timeout(n: NumOrVoid) {
    return this._current.timeout(n);
  }
  slow(n: NumOrVoid) {
    return this._current.slow(n);
  }
  allowRandomization(b: boolean) {
    return this._current.allowRandomization(b);
  }
  forceSerial(b: boolean) {
    return this._current.forceSerial(b);
  }
}

extendWithChain(GroupApi);

export class GroupPlaceholder {
  name: string;
  fullname: string[];
  metadata: GroupMetadata;
  parent: GroupPlaceholder;
  runner: Runner;
  level: number;
  defaultStack: string;
  collection: TestCollection;
  api: GroupApi;

  maxTimeout: number;
  timeoutStack: string | undefined;
  minSlow: number;

  maxRetries: number;
  retryDelayValue: number;

  reruns: number;
  rerunDelayValue: number;

  randomizationAllowed: boolean;
  serialForced: boolean;

  constructor(
    name: string,
    callback: (api: GroupApi) => PromiseLike<unknown> | void,
    metadata: GroupMetadata,
    parent: GroupPlaceholder,
    root?: boolean
  ) {
    this.name = name;
    this.fullname = root ? [] : parent.fullname.concat(this.name);
    this.metadata = metadata;
    this.parent = parent;
    this.runner = parent.runner;
    this.level = parent.level + 1;
    this.defaultStack = getStack(4);
    this.collection = new TestCollection(this.runner);
    this.api = new GroupApi(this);

    this.maxTimeout = parent.maxTimeout || 0;
    this.timeoutStack = parent.timeoutStack;
    this.minSlow = parent.minSlow || 0;

    this.maxRetries = parent.maxRetries || 0;
    this.retryDelayValue = parent.retryDelayValue || 0;
    this.reruns = parent.reruns || 0;
    this.rerunDelayValue = parent.rerunDelayValue || 0;

    this.randomizationAllowed = parent.randomizationAllowed;
    this.serialForced = parent.serialForced;

    if (!root) {
      parent.collection.addTest(this, parent);
    }

    if (typeof callback === "function") {
      const prev = this.runner._current;
      this.runner._current = this;
      const ret = callback(this.api);
      if (isPromise(ret)) {
        this.api.delaySetup(ret);
      }
      this.runner._current = prev;
    }
  }

  retries(n: NumOrVoid) {
    if (n === undefined) {
      return this.maxRetries;
    }
    assertNumber(n);
    this.maxRetries = n;
  }

  retryDelay(n: NumOrVoid) {
    if (n === undefined) {
      return this.retryDelayValue;
    }
    assertDelay(n);
    this.retryDelayValue = n;
  }

  defineReruns(n: NumOrVoid) {
    if (n === undefined) {
      return this.reruns;
    }
    assertNumber(n);
    this.reruns = n;
  }

  rerunDelay(n: NumOrVoid) {
    if (n === undefined) {
      return this.rerunDelayValue;
    }
    assertDelay(n);
    this.rerunDelayValue = n;
  }

  timeout(n: NumOrVoid) {
    if (n === undefined) {
      return this.maxTimeout;
    }
    assertTimeout(n);
    this.maxTimeout = n;
    this.timeoutStack = getStack(3);
  }

  slow(n: NumOrVoid) {
    if (n === undefined) {
      return this.minSlow;
    }
    assertNumber(n);
    this.minSlow = n;
  }

  allowRandomization(b: boolean) {
    if (b === undefined) {
      return this.randomizationAllowed;
    }
    this.randomizationAllowed = b;
  }

  forceSerial(b: boolean) {
    if (b === undefined) {
      return this.serialForced;
    }
    this.serialForced = b;
  }

  build(parent?: Suite): Suite {
    return new Suite(this, parent);
  }
}

export class TestPlaceholder {
  name: string;
  fullname: string[];
  callback: (api: PublicTestApi) => PromiseLike<unknown> | unknown;
  metadata: TestMetadata;
  parent: GroupPlaceholder;
  level: number;
  defaultStack: string;

  constructor(
    name: string,
    callback: (api: PublicTestApi) => PromiseLike<unknown> | unknown,
    metadata: TestMetadata,
    parent: GroupPlaceholder
  ) {
    this.name = name;
    this.fullname = parent.fullname.concat(this.name);
    this.callback = callback;
    this.metadata = metadata;
    this.parent = parent;
    this.level = parent.level;
    this.defaultStack = getStack(4);

    parent.collection.addTest(this, parent);
  }

  build(runnable: Runnable | InTestSequence, parent: Suite): Test {
    return new Test(this, runnable, parent);
  }

  buildRunnable(parent: Suite): Runnable {
    return new Runnable(this, parent);
  }
}

export type Placeholder = TestPlaceholder | GroupPlaceholder;
