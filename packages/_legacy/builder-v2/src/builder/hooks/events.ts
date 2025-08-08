import { AssetRequest, ImmutableAssets } from "../../types";
import { SyncSeriesHook, AsyncSeriesHook } from "./builder-hooks";

export class Setup extends AsyncSeriesHook<void> {}

export class Teardown extends AsyncSeriesHook<void> {}

export class StartedCompilation extends AsyncSeriesHook<void> {}

export class EndedCompilation extends AsyncSeriesHook<void> {}

export class StartedAssetProcessing extends AsyncSeriesHook<void> {}

export class EndedAssetProcessing extends AsyncSeriesHook<void> {}

export class AssetDeletedHook extends SyncSeriesHook<AssetRequest> {}

export class AssetDoneHook extends SyncSeriesHook<ImmutableAssets> {}
