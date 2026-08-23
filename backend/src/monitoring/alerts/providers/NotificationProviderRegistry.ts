import { INotificationProvider } from './INotificationProvider';
import { WebhookProvider } from './WebhookProvider';
import { SlackProvider } from './SlackProvider';
import { TelegramProvider } from './TelegramProvider';
import { EmailProvider } from './EmailProvider';
import { DiscordProvider } from './DiscordProvider';

export class NotificationProviderRegistry {
  private static instance: NotificationProviderRegistry;
  private providers: Map<string, INotificationProvider> = new Map();

  private constructor() {
    // Register default built-in providers
    this.register(new WebhookProvider());
    this.register(new SlackProvider());
    this.register(new TelegramProvider());
    this.register(new EmailProvider());
    this.register(new DiscordProvider());
  }

  public static getInstance(): NotificationProviderRegistry {
    if (!NotificationProviderRegistry.instance) {
      NotificationProviderRegistry.instance = new NotificationProviderRegistry();
    }
    return NotificationProviderRegistry.instance;
  }

  public register(provider: INotificationProvider): void {
    this.providers.set(provider.type.toUpperCase(), provider);
  }

  public get(type: string): INotificationProvider | undefined {
    return this.providers.get(type.toUpperCase());
  }

  public has(type: string): boolean {
    return this.providers.has(type.toUpperCase());
  }

  public getSupportedTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}

export const notificationProviderRegistry = NotificationProviderRegistry.getInstance();
export default notificationProviderRegistry;
