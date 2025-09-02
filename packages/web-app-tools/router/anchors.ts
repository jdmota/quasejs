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
  let node: HTMLElement | null = event.target as HTMLElement;
  while (node && node.nodeName !== "A") {
    node = node.parentNode as HTMLElement | null;
  }
  const anchor = node as HTMLAnchorElement | null;
  return anchor && considerAnchor(anchor) ? anchor : null;
}
