"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationProviderRegistry = exports.NotificationProviderRegistry = void 0;
const WebhookProvider_1 = require("./WebhookProvider");
const SlackProvider_1 = require("./SlackProvider");
const TelegramProvider_1 = require("./TelegramProvider");
const EmailProvider_1 = require("./EmailProvider");
const DiscordProvider_1 = require("./DiscordProvider");
class NotificationProviderRegistry {
    static instance;
    providers = new Map();
    constructor() {
        // Register default built-in providers
        this.register(new WebhookProvider_1.WebhookProvider());
        this.register(new SlackProvider_1.SlackProvider());
        this.register(new TelegramProvider_1.TelegramProvider());
        this.register(new EmailProvider_1.EmailProvider());
        this.register(new DiscordProvider_1.DiscordProvider());
    }
    static getInstance() {
        if (!NotificationProviderRegistry.instance) {
            NotificationProviderRegistry.instance = new NotificationProviderRegistry();
        }
        return NotificationProviderRegistry.instance;
    }
    register(provider) {
        this.providers.set(provider.type.toUpperCase(), provider);
    }
    get(type) {
        return this.providers.get(type.toUpperCase());
    }
    has(type) {
        return this.providers.has(type.toUpperCase());
    }
    getSupportedTypes() {
        return Array.from(this.providers.keys());
    }
}
exports.NotificationProviderRegistry = NotificationProviderRegistry;
exports.notificationProviderRegistry = NotificationProviderRegistry.getInstance();
exports.default = exports.notificationProviderRegistry;
