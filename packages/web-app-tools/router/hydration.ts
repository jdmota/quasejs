import {
  sameSimpleLocationNoHash,
  type SimpleLocationNoHash,
} from "./pathname";

export const DATA_KEY = "quase_router_data";

export type InitialDataForHydration<Data> = Readonly<{
  props: SimpleLocationNoHash;
  data: Data;
}>;

export function createInitialDataForHydration<Data>(
  initial: InitialDataForHydration<Data>
) {
  const json = JSON.stringify(initial);
  return `<script id="${DATA_KEY}" type="application/json">${json}</script>`;
}

export function getInitialDataForHydration<Data>(
  props: SimpleLocationNoHash
): InitialDataForHydration<Data> | null {
  const element = document.getElementById(DATA_KEY);
  if (element) {
    const text = element.textContent;
    element.remove();
    if (text) {
      const initial = JSON.parse(text) as InitialDataForHydration<Data>;
      if (sameSimpleLocationNoHash(initial.props, props)) {
        return initial;
      }
    }
  }
  return null;
}
