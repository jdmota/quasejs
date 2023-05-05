import { type ScrollEvents, ScrollMixin } from "./router.scroll";
import { type PreloadEvents, PreloadMixin } from "./router.preload";
import { type RouterEvents, Router } from "./router";

export const router = new Router<RouterEvents & ScrollEvents & PreloadEvents>(
  router => [
    new ScrollMixin(router, { getKey: loc => loc.index + "" }),
    new PreloadMixin(router, { preload: false }),
  ]
);
