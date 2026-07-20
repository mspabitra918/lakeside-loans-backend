export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export interface ResolvedPagination {
  page: number;
  limit: number;
  offset: number;
}

/**
 * Normalises the `page`/`limit` query params into values that are always safe to
 * hand to Sequelize. Anything absent, non-numeric, or out of range collapses to
 * a sane default rather than producing `LIMIT NaN`, and `limit` is capped so a
 * caller cannot ask for the whole table in one request.
 */
export function resolvePagination(
  page?: number | string,
  limit?: number | string,
): ResolvedPagination {
  const parsedPage = Number(page);
  const parsedLimit = Number(limit);

  const safePage =
    Number.isFinite(parsedPage) && parsedPage >= 1 ? Math.floor(parsedPage) : 1;

  const safeLimit =
    Number.isFinite(parsedLimit) && parsedLimit >= 1
      ? Math.min(Math.floor(parsedLimit), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}
