# Slide fonts

The slide templates use licensed fonts that are **not committed to git**:

| File | Used for |
| --- | --- |
| `Crystal-Regular.otf` | Session titles, speaker job titles |
| `Crystal-Medium.otf` | Speaker company |
| `Crystal-SemiBold.otf` | Speaker names |
| `Emilio-RegularItalic.otf` | Holding slide headline |

Copy them here from `~/Library/Fonts` before running or deploying. Space Mono
(tags, SHRM code) and Inter (app UI) come from npm (`@fontsource`).

Confirm the Crystal/Emilio licenses permit web embedding before deploying — the
deployed app serves these files publicly.
