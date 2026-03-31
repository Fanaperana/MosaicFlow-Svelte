# Contributing to MosaicFlow

Thanks for your interest in contributing.

This project follows an issue-driven workflow so changes are discussed,
scoped, and tracked before code is merged.

## Ground Rules

- Be respectful and follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)
- Keep pull requests focused and tied to one issue
- Prefer small, reviewable commits

## Development Setup

1. Fork the repository and clone your fork.
2. Install dependencies:

   pnpm install

3. Start the app in development:

   pnpm tauri dev

4. Before opening a PR, run checks:

   pnpm check

## Workflow

1. Create or pick an issue first.
2. Create a branch using:

   <type>/<issue-number>-<short-description>

   Example: feature/42-maplibre-integration

3. Implement your change and add tests when relevant.
4. Commit using Conventional Commits:

   feat(nodes): add map marker clustering

5. Reference and close the issue in commit or PR body:

   Closes #42

6. Open a pull request using the PR template.

## Issue Types

- bug
- feature
- enhancement
- refactor
- docs

## Commit Guidelines

Use Conventional Commits:

- feat
- fix
- docs
- style
- refactor
- test
- chore

Suggested scopes for this repo:

- nodes
- canvas
- stores
- api
- ui
- editor

## Pull Request Checklist

- Linked issue in PR description
- Clear summary of the change
- Tests added or updated (if applicable)
- No unrelated refactors
- All checks pass locally

## Reporting Security Issues

Do not open public issues for vulnerabilities.

See [SECURITY.md](SECURITY.md) for the reporting process.