# Contributing

Use the existing checkout; cloud tasks already provide isolation, so do not create additional worktrees unless requested. Use Node 26.13.0 and `npm ci` at the repository root. Develop on a feature branch and keep each increment reviewable.

Before opening a pull request, run `npm run check`, `npm test`, and `npm run test:coverage`. Add behavior tests for fixes and features. Tests create isolated stores and bind ephemeral loopback ports; they require no external service. Update the API contract and learning notes when behavior changes. Never commit credentials or generated dependency directories.

Use npm workspaces for future apps. Introduce shared packages only when multiple consumers justify them. Keep roadmap entries marked planned until implemented and verified. CI currently validates the JavaScript API; a future TypeScript package must add real type checking and compilation as required.
