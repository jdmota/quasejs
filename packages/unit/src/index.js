import GlobalEnv from "./core/global-env";
import Runner from "./core/runner";
import AssertionError from "./core/assertion-error";
import _skipReasons from "./core/skip-reasons";
import Node from "./reporters/node";

export const skipReasons = Object.assign( {}, _skipReasons );
export const reporters = {
  Node
};

export {
  Runner,
  AssertionError,
  GlobalEnv
};

export default function( opts, files ) {
  // TODO
  const runner = Runner.init().setup();
  return runner;
}
