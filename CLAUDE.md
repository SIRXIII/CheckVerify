# Check-In Verify — Project Instructions

## Tech Stack
- **React** + Vite + Tailwind CSS
- **Supabase** (`@supabase/supabase-js`) — auth and database
- Deploy: Netlify
- Signature capture: `signature_pad`
- Package name: hotel-verification-system

## Build & Run
- Dev: `npm run dev`
- Build: `npm run build`
- Schema check: query Supabase `information_schema.columns` for `public` tables

## Phase Log
`~/Documents/Obsidian Vault/Projects/CheckInVerify/Phase Log.md`

## Coding Behavior (Karpathy Guidelines)

**1. Think Before Coding** — State assumptions explicitly. If multiple interpretations exist, present them — don't pick silently. Ask before starting if scope is unclear.

**2. Simplicity First** — Minimum code that solves the request. No features beyond what was asked. No abstractions for single-use code.

**3. Surgical Changes** — Touch only what you must. Don't improve adjacent code. Match existing style. Every changed line must trace directly to the request.

**4. Goal-Driven Execution** — For multi-step work, state a brief plan with verification checkpoints before starting. Clarifying questions come before implementation.
