import { noop } from "../util/miscellaneous";
import { localStorage } from "./support";
import { Subscribable } from "./subscribable";

const DEFAULT_KEY = "theme-mode";

export type ThemeMode = "light" | "dark";

export type ThemeModeOrDefault = ThemeMode | "default";

export type ThemeModeDetails = Readonly<{
  saved: ThemeModeOrDefault;
  prefersDark: boolean;
  mode: ThemeMode;
}>;

function validate(value: string | null | undefined): ThemeModeOrDefault {
  return value === "light" || value === "dark" ? value : "default";
}

function convert(theme: ThemeModeOrDefault, prefersDark: boolean): ThemeMode {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return prefersDark ? "dark" : "light";
}

export class ThemeSelector extends Subscribable<ThemeModeDetails> {
  private readonly storageKey: string;
  private savedValue: ThemeModeOrDefault;
  private prefersDark: boolean;
  private unsubPrefer: () => void;
  private unsubStorage: () => void;

  constructor(storageKey: string = DEFAULT_KEY) {
    super();
    this.storageKey = storageKey;
    this.savedValue = "default";
    this.prefersDark = false;
    this.unsubPrefer = noop;
    this.unsubStorage = noop;
  }

  get(): ThemeModeDetails {
    return {
      saved: this.savedValue,
      prefersDark: this.prefersDark,
      mode: convert(this.savedValue, this.prefersDark),
    };
  }

  set(value: ThemeModeOrDefault) {
    this.internalSet(value);
  }

  private internalSet(value: string | null | undefined) {
    const old = this.savedValue;
    this.savedValue = validate(value);
    if (this.savedValue !== old) {
      localStorage?.setItem(this.storageKey, this.savedValue);
      this.fire();
    }
  }

  private fire() {
    this.emit(this.get());
  }

  init() {
    const prefersDarkQuery =
      typeof matchMedia === "function"
        ? matchMedia("(prefers-color-scheme: dark)")
        : null;

    this.prefersDark = prefersDarkQuery?.matches ?? false;

    if (prefersDarkQuery) {
      const onPreferChange = ({ matches }: MediaQueryListEvent) => {
        this.prefersDark = matches;
        this.fire();
      };
      prefersDarkQuery.addEventListener("change", onPreferChange);
      this.unsubPrefer = () => {
        prefersDarkQuery.removeEventListener("change", onPreferChange);
      };
    }

    const onStorageEvent = (evt: StorageEvent) => {
      if (evt.key === this.storageKey && evt.storageArea === localStorage) {
        this.internalSet(evt.newValue);
      }
    };
    window.addEventListener("storage", onStorageEvent);
    this.unsubStorage = () => {
      window.removeEventListener("storage", onStorageEvent);
    };

    this.internalSet(localStorage?.getItem(this.storageKey));
  }

  override close() {
    super.close();
    this.unsubPrefer();
    this.unsubStorage();
  }
}
