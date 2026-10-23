import { useRef, useState } from 'react';
import { applyBackup, exportBackup, parseBackup, type ParsedBackup } from '../../storage/backup';
import { BottomSheet } from './BottomSheet';

/** «1 запись», «2 записи», «5 записей». */
export function pluralRu(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few : many;
  return `${n} ${word}`;
}

async function shareOrDownload(file: File) {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Экспорт и импорт резервной копии (FR-029, FR-030). */
export function BackupSection() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const res = parseBackup(await file.text());
    if (input.current) input.current.value = '';
    if (!res.ok) setMessage({ text: res.error, error: true });
    else {
      setMessage(null);
      setPending(res.value);
    }
  };

  const confirm = async () => {
    if (!pending) return;
    await applyBackup(pending);
    setPending(null);
    setMessage({ text: 'Данные восстановлены', error: false });
  };

  return (
    <section className="card settings-card" aria-labelledby="backup-title">
      <h2 id="backup-title" className="t-card-title settings-card__title">
        Резервная копия
      </h2>
      <p className="t-caption settings-card__text">
        Данные хранятся только на этом телефоне. Сохраняйте копию в «Файлы», чтобы не потерять их при смене телефона.
      </p>
      <button type="button" className="btn btn--primary" onClick={async () => shareOrDownload(await exportBackup())}>
        Экспорт
      </button>
      <button type="button" className="btn" onClick={() => input.current?.click()}>
        Импорт
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {message && (
        <p className={message.error ? 'sheet__error' : 'settings-card__ok'} role={message.error ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <BottomSheet open={pending !== null} onClose={() => setPending(null)} title="Восстановить данные?">
        {pending && (
          <p className="t-body sheet__note">
            Будет восстановлено: {pending.summary.periods} месячных,{' '}
            {pluralRu(pending.summary.days, ['запись дня', 'записи дней', 'записей дней'])}. Текущие данные будут
            заменены.
          </p>
        )}
        <button type="button" className="btn btn--primary" onClick={confirm}>
          Восстановить
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setPending(null)}>
          Отмена
        </button>
      </BottomSheet>
    </section>
  );
}
