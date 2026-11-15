import { useRef, useState } from 'react';
import { formatDateNumeric, toLocalDate } from '../../domain/dates';
import { importFileKind } from '../../domain/importFile';
import { pluralRu } from '../../domain/plural';
import { applyBackup, parseBackup, type ParsedBackup } from '../../storage/backup';
import { getSettings } from '../../storage/repository';
import { applyTextImport, planTextImport, type TextImportPlan } from '../../storage/textImport';
import { BottomSheet } from './BottomSheet';
import { EXPORT_FAILED_TEXT, exportData } from './share';

const PERIOD_WORDS: [string, string, string] = ['период', 'периода', 'периодов'];

/** Экспорт и импорт резервной копии (FR-029, FR-030) и импорт месячных из текстового файла (008). */
export function BackupSection() {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [textPlan, setTextPlan] = useState<TextImportPlan | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  // Любая ошибка чтения или разбора файла показывается сообщением, данные не меняются (009 FR-006).
  const onFile = async (file: File | undefined) => {
    try {
      await readFile(file);
    } catch (e) {
      console.error('import failed', e);
      setMessage({ text: 'Не удалось прочитать файл', error: true });
    }
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    if (input.current) input.current.value = '';
    const text = await file.text();
    const kind = importFileKind(text);
    if (kind === 'cycle-text') {
      const plan = await planTextImport(text, toLocalDate(new Date()));
      if (!plan.ok) setMessage({ text: plan.error, error: true });
      else {
        setMessage(null);
        setTextPlan(plan.value);
      }
      return;
    }
    if (kind === 'unknown') {
      setMessage({ text: 'Файл не распознан', error: true });
      return;
    }
    // Испорченные настройки в файле заменяются текущими настройками устройства (009 FR-005).
    const res = parseBackup(text, await getSettings());
    if (!res.ok) setMessage({ text: res.error, error: true });
    else {
      setMessage(null);
      setPending(res.value);
    }
  };

  // Замена — одна транзакция: при ошибке данные устройства остаются прежними (009 FR-006).
  const NOT_APPLIED = 'Не удалось сохранить данные — текущие данные не изменены';

  const confirm = async () => {
    if (!pending) return;
    try {
      await applyBackup(pending);
    } catch (e) {
      console.error('applyBackup failed', e);
      setPending(null);
      setMessage({ text: NOT_APPLIED, error: true });
      return;
    }
    setPending(null);
    setMessage({ text: 'Данные восстановлены', error: false });
  };

  // Тот же экспорт, что на аварийном экране (014); неудача — сообщение, прочие сообщения не трогаются.
  const exportCopy = async () => {
    const ok = await exportData();
    setMessage((m) => (ok ? (m?.text === EXPORT_FAILED_TEXT ? null : m) : { text: EXPORT_FAILED_TEXT, error: true }));
  };

  const confirmText = async () => {
    if (!textPlan) return;
    try {
      await applyTextImport(textPlan);
    } catch (e) {
      console.error('applyTextImport failed', e);
      setTextPlan(null);
      setMessage({ text: NOT_APPLIED, error: true });
      return;
    }
    const changed = textPlan.added;
    setTextPlan(null);
    setMessage({
      text: changed > 0 ? `Добавлено: ${pluralRu(changed, PERIOD_WORDS)} месячных` : 'Все месячные из файла уже были отмечены',
      error: false,
    });
  };

  return (
    <section className="card settings-card" aria-labelledby="backup-title">
      <h2 id="backup-title" className="t-card-title settings-card__title">
        Резервная копия
      </h2>
      <p className="t-caption settings-card__text">
        Данные хранятся только на этом телефоне. Сохраняйте копию в «Файлы», чтобы не потерять их при смене телефона.
      </p>
      <button type="button" className="btn btn--primary" onClick={() => void exportCopy()}>
        Экспорт
      </button>
      <button type="button" className="btn" onClick={() => input.current?.click()}>
        Импорт
      </button>
      <input
        ref={input}
        type="file"
        accept="application/json,.json,text/plain,.txt"
        hidden
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {message && (
        <p className={message.error ? 'notice notice--error' : 'notice notice--ok'} role={message.error ? 'alert' : 'status'}>
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
      <BottomSheet open={textPlan !== null} onClose={() => setTextPlan(null)} title="Добавить месячные?">
        {textPlan && (
          <>
            <p className="t-body sheet__note">
              Найдено: {pluralRu(textPlan.found, PERIOD_WORDS)} месячных ({formatDateNumeric(textPlan.first)} –{' '}
              {formatDateNumeric(textPlan.last)}). Добавить в календарь?
            </p>
            {textPlan.replaced > 0 && (
              <p className="t-body sheet__note">
                Будут заменены уже отмеченные месячные: {pluralRu(textPlan.replaced, PERIOD_WORDS)}.
              </p>
            )}
            {textPlan.skipped > 0 && (
              <p className="t-caption sheet__note">
                Пропущено из-за ошибок в файле: {pluralRu(textPlan.skipped, PERIOD_WORDS)}.
              </p>
            )}
            <p className="t-caption sheet__note">Заметки, самочувствие и настройки не изменятся.</p>
          </>
        )}
        <button type="button" className="btn btn--primary" onClick={confirmText}>
          Добавить
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setTextPlan(null)}>
          Отмена
        </button>
      </BottomSheet>
    </section>
  );
}
