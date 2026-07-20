// Vercel's entry point for every request.
//
// This is deliberately plain JavaScript pointing at the `nest build` output
// rather than TypeScript. Vercel compiles files under `api/` with esbuild,
// which does not support `emitDecoratorMetadata` — the reflection data all of
// Nest's dependency injection relies on. Building with `tsc` (via nest build)
// first and only requiring the result here keeps that metadata intact.
module.exports = require('../dist/serverless').default;
