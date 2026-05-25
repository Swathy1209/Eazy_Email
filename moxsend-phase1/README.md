
## Folder Structure

/frontend - Frontend UI work
/backend - Backend APIs
/ai - AI prompts, AI scripts, LLM logic
/docs - API contracts, task notes, demo notes

## Git Rules

1. No direct push to main.
2. Daily push required.
3. Every task must have a Pull Request.
4. Demo required before merge.
5. Commit messages should be clear.

## Basic Git Commands

Check current branch and file changes:

```bash
git status
```

See all local branches:

```bash
git branch
```

Switch to an existing branch:

```bash
git switch branch-name
```

Example:

```bash
git switch feature/ai-email
```

Create and switch to a new branch:

```bash
git switch -c feature/task-name
```

Get latest changes from GitHub:

```bash
git pull
```

Add changed files:

```bash
git add .
```

Commit changes:

```bash
git commit -m "Short clear message"
```

Push your branch to GitHub:

```bash
git push origin branch-name
```

Example:

```bash
git push origin feature/ai-email
```

View recent commits:

```bash
git log --oneline
```

## Branches

Mayukh & Swathy - feature/ai-email
Harsh - feature/backend-api
Dev - feature/frontend-ui
