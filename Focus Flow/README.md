# FocusFlow — Smart Pomodoro Study Planner

> Study Smart. Focus Deep. Achieve More.

Ek **local-first, offline-ready, PWA-installable** Pomodoro + study task manager. Koi backend nahi, koi account nahi — saara data aapke browser (IndexedDB) mein hota hai.

## ✨ Features
- **Pomodoro timer** (Focus / Short / Long break) — timestamp-based, isliye tab background/refresh par bhi accurate.
- **Tasks** — priorities, due dates, tags, subjects, est. vs actual focus, List + **Kanban** view, search & filters.
- **Subjects** — unlimited, custom color/icon, daily target, stats & history.
- **Dashboard** — aaj ka time, sessions, tasks, streak, weekly chart, upcoming tasks, daily-goal ring.
- **Daily Planner** — calendar view, quick-add, overdue highlight, next-3-days.
- **History** — auto-recorded completed sessions, filters, detail view, delete.
- **Analytics** — real-data charts (daily, 30-day trend, subject donut, est vs actual), streaks, best day.
- **Goals & Streaks** — editable, history kabhi rewrite nahi hoti.
- **Sound & Notifications** — Web Audio (koi audio file nahi), browser notifications (permission ke saath), optional ambience, reminder.
- **Data** — JSON backup, History/Tasks CSV export, Import (merge/replace), Clear all.
- **PWA** — installable Chrome app, offline app-shell caching.
- **Themes** — Light / Dark / Auto, keyboard shortcuts, Focus Mode, reduced-motion support.

## 🚀 Run locally (development)
Koi build step nahi — plain static files. Koi bhi static server chalega:

```bash
# Option A — Python
python -m http.server 8000

# Option B — Node
npx serve .
# ya
npm install -g http-server && http-server -p 8000