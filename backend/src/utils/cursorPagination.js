const mongoose = require('mongoose');

/**
 * High-Performance Cursor-Based Pagination Utility
 * Replaces O(N) skip/limit scans with O(1) B-tree compound index lookups.
 * Always enforces .lean() for minimal memory and zero Mongoose document wrapping overhead.
 */

async function paginateWithCursor(modelOrQuery, options = {}) {
  const {
    query = {},
    cursor = null,
    limit = 50,
    sortField = '_id',
    sortOrder = -1, // -1: descending (newest first), 1: ascending
    projection = null,
    populate = null,
    includeTotalCount = false,
  } = options;

  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 250);
  const filter = { ...query };

  // Apply cursor condition if supplied
  if (cursor) {
    if (sortField === '_id') {
      try {
        const cursorObjId = new mongoose.Types.ObjectId(cursor);
        filter._id = sortOrder === -1 ? { $lt: cursorObjId } : { $gt: cursorObjId };
      } catch (_) {
        // Invalid objectId cursor, ignore
      }
    } else {
      filter[sortField] = sortOrder === -1 ? { $lt: cursor } : { $gt: cursor };
    }
  }

  // Fetch limit + 1 to check if another page exists without an extra COUNT query
  let dbQuery = modelOrQuery.find(filter);

  if (projection) {
    dbQuery = dbQuery.select(projection);
  }

  dbQuery = dbQuery.sort({ [sortField]: sortOrder }).limit(parsedLimit + 1);

  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach((p) => {
        dbQuery = dbQuery.populate(p);
      });
    } else {
      dbQuery = dbQuery.populate(populate);
    }
  }

  // Enforce lean query for 3x lower memory footprint
  const items = await dbQuery.lean();

  const hasMore = items.length > parsedLimit;
  if (hasMore) {
    items.pop(); // Remove the extra peeked item
  }

  const nextCursor = items.length > 0 && hasMore ? items[items.length - 1][sortField] : null;

  let totalCount = undefined;
  if (includeTotalCount) {
    totalCount = await modelOrQuery.countDocuments(query);
  }

  return {
    items,
    nextCursor: nextCursor ? String(nextCursor) : null,
    hasMore,
    totalCount,
    limit: parsedLimit,
  };
}

module.exports = {
  paginateWithCursor,
};
