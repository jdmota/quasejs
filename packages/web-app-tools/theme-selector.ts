import { localStorage } from "./support";
import { AbstractDatabase } from "./database";
import { Subscribable } from "./subscribable";
import { noop } from "../util/miscellaneous";

const DEFAULT_KEY = "theme-mode";

export type ThemeMode = "light" | "dark";

export type ThemeModeOrDefault = ThemeMode | "default";

export type ThemeModeDetails = Readonly<{
  saved: ThemeModeOrDefault;
  prefersDark: boolean;
  mode: ThemeMode;
}>;

type BroadcastMsg = Readonly<{
  value: ThemeModeOrDefault;
}>;

class ThemeModeSaved extends AbstractDatabase<BroadcastMsg> {
  private key: string;
  private value: ThemeModeOrDefault;

  constructor(key: string) {
    super(key);
    this.key = key;
    this.value = "default";
  }

  private validate(value: string | null): ThemeModeOrDefault {
    return value === "light" || value === "dark" ? value : "default";
  }

  private getFromStorage() {
    return this.validate(localStorage?.getItem(this.key) ?? this.value);
  }

  async reload() {
    this.dataChange({ value: this.getFromStorage() }, false);
  }

  protected override dataChange(data: BroadcastMsg, broadcast: boolean): void {
    this.value = data.value;
    super.dataChange(data, broadcast);
  }

  getCached() {
    return this.value;
  }

  get() {
    this.value = this.getFromStorage();
    return this.value;
  }

  set(value: ThemeModeOrDefault) {
    localStorage?.setItem(this.key, value);
    this.dataChange({ value }, true);
  }
}

function convert(
  theme: ThemeModeOrDefault | undefined,
  prefersDark: boolean
): ThemeMode {
  if (theme === "light" || theme === "dark") {
    return theme;
  }
  return prefersDark ? "dark" : "light";
}

export class ThemeSelector extends Subscribable<ThemeModeDetails> {
  private readonly db: ThemeModeSaved;
  private prefersDark: boolean;
  private unsubPrefer: () => void;
  private unsubDB: () => void;

  constructor(key: string = DEFAULT_KEY) {
    super();
    this.db = new ThemeModeSaved(key);
    this.prefersDark = false;
    this.unsubPrefer = noop;
    this.unsubDB = noop;
  }

  get(): ThemeModeDetails {
    const saved = this.db.getCached();
    return {
      saved,
      prefersDark: this.prefersDark,
      mode: convert(saved, this.prefersDark),
    };
  }

  set(value: ThemeModeOrDefault) {
    this.db.set(value);
  }

  private fire() {
    this.emit(this.get());
  }

  async init() {
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

    this.unsubDB = this.db.subscribe(event => this.fire());

    await this.db.reload();
  }

  override close() {
    super.close();
    this.db.close();
    this.unsubPrefer();
    this.unsubDB();
  }
}
