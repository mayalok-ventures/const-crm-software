/**
 * Base Provider Contract for Inbound Marketing & Webhook Integrations
 *
 * All providers (Meta, Google, Sheets, Website, Custom) must implement this lifecycle:
 * 1. verify(req, integration) -> boolean | throws Error
 * 2. parse(req) -> rawPayload
 * 3. hydrate(parsed, integration) -> hydratedPayload (optional async fetch, e.g. Meta Graph API)
 * 4. normalize(hydrated, integration) -> standardNormalizedLead
 *
 * All deduplication, field mapping, campaign overrides, team assignment,
 * and persistence remain unified in leadIngestionService.
 */

class BaseProvider {
  constructor(name) {
    this.name = name;
  }

  /**
   * Verify authenticity of inbound webhook request
   * @param {Object} req Express request
   * @param {Object} integration Integration model document
   * @returns {boolean} true if valid, false or throws if invalid
   */
  async verify(req, integration) {
    throw new Error(`verify() not implemented for provider ${this.name}`);
  }

  /**
   * Extract payload, parameters, and headers
   * @param {Object} req Express request
   * @returns {Object} Parsed raw event payload
   */
  parse(req) {
    throw new Error(`parse() not implemented for provider ${this.name}`);
  }

  /**
   * Optional async hydration (e.g. Graph API lead retrieval)
   * Default implementation returns parsed payload unmodified
   * @param {Object} parsed Parsed payload
   * @param {Object} integration Integration document
   * @returns {Promise<Object>} Hydrated payload
   */
  async hydrate(parsed, integration) {
    return parsed;
  }

  /**
   * Produce canonical normalized lead object
   * @param {Object} hydrated Hydrated payload
   * @param {Object} integration Integration document
   * @returns {Object} Normalized lead payload ready for leadIngestionService.ingest()
   */
  normalize(hydrated, integration) {
    throw new Error(`normalize() not implemented for provider ${this.name}`);
  }
}

module.exports = BaseProvider;
