import { ComponentHealth } from '../healthTypes';
export declare class ExternalServiceProbe {
    /**
     * Helper to perform a fast HTTP HEAD / GET request with strict timeout
     */
    private static pingHttp;
    /**
     * Probes WhatsApp Provider / API status
     */
    probeWhatsApp(): Promise<ComponentHealth>;
    /**
     * Probes Payment Gateway (Razorpay) connectivity
     */
    probePaymentGateway(): Promise<ComponentHealth>;
}
export declare const externalServiceProbe: ExternalServiceProbe;
