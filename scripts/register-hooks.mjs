// https://nodejs.org/docs/latest-v21.x/api/module.html#customization-hooks
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
