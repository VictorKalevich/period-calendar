import { looksLikeCycleText } from './cycleText';

/** Вид импортируемого файла: резервная копия, текстовая выгрузка месячных (008) или не распознан. */
export type ImportFileKind = 'backup' | 'cycle-text' | 'unknown';

/**
 * Вид файла по его тексту. JSON (после начальных пробельных символов — «{») — резервная копия, даже если в нём
 * встречается ключ выгрузки; иначе — текстовая выгрузка, если похоже на неё (008); иначе — «Файл не распознан»
 * (009 FR-006).
 */
export function importFileKind(text: string): ImportFileKind {
  if (text.trimStart().startsWith('{')) return 'backup';
  return looksLikeCycleText(text) ? 'cycle-text' : 'unknown';
}
