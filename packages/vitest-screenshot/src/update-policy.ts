export type ScreenshotUpdateState = 'all' | 'new' | 'none';

type CompatibleSnapshotState = {
  readonly snapshotUpdateState?: unknown;
  /** Vitest 3 compatibility; remove when the peer range no longer includes Vitest 3. */
  readonly _updateSnapshot?: unknown;
};

const isUpdateState = (value: unknown): value is ScreenshotUpdateState =>
  value === 'all' || value === 'new' || value === 'none';

export const resolveScreenshotUpdateState = (
  snapshotState: unknown,
  explicitUpdate: boolean | undefined,
  environmentUpdate: boolean,
  isCi: boolean,
): ScreenshotUpdateState => {
  if (explicitUpdate !== undefined) return explicitUpdate ? 'all' : 'none';
  if (environmentUpdate) return 'all';
  const compatible = snapshotState as CompatibleSnapshotState | undefined;
  const state = compatible?.snapshotUpdateState ?? compatible?._updateSnapshot;
  return isUpdateState(state) ? state : isCi ? 'none' : 'new';
};
