// Что делать, когда активировалась новая версия service worker: перезагрузить один раз
// или, если пользовательница сейчас что-то вводит, показать плашку «Обновить».

export interface UpdateDeps {
  /** Открыт лист/диалог или поле ввода в фокусе — перезагрузка потеряла бы ввод. */
  isBusy: () => boolean;
  reload: () => void;
  showBanner: () => void;
}

export function createUpdateController(deps: UpdateDeps) {
  let reloaded = false;
  const reloadOnce = () => {
    if (reloaded) return;
    reloaded = true;
    deps.reload();
  };
  return {
    onNewVersionActivated() {
      if (deps.isBusy()) deps.showBanner();
      else reloadOnce();
    },
    applyUpdate: reloadOnce,
  };
}
