export function considerAnchor(anchor: HTMLAnchorElement): boolean {
  // Adapted from https://github.com/Polymer/pwa-helpers/blob/master/src/router.ts
  if (
    anchor.target ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("rel") === "external"
  )
    return false;

  const { href } = anchor;
  if (!href || href.indexOf("mailto:") !== -1) return false;

  const location = window.location;
  const origin = location.origin || location.protocol + "//" + location.host;
  if (href.indexOf(origin) !== 0) return false;

  return true;
}

export function findAnchor(event: Event) {
  // Adapted from https://github.com/Polymer/pwa-helpers/blob/master/src/router.ts
  const anchor = event
    .composedPath()
    .filter(n => (n as HTMLElement).nodeName === "A")[0] as
    | HTMLAnchorElement
    | undefined;

  return anchor && considerAnchor(anchor) ? anchor : null;
}
