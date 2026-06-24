# Voice Notes — Feature Documentation

> Personal voice journaling + interview capture for the Rehearsal app.
> Record → transcribe (STT) → AI summary + takeaways → browse, edit, play back.

This document is the engineering reference for the **Voice Notes** feature: what it
does, how it is wired end-to-end, the data model, the API contract, the recording
pipeline, state management, and the known gaps. It is written so a new contributor can
understand the whole feature without reading every file first.

---

## Table of contents

1. [What it is](#1-what-it-is)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [File map](#3-file-map)
4. [Data model](#4-data-model)
5. [The four "kinds"](#5-the-four-kinds)
6. [End-to-end flows](#6-end-to-end-flows)
7. [Recording pipeline](#7-recording-pipeline)
8. [Backend API contract](#8-backend-api-contract)
9. [State management (appStore)](#9-state-management-appstore)
10. [Local / offline notes](#10-local--offline-notes)
11. [Screens & navigation](#11-screens--navigation)
12. [Component reference](#12-component-reference)
13. [Configuration & environment](#13-configuration--environment)
14. [Dependencies](#14-dependencies)
15. [Edge cases & safeguards](#15-edge-cases--safeguards)
16. [Known gaps / future work](#16-known-gaps--future-work)

---

## 1. What it is

Voice Notes lets a user capture audio with **one tap**, have it automatically transcribed
and summarised by AI, and then browse / edit / replay the result. It is positioned as the
"capture your thinking in between" layer that sits alongside Rehearsal's AI mock interviews
and microlearning briefs.

Per the product narrative (`voice-notes-demo-script.txt`), the feature ships in **three
flavours**:

1. **Personal voice notes** — talk into the app anywhere (CAT-prep reflections, "why MBA"
   pitch, study-group debriefs). The app summarises the whole thing and extracts clean
   takeaways automatically.
2. **AI interview practice** — every mock case / HR round / market-sizing question done
   with the AI agent is saved here so the user can revisit how they reasoned days later.
3. **Real interviews & GDs** — hit record before walking into the room (phone face-down in
   a bag), hit stop on the way out. The headline capability is **group-discussion
   diarization** — the backend separates every speaker so the user learns exactly when
   *they* spoke and how their points landed.

> Note: As of this branch the feature is **pre-launch** ("sneak peek" in the demo). The
> recording → upload → STT → summary pipeline is wired; per-speaker transcript and
> diarized detail tabs are spec'd but not yet surfaced in the detail UI (see
> [§16 Known gaps](#16-known-gaps--future-work)).

---

## 2. Architecture at a glance

```
                         ┌──────────────────────────────────────────┐
                         │             appStore (Zustand)            │
                         │  voiceNoteRecordingState  ('idle' →       │
                         │   'recording' → 'classifying' →           │
                         │   'uploading' → 'idle')                   │
                         │  voiceNotePending   (list skeleton meta)  │
                         │  voiceNoteListRefreshTick (refetch nudge) │
                         │  voiceNoteDraftIds  (failed STT notes)    │
                         └──────────────────────────────────────────┘
                              ▲              ▲                ▲
            drives FAB/drawer │              │ bumps refresh  │ reads state
                              │              │                │
   ┌──────────────┐    ┌──────┴───────┐  ┌───┴────────────────┴────┐
   │  HomeMicFab  │───▶│RecordingDrawer│  │   VoiceNotesListScreen  │
   │ (owns the    │    │ (timer +      │  │  rings card · filters · │
   │  recorder &  │    │  waveform +   │  │  list · skeleton · play │
   │  upload)     │    │  4 type pills)│  └─────────────┬───────────┘
   └──────┬───────┘    └───────────────┘                │ navigate(noteId)
          │                                              ▼
          │ start()/stop()                  ┌─────────────────────────┐
          ▼                                 │  VoiceNoteDetailScreen  │
   ┌──────────────────┐                     │  title · summary ·      │
   │ VoiceNoteRecorder│  (expo-av)          │  takeaways · edit ·     │
   │  mono 64k M4A    │                     │  delete · retry         │
   │  16kHz, 10-min   │                     └─────────────────────────┘
   └──────┬───────────┘
          │ file URI + duration
          ▼
   ┌──────────────────┐   POST multipart    ┌───────────────────────────────┐
   │   voiceNoteApi   │────────────────────▶│  Interview Backend (prod)     │
   │  create/list/get │   Bearer JWT        │  /api/voice-note/*            │
   │  patch/del/retry │◀────────────────────│  STT (Grok) → summary (Claude)│
   └──────────────────┘   VoiceNote JSON    └───────────────────────────────┘
          │  (on auth/network failure, falls back to…)
          ▼
   ┌──────────────────────────────┐
   │ localVoiceNotes (Zustand)    │  in-memory only, ids prefixed `local:`
   │  seed data + offline drafts  │
   └──────────────────────────────┘
```

**Key idea:** `HomeMicFab` owns the recording lifecycle and exposes **module-level
functions** (`startVoiceNoteRecording`, `stopVoiceNoteRecording`, `saveVoiceNoteWithType`,
`discardVoiceNoteRecording`) so other surfaces (the drawer, an overlay, other screens) can
drive the same recorder + upload pipeline without holding a ref to it.

---

## 3. File map

```
src/lib/voiceNote/
├─ VoiceNoteRecorder.ts      # expo-av wrapper: mono 64k M4A, 16kHz, 10-min hard cap, auto-stop
├─ voiceNoteApi.ts           # REST client + all TypeScript types for the feature
└─ localVoiceNotes.ts        # Zustand store: 17 seed notes + offline draft creation

src/store/
└─ appStore.ts               # global recording state machine + pending/refresh ticks (Zustand + persist)

src/config/
└─ api.ts                    # backend URL resolution (VOICE_NOTE_API_URL → production)

src/screens/
├─ PermissionsOnboardingScreen.tsx   # mic / notification permission gating (Android-forward)
└─ voiceNote/
   ├─ VoiceNotesListScreen.tsx       # main browse surface (rings card, filters, list, playback)
   └─ VoiceNoteDetailScreen.tsx      # read + inline-edit a single note

src/components/voiceNote/
├─ HomeMicFab.tsx            # the mic FAB; owns recorder + upload; module-level handles
├─ PersistentRecordBar.tsx   # bottom "Ask anything…" pill + FAB host
├─ RecordingDrawer.tsx       # canonical recording surface: timer + waveform + 4 type pills
├─ RecordingOverlay.tsx      # full-screen "hero" recording surface (timer + "Finish Recording")
├─ RecordingBackdrop.tsx     # pastel Spectrum wash behind the recording UI
├─ RecordingVisualiser.tsx   # per-bar randomised waveform (overlay)
├─ BarVisualizer.tsx         # state-driven waveform (drawer)
├─ OrbVisualizer.tsx         # rotating rainbow orb (expanded drawer)
├─ VoiceNoteCard.tsx         # list row: title/summary/meta, swipe-to-play/delete, inline player
├─ VoiceNoteSkeletonCard.tsx # optimistic "Adding your …" placeholder while a note saves
├─ EditNoteSheet.tsx         # bottom-sheet editor (title/summary/takeaways)
├─ DayDetailSheet.tsx        # notes recorded on a tapped calendar day
├─ RingsHomeCard.tsx         # compact Apple-Watch-style daily rings + week strip
├─ RingsDetailSheet.tsx      # expanded rings + streak + full month calendar
├─ NestedRings.tsx           # 3 concentric SVG progress rings
├─ WeekStripCalendar.tsx     # 7-day strip
├─ MonthCalendarSheet.tsx    # full month grid
├─ RainbowDivider.tsx        # hairline list separator (gradient retired)
└─ RecordingChip.tsx         # legacy "Processing…" pill — now a mounted no-op

src/navigation/
└─ AppNavigator.tsx          # registers VoiceNotesList (tab) + VoiceNoteDetail (stack)
```

---

## 4. Data model

The canonical type is `VoiceNote` (`src/lib/voiceNote/voiceNoteApi.ts`). It is the shape
returned by every read endpoint. Server-only columns (`audio_storage_path`,
`transcript_storage_path`, `stt_provider`, `summary_model`, `user_id`, `deleted_at`) are
**never** sent to the client and are not modelled.

```ts
export interface VoiceNote {
  id: string;                       // remote id, or `local:<ts>-<n>` for offline notes
  title: string;                    // user-facing, inline-editable
  executive_summary: string;        // AI-generated 2–3 sentences, editable
  key_takeaways: string[];          // 3–4 bullets, editable

  status: VoiceNoteStatus;          // 'processing' | 'complete' | 'draft' | 'failed'
  failure_reason: string | null;    // human-readable when status === 'failed'

  audio_duration_seconds: number | null;

  is_edited: boolean;               // server flips true on any PATCH
  edited_at: string | null;         // ISO datetime
  created_at: string;               // ISO datetime
  updated_at: string;               // ISO datetime

  // ── Local-only meta (undefined for remote notes) ──
  category?: VoiceNoteCategory;     // 'voice_note' | 'ai_interview' | 'real_interview'
  tag?: VoiceNoteTag;               // 'GD' | 'Interview'
  kind?: VoiceNoteKind;             // 'summary' | 'key_insights' | 'meeting' | 'interviews'
  people_detected?: number;         // speaker count (diarization)
  audioUri?: string;                // local file URI so offline notes are playable
}
```

Supporting types:

```ts
export type VoiceNoteStatus   = 'processing' | 'complete' | 'draft' | 'failed';
export type VoiceNoteCategory = 'voice_note' | 'ai_interview' | 'real_interview';
export type VoiceNoteTag      = 'GD' | 'Interview';
export type VoiceNoteKind     = 'summary' | 'key_insights' | 'meeting' | 'interviews';

export interface VoiceNotePatchRequest {   // PATCH payload — at least one field required
  title?: string;
  executive_summary?: string;
  key_takeaways?: string[];
}
```

### Status lifecycle

| Status       | Meaning                                                              |
|--------------|---------------------------------------------------------------------|
| `processing` | Upload / STT in progress on the backend.                            |
| `complete`   | STT + summary finished successfully.                                |
| `draft`      | Created but not transcribed — typically a **local/offline** note, or a backend note whose STT/summary failed. Retryable. |
| `failed`     | Backend processing failed; `failure_reason` is populated. Retryable. |

---

## 5. The four "kinds"

`VoiceNoteKind` is the **user-facing taxonomy** that drives two things:

- the **4 type pills** shown in the recording drawer after the user stops, and
- the **4 filter tabs** on the list screen.

| Pill / tab    | `kind`         | Maps to (category / tag)                              |
|---------------|----------------|------------------------------------------------------|
| **Summary**   | `summary`      | `voice_note` (default; auto-selected after 5 s)      |
| **Insights**  | `key_insights` | `voice_note`                                         |
| **Meeting**   | `meeting`      | `voice_note` (multi-speaker)                         |
| **Interviews**| `interviews`   | `ai_interview` / `real_interview` (`tag: Interview`) |

Because remote notes don't carry `kind`, the list resolves it with a helper so older /
server notes still bucket sensibly:

```ts
export function voiceNoteKind(n: VoiceNote): VoiceNoteKind {
  if (n.kind) return n.kind;                       // explicit wins
  if (n.tag === 'GD') return 'meeting';
  if (n.category === 'ai_interview' ||
      n.category === 'real_interview') return 'interviews';
  return 'summary';                                // fallback
}
```

> **History:** an earlier iteration (commits `788599c`, `e60d1ce`) shipped a richer
> "four-output" backend (`summary` / `insights` / `meeting` / `interview` output types,
> each with structured results, diarized `transcript_segments`, and a poll-for-generation
> endpoint). That was simplified in `af363a4` / `0374790` down to the single
> `executive_summary` + `key_takeaways` shape above, while keeping the four-**kind** UI
> taxonomy. The structured output types may return when the detail tabs are wired.

---

## 6. End-to-end flows

### 6.1 Permission flow

- Gated once per user-on-device via `PermissionsOnboardingScreen.tsx` (notification +
  battery-exemption + Field-Mode disclosure are Android-forward).
- **Microphone** is the only hard requirement for Voice Notes. It is (re)requested at the
  moment of recording inside `VoiceNoteRecorder.start()` via
  `Audio.requestPermissionsAsync()`. If denied, the recorder throws and the FAB surfaces an
  alert: *"Mic access needed — Allow microphone access in Settings to record voice notes."*

### 6.2 Record → classify → save (the happy path)

```
idle
  │  user taps mic FAB
  ▼
recording                      FAB hides; RecordingDrawer takes over
  │   • VoiceNoteRecorder.start(): mic perm → audio session → start → arm 10-min timer
  │   • appStore: voiceNoteRecordingState='recording', voiceNoteRecordingStartedAt=now
  │   • drawer shows live timer + waveform + Stop; can be dragged into a mini-bar
  │
  │  user taps Stop  (or 10:00 auto-stop fires)
  ▼
classifying                    drawer swaps to the 4 type pills + 5-second countdown
  │   • recorder.stop() → { uri, durationMs } captured into _pendingResult
  │   • user picks a pill (or "Summary" auto-selects at 5 s)
  │
  │  saveVoiceNoteWithType(classification)
  ▼
uploading (background)         drawer closes; an optimistic skeleton pins to the list top
  │   • appStore.voiceNotePending = { kind, startedAt }   → list renders skeleton
  │   • commitInBackground():
  │       – refresh JWT via supabase.auth.getSession()  (avoids 401 on long recordings)
  │       – voiceNoteApi.create(token, { audioUri, durationSeconds })  [90 s timeout]
  │       – backend: STT (Grok) → summary (Claude) → returns a complete VoiceNote
  │   • on success: haptic.success() + bumpVoiceNoteListRefresh() → list refetches in place
  │   • on failure: addLocalNote(...) → a `draft` note appears instead
  │   • finally: clear voiceNotePending (skeleton removed)
  ▼
idle                           ready for the next recording
```

Two UX guarantees in this flow:

- The skeleton stays up **at least `MIN_SKELETON_MS` (900 ms)** so it never just flashes.
- The user is **not navigated away** — the note materialises in the list under the
  matching kind tab.

### 6.3 Review flow

A saved note is reachable four ways, all of which `navigate('VoiceNoteDetail', { noteId })`:

1. **List tap** — a `VoiceNoteCard` in `VoiceNotesListScreen`.
2. **Rings card** → `RingsDetailSheet` → tap a marked calendar day → `DayDetailSheet` → tap a note.
3. **Day sheet** — `DayDetailSheet` opened directly from the rings card's week strip.
4. (Future) **direct nav** right after recording — currently the skeleton-in-list pattern is used instead.

### 6.4 Edit / delete / retry

- **Edit** — `VoiceNoteDetailScreen` flips title / summary / takeaways into inline
  `TextInput`s, shows an "EDITING MODE ON" pill, and a sticky Cancel/Save footer. Save
  builds a minimal `VoiceNotePatchRequest` (only changed fields, blank takeaways stripped)
  and calls `voiceNoteApi.patch`. Caps: title 120, summary 1000, takeaway 200 chars, ≤10
  takeaways.
- **Delete** — confirmation dialog → `voiceNoteApi.softDelete` (server sets `deleted_at`,
  keeps the row + audio for compliance; returns 204). List delete is **optimistic** with
  rollback on error.
- **Retry** — `draft`/`failed` notes show a Retry CTA → `voiceNoteApi.retry` re-runs STT +
  summary (90 s timeout).

---

## 7. Recording pipeline

Owned by `VoiceNoteRecorder` (`src/lib/voiceNote/VoiceNoteRecorder.ts`), a thin wrapper
over **expo-av**'s `Audio.Recording`.

### Audio format (`VOICE_NOTE_PRESET`)

| Property      | Value                          | Why                                            |
|---------------|--------------------------------|------------------------------------------------|
| Container     | `.m4a` (MPEG-4)                | Native on iOS & Android                         |
| Codec         | AAC                            | Broadcast-quality voice at low bitrate          |
| Channels      | **1 (mono)**                   | Half the bytes of stereo; speech is mono anyway |
| Sample rate   | **16 kHz**                     | Plenty for STT; Grok/Whisper downsample anyway  |
| Bit rate      | **64 kbps**                    | ~5 MB for a 10-minute note → single-shot upload |
| Metering      | off                            | Waveforms are animated programmatically         |

### State machine

```ts
type VoiceNoteRecorderState =
  | 'idle' | 'starting' | 'recording' | 'stopping' | 'stopped' | 'error';
```

### Key behaviours

- **10-minute hard cap** — `MAX_RECORDING_MS = 10 * 60 * 1000`. A timer auto-stops the
  recording at 10:00, fires `onAutoStopped` listeners, and the FAB surfaces an alert
  ("You hit the 10-minute cap…"). This is both a UX guard and a **cost safeguard** (a
  forgotten recorder caps at ~$0.017 of STT rather than hours).
- **iOS audio session** — `Audio.setAudioModeAsync({ allowsRecordingIOS: true, ... })` is
  set on start. Without it the recorder captures silence.
- **`stop()` returns** `{ uri, durationMs, autoStopped }`. The `uri` is a local filesystem
  M4A path; the caller hands it to `voiceNoteApi.create`.
- **`dispose()`** is safe from any state — used in unmount / effect cleanup.

### Recording UI surfaces

- **`RecordingDrawer`** is the **canonical** surface (per `HomeMicFab`'s own header
  comment: *"recording → handled by the central RecordingDrawer"*). It is a fixed-height
  sheet docked above the tab bar (no scrim, so the user can still navigate). It hosts the
  live timer, a `BarVisualizer`/`OrbVisualizer` waveform, a draggable handle (collapse to a
  mini-bar / expand), the **Stop** button, and — after stop — the **4 type pills** with the
  5-second auto-select countdown.
- **`RecordingOverlay`** is a full-screen "hero" variant (large centred timer +
  `RecordingVisualiser` + a **"Finish Recording"** button — this is the surface the demo
  script narrates). It drives the *same* stop pipeline via `stopVoiceNoteRecording()`.
- **`RecordingBackdrop`** is a decorative, full-bleed pastel-Spectrum wash that fades in
  while recording (`pointerEvents="none"`, ~11% net saturation).

All three are mounted near the navigator root so recording survives screen navigation.

---

## 8. Backend API contract

Client: `voiceNoteApi` (`src/lib/voiceNote/voiceNoteApi.ts`). Base URL:
`VOICE_NOTE_API_URL` → **production interview backend**
`https://rehearsal-interview-backend.onrender.com`.

> ⚠️ **Production only.** Voice-note endpoints must hit production. The old staging backend
> stopped validating production Supabase JWTs and `401`'d every save (fixed in commit
> `019ed97`). See [project memory: voice-note backend].

All endpoints (except soft-delete) wrap responses in an envelope:

```ts
interface ApiEnvelope<T>      { status: 'success' | 'error'; message?, error?; data: T; }
interface PaginatedEnvelope<T>{ status; data: T[]; total_count; offset; limit; }
```

Auth is `Authorization: Bearer <supabase access_token>` on every call.

| Method  | Path                                  | Purpose                                   | Notes |
|---------|---------------------------------------|-------------------------------------------|-------|
| `POST`  | `/api/voice-note`                     | Create (multipart M4A upload)             | **Synchronous**: waits for STT + summary. 90 s timeout. |
| `GET`   | `/api/voice-note/list?offset=&limit=` | Paginated list of live (non-deleted) notes| default `offset=0, limit=20` |
| `GET`   | `/api/voice-note/{id}`                | Fetch one note                            | throws on 404 |
| `PATCH` | `/api/voice-note/{id}`                | Edit title / summary / takeaways          | ≥1 field required (server 422); sets `is_edited=true` |
| `DELETE`| `/api/voice-note/{id}`                | Soft-delete                               | returns 204; row + audio retained |
| `POST`  | `/api/voice-note/{id}/retry`          | Re-run STT + summary                      | 90 s timeout |

### Create (the important one)

```ts
voiceNoteApi.create(accessToken, {
  audioUri: string;            // local M4A file URI from the recorder
  durationSeconds?: number;    // appended as a form field
  mimeType?: string;           // default 'audio/m4a'
}): Promise<VoiceNote>
```

- Builds React-Native `FormData` with `{ uri, name, type }`. **Content-Type is not set
  manually** — RN injects the multipart boundary itself.
- `CREATE_TIMEOUT_MS = 90_000` (reads use `DEFAULT_TIMEOUT_MS = 60_000`). The synchronous
  pipeline can take ~20 s for a 10-minute note, so the timeout must clear that ceiling.
- Errors are thrown as `Error` with `body.error || body.message || HTTP <status>`.

---

## 9. State management (appStore)

`src/store/appStore.ts` is a **Zustand** store with `persist` middleware (storage priority:
MMKV → AsyncStorage → localStorage). The Voice Notes slice:

```ts
// state
voiceNoteRecordingState: 'idle' | 'recording' | 'classifying' | 'uploading';
voiceNoteRecordingStartedAt: number | null;   // wall-clock ms; drawer computes now - startedAt
voiceNoteDraftIds: string[];                   // notes that failed STT/summary → Retry CTA
voiceNotePending: { kind: VoiceNoteKind; startedAt: number } | null;  // list skeleton meta
voiceNoteListRefreshTick: number;              // bumped after a successful create → list refetch
voiceNoteSavedTick: number;                    // broadcast tick

// actions
setVoiceNoteRecordingState(state)
setVoiceNoteRecordingStartedAt(ts)
addVoiceNoteDraft(id) / removeVoiceNoteDraft(id)
setVoiceNotePending(p)
bumpVoiceNoteListRefresh()
bumpVoiceNoteSaved()
```

- These fields are **ephemeral**: they are *not* in the `persist` partialize allow-list and
  are reset to defaults on logout (`'idle'` / `null` / `[]`).
- `voiceNoteListRefreshTick` is the decoupling mechanism: the FAB bumps it after a
  successful upload, and `VoiceNotesListScreen` watches it to refetch page 0 in place
  (no navigation, skeleton → real note).

---

## 10. Local / offline notes

`src/lib/voiceNote/localVoiceNotes.ts` — a Zustand store that provides:

- **17 curated seed notes** (an Indian-MBA persona: IIM/ISB/XLRI prep, mock cases,
  real-interview/GD captures) so the list is never empty during demos.
- **Offline draft creation** when the user is unauthenticated or the upload fails.

```ts
export const LOCAL_NOTE_PREFIX = 'local:';
export const isLocalNote = (id: string) => id.startsWith(LOCAL_NOTE_PREFIX);
```

`addLocalNote({ durationSeconds, audioUri, category?, tag?, kind?, people_detected? })`:

- mints id `local:<ts>-<counter>`, sets `status: 'draft'`,
- `executive_summary = "Saved locally — sign in to sync this note and run AI transcription."`,
- `key_takeaways = ['Local-only note', 'Sign in to transcribe + summarise']`,
- titles via `KIND_TITLES` (kind-aware) or a rotating `AUTO_TITLES` list,
- prepends the note (newest first) and returns it.

**Important:** this store is **in-memory only** — it is *not* persisted to disk. Offline
drafts are lost on app restart. Local notes can't be PATCHed / retried / deleted on the
backend; `isLocalNote(id)` guards those paths throughout the app. The list merges local
notes ahead of remote notes (offline mode shows local only).

---

## 11. Screens & navigation

### Routes (`src/navigation/AppNavigator.tsx`)

```ts
type TabParamList  = { VoiceNotesList: undefined; Explore; Companies; Analytics; };
type RootStackParamList = { /* … */ VoiceNotesList: undefined; VoiceNoteDetail: { noteId: string }; };
```

- `VoiceNotesList` is a **tab** (label "Notes", `mic` icon, accent `#FF4859`, custom
  header) and is the **initial route**. Both screens are `lazy()`-loaded and wrapped with an
  error boundary.
- `VoiceNoteDetail` is a stack screen with `slide_from_right`.

### `VoiceNotesListScreen`

The main browse surface:

- **`RingsHomeCard`** at the top (daily rings + week strip + marked dates).
- **Sticky filter row** — `DateRangeDropdown` (All / Last week / Last month) + 4 kind tabs.
- **`SectionList`** (page size 20): optional skeleton row → `VoiceNoteCard`s → hairline
  dividers. Pull-to-refresh resets the offset; `onEndReached` appends the next page; empty
  state is centred ("Tap the mic to record your first note").
- **Audio playback** lives here (expo-av `Audio.Sound`): swipe-right on a card or the
  inline player toggles play/pause, scrubs, and auto-resets on finish. Playback stops on
  blur and on unmount.
- Merges local + remote notes, applies `kind` + date-range filters client-side, and injects
  the pending-note skeleton at the top.

### `VoiceNoteDetailScreen`

- Loads by `noteId` route param: local notes resolve from `useLocalVoiceNoteStore`; remote
  notes via `voiceNoteApi.get`. Centred `SpectrumLoader` / error states.
- Hero title + meta (date · duration · edited), optional **draft/failed banner** with a
  Spectrum stripe + Retry, **Executive Summary**, **Key Takeaways** (bulleted),
  and a tab row (Transcript / Summary / Meeting — Transcript & Meeting are "coming soon"
  placeholders today).
- Inline edit mode with a sticky Cancel/Save footer; Edit / Delete / Retry actions with
  haptics.

---

## 12. Component reference

### Recording

| Component | Role |
|-----------|------|
| **HomeMicFab** | 56×56 `INK[900]` mic FAB; owns the `VoiceNoteRecorder` instance and the whole record→classify→upload pipeline; exposes `start/stop/saveWithType/discard` module functions; returns `null` while recording. |
| **PersistentRecordBar** | Bottom bar hosting the FAB and the "Ask anything…" pill; hides the pill while recording. |
| **RecordingDrawer** | Canonical recording sheet: collapsible timer + waveform + Stop, then the 4 type pills with a 5 s auto-select; blocks dismiss during classify (toast + haptic). |
| **RecordingOverlay** | Full-screen hero recording surface (timer + `RecordingVisualiser` + "Finish Recording"). |
| **RecordingBackdrop** | Decorative pastel Spectrum wash behind recording UI (`pointerEvents="none"`). |
| **BarVisualizer / OrbVisualizer / RecordingVisualiser** | Reanimated waveform/orb visualisers (UI-thread worklets; honour reduced-motion). |

### List & detail

| Component | Role |
|-----------|------|
| **VoiceNoteCard** | List row (title / summary / meta), swipe-right = play, swipe-left = delete, inline player when active, draft/failed pills. |
| **VoiceNoteSkeletonCard** | Optimistic "Adding your {kind}…" shimmer pinned to the list top during save. |
| **EditNoteSheet** | Bottom-sheet editor (title / summary / takeaways) with Spectrum-focus borders and validation caps. |
| **DayDetailSheet** | Notes recorded on a tapped calendar day; centred empty state. |

### Calendar & metrics

| Component | Role |
|-----------|------|
| **RingsHomeCard** | Compact 3-ring (coral=notes, lavender=briefs, green=interviews) + 7-day strip. |
| **RingsDetailSheet** | Expanded rings + day-streak chip + full month calendar. |
| **NestedRings** | 3 concentric SVG progress rings (12-o'clock clockwise fill). |
| **WeekStripCalendar / MonthCalendarSheet** | 7-day strip / full month grid pickers. |

### Legacy / no-op

| Component | Role |
|-----------|------|
| **RainbowDivider** | Hairline list separator (gradient retired; name kept for call-site stability). |
| **RecordingChip** | Former "Processing…" pill — now renders `null` (kept for navigator compatibility). |

---

## 13. Configuration & environment

`src/config/api.ts`:

```ts
const DEFAULT_INTERVIEW_BACKEND = 'https://rehearsal-interview-backend.onrender.com';
const DEFAULT_VOICE_NOTE_BACKEND = DEFAULT_INTERVIEW_BACKEND;          // prod
export const VOICE_NOTE_API_URL =
  process.env.EXPO_PUBLIC_VOICE_NOTE_BACKEND_URL || DEFAULT_VOICE_NOTE_BACKEND;
```

- Override the base URL with `EXPO_PUBLIC_VOICE_NOTE_BACKEND_URL` (dev/testing). For
  production builds, set it via EAS Secrets pointing at the production Render service.
- Timeouts: `DEFAULT_TIMEOUT_MS = 60_000`, `CREATE_TIMEOUT_MS = 90_000`.
- Recording: `MAX_RECORDING_MS = 600_000` (10 min); `VOICE_NOTE_PRESET` (mono / 16 kHz / 64 kbps).

---

## 14. Dependencies

| Library | Version | Used for |
|---------|---------|----------|
| `expo-av` | ^16.0.8 | `Audio.Recording` (capture) + `Audio.Sound` (playback), audio session |
| `react-native-reanimated` | ~4.1.1 | Timers, waveforms, drawer collapse, fades (UI-thread worklets) |
| `react-native-gesture-handler` | ~2.28.0 | Drawer pan-to-collapse; card swipe-to-play/delete |
| `zustand` | ^5.0.9 | `appStore` (recording state) + `localVoiceNotes` store |
| `@supabase/supabase-js` | ^2.90.1 | Auth (`getSession` for fresh JWTs at upload time) |
| `@react-navigation/native-stack` | ^7.9.0 | Detail screen + modal presentation |
| `react-native-svg` | 15.12.1 | `NestedRings`, `GradientText` |
| `expo-haptics` | ^15.0.8 | Tap / commit / success / warn feedback |
| `react-native-markdown-display` | ^7.0.2 | Markdown (summary/takeaways rendering, future) |

Platform: `react-native 0.81.5`, `expo ~54.0.33`.

---

## 15. Edge cases & safeguards

- **JWT refresh at upload** — `commitInBackground` calls `supabase.auth.getSession()` to get
  a fresh token before `create`, so a long recording (token expired mid-session) doesn't 401.
- **Auth/network failure → local draft** — instead of losing the audio, the note is saved
  locally as a `draft`. The user can sign in and retry later.
- **10-minute cap** — protects against runaway recordings (UX + STT cost).
- **Optimistic delete with rollback** — the list removes the row immediately and restores it
  (plus an alert) if `softDelete` throws.
- **Skeleton min-duration** — 900 ms floor so the placeholder never flashes.
- **Reduced motion** — all visualisers/animations check `useReducedMotion()` and degrade.
- **Soft-delete only** — audio + row are retained on the server (`deleted_at`); no hard delete.
- **Offline store is volatile** — in-memory only; drafts are lost on restart (by design, for now).

---

## 16. Known gaps / future work

- **Diarized transcript & per-speaker breakdown** — the Transcript and Meeting detail tabs
  are placeholders ("not ready yet" / "coming soon"). The richer structured-output types
  (`InsightsResult`, `MeetingResult`, `InterviewResult`, `TranscriptSegment[]`) existed in
  an earlier backend and may return. The GD-diarization headline (demo §"People Detected")
  needs these surfaced.
- **Remote audio playback in detail** — playback currently works for **local** notes
  (`audioUri`) and from the list. The detail screen has no streaming player yet; it needs a
  signed-URL endpoint from the backend.
- **Kind not synced to backend** — the 4-kind taxonomy is client-side (used for the recording
  picker + list tabs); it is not yet persisted server-side, so remote notes rely on
  `voiceNoteKind()` inference.
- **Persisting offline drafts** — local notes should survive app restarts (MMKV/AsyncStorage)
  and ideally auto-sync on next sign-in.
- **Auto-navigate after record** — the post-save flow uses the skeleton-in-list pattern; a
  "jump straight to the new note" option is stubbed but disabled.

---

### Related references

- Demo narrative: `voice-notes-demo-script.txt`
- Backend fix context: commit `019ed97` (route saves to production backend)
- UI restore context: commit `0374790` (local notes UI: dropdown, 4 pills, autosave)
</content>
</invoke>
