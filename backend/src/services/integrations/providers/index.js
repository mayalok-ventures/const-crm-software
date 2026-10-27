const metaProvider = require('./MetaProvider');
const googleProvider = require('./GoogleProvider');
const sheetsProvider = require('./SheetsProvider');
const websiteProvider = require('./WebsiteProvider');
const customWebhookProvider = require('./CustomWebhookProvider');

class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.register('meta', metaProvider);
    this.register('facebook', metaProvider);
    this.register('instagram', metaProvider);
    this.register('google', googleProvider);
    this.register('sheets', sheetsProvider);
    this.register('website', websiteProvider);
    this.register('custom', customWebhookProvider);
  }

  register(name, providerInstance) {
    this.providers.set(name.toLowerCase(), providerInstance);
  }

  get(name) {
    if (!name) return customWebhookProvider;
    const provider = this.providers.get(String(name).toLowerCase());
    if (!provider) {
      // Default fallback to custom webhook provider for generic JSON
      return customWebhookProvider;
    }
    return provider;
  }

  has(name) {
    return this.providers.has(String(name).toLowerCase());
  }
}

module.exports = new ProviderRegistry();
