import { describe, expect, it, vi } from 'vitest';
import { createUpdateController } from './updateController';

function setup(busy = false) {
  const deps = { isBusy: vi.fn(() => busy), reload: vi.fn(), showBanner: vi.fn() };
  return { deps, ctl: createUpdateController(deps) };
}

describe('update controller', () => {
  it('reloads once when a new version is activated and the user is idle', () => {
    const { deps, ctl } = setup(false);
    ctl.onNewVersionActivated();
    ctl.onNewVersionActivated();
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(deps.showBanner).not.toHaveBeenCalled();
  });

  it('shows the banner instead of reloading while the user is busy', () => {
    const { deps, ctl } = setup(true);
    ctl.onNewVersionActivated();
    expect(deps.reload).not.toHaveBeenCalled();
    expect(deps.showBanner).toHaveBeenCalledTimes(1);
  });

  it('reloads when the user taps «Обновить»', () => {
    const { deps, ctl } = setup(true);
    ctl.onNewVersionActivated();
    ctl.applyUpdate();
    expect(deps.reload).toHaveBeenCalledTimes(1);
    ctl.applyUpdate();
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });
});
