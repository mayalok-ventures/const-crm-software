import mongoose, { Document } from 'mongoose';
export interface IComponentWeight {
    componentId: string;
    name: string;
    weight: number;
    isEnabled: boolean;
}
export interface IHealthThresholds {
    excellentMin: number;
    healthyMin: number;
    goodMin: number;
    warningMin: number;
    degradedMin: number;
}
export interface ICircuitBreakers {
    databaseDownForcesCritical: boolean;
    zeroServersOnlineForcesCritical: boolean;
    criticalSecurityIncidentCapsDegraded: boolean;
    unresolvedP1IncidentCapsDegraded: boolean;
}
export interface IHealthWeightConfig extends Document {
    configId: string;
    weights: IComponentWeight[];
    thresholds: IHealthThresholds;
    circuitBreakers: ICircuitBreakers;
    updatedBy: string;
    updatedAt: Date;
}
export declare const DEFAULT_COMPONENT_WEIGHTS: IComponentWeight[];
export declare const DEFAULT_THRESHOLDS: IHealthThresholds;
export declare const DEFAULT_CIRCUIT_BREAKERS: ICircuitBreakers;
export declare const HealthWeightConfig: mongoose.Model<any, {}, {}, {}, any, any>;
export default HealthWeightConfig;
