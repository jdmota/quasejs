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

const SPLASH_ID = "quase_app_splash";

function removeSplash() {
  const splash = document.getElementById(SPLASH_ID);
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
  title: string;
  backgroundColor?: string;
  fontFamily?: string;
  fontSize?: number;
}>;

export function createSplash({
  title,
  backgroundColor,
  fontFamily,
  fontSize,
}: CreateSplashOpts) {
  return {
    html: `<div id="${SPLASH_ID}">${title}</div>`,
    css: `body {
      margin: 0;
    }
    body.loading {
      overflow: hidden;
    }
    body.loading #${SPLASH_ID} {
      opacity: 1;
    }
    #${SPLASH_ID} {
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

export class App {
  async init(jobs: Promise<unknown>[] = []) {
    await Promise.all(jobs);
    await onLoad();
    removeSplash();
  }
}

export const app = new App();
