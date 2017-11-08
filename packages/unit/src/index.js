import GlobalEnv from "./global-env";
import Runner from "./runner";
import AssertionError from "./assertion-error";
import Node from "./reporters/node";
import _skipReasons from "./skip-reasons";

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
