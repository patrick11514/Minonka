# Minonka Project Rules & Skills

## General Guidelines
- Always use `pnpm` (never `npm` or `yarn`) for package management, running scripts, and managing migrations.

## Development Workflow
- Before implementing any new feature or fix:
  1. Switch to the `main` branch.
  2. Pull and rebase (`git pull --rebase`).
  3. Create a new branch for the specific implementation (e.g. `feat/feature-name` or `fix/issue-name`).

## Verification & Testing
- Before testing, run `assets/download.sh` to update assets.
- Always verify code quality using `pnpm check`, `pnpm lint`, and `pnpm worker:test`.

## Commit Conventions
- After every feature, fix, or substantial code change, always commit your code.
- Commit message format: `ACTION(PART): message` or `ACTION: message`
  - Examples:
    - `feat: Added something`
    - `fix(EmojiManager): something`
