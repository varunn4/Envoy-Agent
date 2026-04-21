/**
 * Apollo.io integration stub.
 * Full implementation is planned for a future iteration.
 */

import logger from './logger.js';

/**
 * Search Apollo for leads matching the given config criteria.
 * @param {object} config
 * @returns {Promise<object[]>} array of lead objects
 */
export async function searchApollo(config) {
  logger.warn({ module: 'apollo' }, 'Apollo integration not yet implemented — returning empty array');
  return [];
}
