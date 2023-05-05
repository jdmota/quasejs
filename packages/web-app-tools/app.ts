export function onMount(svelteOnMount: (resolve: () => void) => void) {
  return new Promise<void>(svelteOnMount);
}

function onLoad() {
  return new Promise<void>(resolve => {
    if (document.readyState === "complete") {
      resolve();
    } else {
      const fn = () => {
        window.removeEventListener("load", fn);
        resolve();
      };
      window.addEventListener("load", fn);
    }
  });
}

const DEFAULT_SPLASH_ID = "quase_app_splash";

function removeSplash(id: string) {
  const splash = document.getElementById(id);
  if (splash) {
    const callback = () => {
      splash.style.display = "none";
      splash.removeEventListener("transitionend", callback);
    };
    splash.addEventListener("transitionend", callback);
    document.body.classList.remove("loading");
  }
}

export type CreateSplashOpts = Readonly<{
  id?: string;
  title: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
}>;

export function createSplash({
  id: _id,
  title,
  backgroundColor,
  fontFamily,
  fontSize,
}: CreateSplashOpts) {
  const id = _id ?? DEFAULT_SPLASH_ID;
  return {
    html: `<div id="${id}">${title}</div>`,
    css: `body {
      margin: 0;
    }
    body.loading {
      overflow: hidden;
    }
    body.loading #${id} {
      opacity: 1;
    }
    #${id} {
      background-color: ${backgroundColor || "#336fb7"};
      font-family: ${fontFamily || "Roboto, Helvetica, Arial, sans-serif"};
      font-size: ${fontSize || "38px"};
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      transition: opacity 300ms cubic-bezier(0, 0, 0.2, 1);
      opacity: 0;
      will-change: opacity;
      z-index: 2000;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      -moz-user-select: none;
      -webkit-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }`,
  };
}

type AppOptions = Readonly<{
  splashId?: string;
}>;

export class App {
  readonly opts: AppOptions;

  constructor(opts: AppOptions = {}) {
    this.opts = opts;
  }

  async init(jobs: Promise<unknown>[] = []) {
    await Promise.all(jobs);
    await onLoad();
    removeSplash(this.opts.splashId ?? DEFAULT_SPLASH_ID);
  }
}

export const app = new App();
