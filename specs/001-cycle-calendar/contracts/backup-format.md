# Contract: Backup File Format

Файл `cycle-calendar-YYYY-MM-DD.json`, UTF-8. Создаётся экспортом, читается импортом (FR-029, FR-030).

```json
{
  "format": "cycle-calendar-backup",
  "schemaVersion": 6,
  "exportedAt": "2026-10-23T10:15:00.000Z",
  "data": {
    "periods": [{ "id": "6f1c…", "start": "2026-09-28", "end": "2026-10-02", "endEstimated": false }],
    "days": [{
      "date": "2026-10-01", "symptoms": ["cramps"], "intensity": { "cramps": "moderate" },
      "moods": ["calm", "anxious"], "sex": false, "note": ""
    }],
    "settings": {
      "defaultCycleLength": 28,
      "defaultPeriodLength": 5,
      "remindPeriod": true,
      "remindOvulation": true,
      "showWellbeing": false,
      "showNotes": false,
      "ovulationShiftEnabled": false,
      "ovulationShift": 0,
      "ovulationFromNextPeriod": false,
      "remindMissedPeriod": true,
      "showMood": false,
      "showIntensity": false,
      "showSex": false
    }
  }
}
```

`schemaVersion: 2` (фича 004) добавляет `showWellbeing` и `showNotes` (boolean, обязательны в v2).
Копии `schemaVersion: 1` импортируются через `migrations[1]` — оба переключателя получают `false`.

`schemaVersion: 3` (фича 005) добавляет `ovulationShiftEnabled` (boolean) и `ovulationShift` (целое
−5…+5), оба обязательны в v3; иначе — ошибка «некорректный личный сдвиг овуляции». Копии v1 и v2
проходят `migrations[2]` — сдвиг выключен, значение 0.

`schemaVersion: 4` (фича 006) добавляет `ovulationFromNextPeriod` (boolean, обязателен в v4; иначе —
ошибка «некорректный способ расчёта овуляции»). Копии v1–v3 проходят `migrations[3]` — `false`.

`schemaVersion: 5` (фича 007) добавляет `remindMissedPeriod` (boolean, обязателен в v5; иначе — ошибка
«некорректные настройки напоминаний»). Копии v1–v4 проходят `migrations[4]` — `true`.

`schemaVersion: 6` (фича 009) — запись дня: `moods` (массив кодов) вместо `mood`, `intensity`, `sex`
([009 contracts/day-entry.md](../../009-day-marks/contracts/day-entry.md)); настройки `showMood`,
`showIntensity`, `showSex`. Копии v1–v5 проходят `migrations[5]`: `showMood` = `showWellbeing`, остальные
`false`; записи дней переводятся (`great` → `joyful`, неизвестное — пусто).

С фичи 009 сообщения об ошибках отдельных настроек (выше) больше не показываются: некорректная
настройка заменяется значением устройства (правило 4б).

## Правила импорта

1. `format` должен быть `"cycle-calendar-backup"`, иначе — ошибка «Это не резервная копия
   Календаря цикла».
2. `schemaVersion` > текущей версии приложения — ошибка «Резервная копия создана более новой
   версией приложения. Обновите приложение».
3. `schemaVersion` < текущей — данные проходят те же миграции, что и IndexedDB.
4. Месячные валидируются строго по правилам [data-model.md](../data-model.md); при ошибке в месячных
   импорт отменяется целиком, текущие данные не меняются (009: история циклов — главное).
   4а. Записи дней (009) разбираются мягко — `coerceDayEntry`: непонятные части пустые, запись без
   корректной даты пропускается, при повторе даты берётся первая; нет списка — записей нет.
   4б. Настройки (009) проверяются по полям; некорректное или отсутствующее поле — текущее значение
   устройства; нет объекта настроек — настройки устройства целиком.
   4в. Любая непредвиденная ошибка разбора — «Файл резервной копии повреждён: …», данные не меняются. Пересекающиеся и соседние месячные объединяются
   (фича 003, ревизия 2; для оценки незакрытых — `defaultPeriodLength` из файла); пересечения, которые
   нельзя объединить (итог длиннее 15 дней), — ошибка «месячные пересекаются». В `schemaVersion: 1` поле `endEstimated` у каждой
   записи `periods` обязательно (boolean); запись без него — ошибка. Будущие версии, если поле
   изменится, задают правило в своей миграции.
5. Перед заменой показывается подтверждение: «Будет восстановлено: N месячных, M записей дней.
   Текущие данные будут заменены».
6. Замена выполняется в одной транзакции; после неё пересчитывается прогноз и расписание напоминаний.
7. `PushState` в файл не входит и при импорте не меняется.
8. Повторный импорт того же файла даёт идентичное состояние.
