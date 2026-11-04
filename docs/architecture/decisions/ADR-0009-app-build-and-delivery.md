# ADR-0009: How the phone app is built and delivered

| | |
|---|---|
| **Status** | **Accepted** |
| **Date** | 2026-11-04 |
| **Decision owner / approver** | Coach app owner (Developer 2) — approved 2026-11-04 |
| **Scope** | How FitSphere Coach reaches phones: during development now, and in app stores later |
| **Related decisions** | C-D5, C-D6, C-D22, ADR-0001 |
| **Supersedes** | None |

## Context
- The app runs in **Expo Go** today (a ready-made Expo app on the phone), so no app builds are needed
  (C-D6).
- Lesson from CF01: Expo Go includes only certain native parts; the stripe drawing crashed because
  Expo Go lacked `react-native-svg`.
- Publishing to the Play Store or App Store needs the app built as its own installable app. Expo's
  cloud service, **EAS Build**, does this; the free plan allows a limited number of builds a month
  **per Expo account** (the trainee repo notes 15 Android builds a month).
- The trainee app uses EAS under the Expo account **`fits_phere`**. Sharing that account would share
  its monthly builds with Developer 1.
- **Supabase is not affected by this decision:** both apps keep using the one shared Supabase project
  (C-D2). Expo only builds the phone app.

## Decision criteria
**Pass/fail gates:**
1. Can reach the app stores eventually.
2. Does not affect the trainee app (C-D22), including its build allowance.

**Weighted criteria:** security 20%, maintainability 20%, reliability 15%, performance 15%,
scalability 10%, cost 10%, integration 10%.

## Options considered

| Option | Gate 1 | Gate 2 |
|---|---|---|
| **A. Expo Go now; EAS cloud builds later, under the coach app's own Expo account** | Pass | Pass |
| B. Build on the developer's PC with Android Studio and Xcode | Pass | Pass |
| C. Expo Go only | **Fail**: cannot publish to stores | Pass |
| D. EAS builds under the trainee app's Expo account (`fits_phere`) | Pass | **Fail**: shares Developer 1's build allowance |

| Criterion (weight) | A | B |
|---|---|---|
| Security (20%) | 4 | 4 |
| Maintainability (20%) | 5 — no build tools to keep up | 2 — Android Studio, Xcode (a Mac for iPhone) |
| Reliability (15%) | 4 | 3 |
| Performance (15%) | 4 | 4 |
| Scalability (10%) | 4 | 4 |
| Cost (10%) | 4 — free plan to start | 3 — set-up time; a Mac for iPhone |
| Integration (10%) | 4 | 3 |
| **Weighted score** | **84 / 100** | **65 / 100** |

## Decision
**Option A.**
1. **Now:** develop in **Expo Go**. Before adding any package, check that it works in Expo Go; if it
   does not, stop and tell the owner.
2. **When a package needs it** (for example push notifications): switch to an **EAS development
   build**. Claude tells the owner **before every cloud build**.
3. **A separate, free Expo account and project for FitSphere Coach**, created by the owner on
   expo.dev when the first build is needed. It is never the trainee app's `fits_phere` account, so
   each app keeps its own monthly builds.
4. **App identity** (already set): name **FitSphere Coach**; Android and iOS ID `com.fitsphere.coach`;
   link scheme `fitspherecoach://`.
5. **First version for real users:** a proper EAS build (real users cannot use Expo Go). Publishing
   to the stores is a later step with its own release plan: store listings, privacy policy, testing
   tracks, a Google Play account (one-time fee) and, if iPhone is needed, an Apple Developer account
   (about US$99 a year).

## Why this option wins
- Passes both gates and scores highest; no build tools on the PC; fastest testing on the phone.

## Why the alternatives were rejected
- **B:** heavy tooling (and a Mac for iPhone) for one developer, with no benefit at this stage.
- **C:** cannot publish. **D:** would use up Developer 1's builds.

## Consequences
- **Benefits:** fast development; no effect on Developer 1's builds; a standard path to the stores.
- **Trade-offs:** while in Expo Go, only packages it includes can be used; free-plan cloud builds wait
  in a queue; store reviews take their own time.

## Validation
- Every pull request checks that the app bundles for Android.
- Before the first cloud build: confirm it runs under the coach app's own Expo account.

## Reconsider when
- Build volume outgrows the free plan (a paid Expo plan or local builds).
- A native module is needed early (switch to development builds sooner).
