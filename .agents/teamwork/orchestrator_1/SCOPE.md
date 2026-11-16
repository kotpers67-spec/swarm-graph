# Scope: Модернизация UI/UX и динамики агентов

## Architecture & Goals
- Модернизация интерфейса визуализации графов работы агентов:
  1. `src/components/TopBar.tsx`: Единая монолитная безрамочная шапка Linear/Raycast (логотип слева, поиск и тумблер «⚡ Только активные» по центру, кнопка «⚙️ Настройки» и аккуратные кнопки окна —, □, ✕ справа).
  2. `src/App.tsx`: Агенты появляются только после старта (`hasStarted`). На узлах световые бейджи «← от @...» и «→ к @...», по связям направленные пульсирующие волны.
  3. `src/components/SettingsModal.tsx`: Выбор тем (Graphite, Obsidian, Blueprint, Midnight), системная/тёмная/светлая, переключение сетки холста, скорость анимаций, выбор папки логов brain.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | UI & Dynamics Implementation | TopBar, App, SettingsModal, themes, badges, animations | none | IN_PROGRESS |
| 2 | Verification & Audit | TypeScript compilation, tests, integrity audit | M1 | PLANNED |

## Code Layout
- `src/components/TopBar.tsx`
- `src/components/SettingsModal.tsx`
- `src/App.tsx`
- `src/types.ts` (или соответствующие файлы типов, если требуются)
- `src/index.css` / `tailwind.config.*` (стили тем и анимаций)
