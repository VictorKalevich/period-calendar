// Поделиться файлом через системное меню или сохранить его на устройство (резервная копия, отчёт 011).

/** Умеет ли устройство делиться этим файлом (Web Share с файлами). */
export const canShareFile = (file: File) => navigator.canShare?.({ files: [file] }) === true;

/** Системное меню «Поделиться»; `false` — не удалось (кроме отмены пользователем). */
export async function shareFile(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file], title: file.name });
    return true;
  } catch (e) {
    return (e as DOMException).name === 'AbortError';
  }
}

/** Скачивание файла (на iPhone — просмотр с «Сохранить в Файлы»). */
export function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Поделиться, если можно, иначе скачать. */
export async function shareOrDownload(file: File) {
  if (canShareFile(file) && (await shareFile(file))) return;
  downloadFile(file);
}
