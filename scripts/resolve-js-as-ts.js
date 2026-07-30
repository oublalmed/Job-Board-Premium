// TypeORM's CLI require()s entity/migration files by their literal relative
// specifier (e.g. '../../users/entities/user.entity.js'), matching this
// project's NodeNext-style imports. tsc resolves that '.js' specifier to the
// '.ts' source file at type-check time, but plain ts-node's CJS require()
// hook does not — Node's runtime resolver looks for a literal '.js' file,
// finds none (nothing is compiled to disk in dev), and throws
// MODULE_NOT_FOUND. This patches module resolution to fall back to the
// sibling '.ts' file when the '.js' one doesn't exist, so `npm run typeorm`
// (migration:generate/run/revert) can load the real source tree.
const Module = require('module');

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolveFilename(
  request,
  ...rest
) {
  if (request.endsWith('.js')) {
    try {
      return originalResolveFilename.call(
        this,
        request.slice(0, -'.js'.length) + '.ts',
        ...rest,
      );
    } catch {
      // Fall through — not every '.js' specifier is one of ours (e.g.
      // node_modules packages), so let the original resolver handle it.
    }
  }
  return originalResolveFilename.call(this, request, ...rest);
};
