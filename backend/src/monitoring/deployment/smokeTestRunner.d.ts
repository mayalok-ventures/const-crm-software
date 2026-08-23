import { ISmokeTestResult } from '../models/Deployment';
export declare class SmokeTestRunner {
    /**
     * Executes a complete suite of smoke tests to verify platform stability
     * after a new build or deployment.
     */
    static runSuite(): Promise<ISmokeTestResult>;
}
export default SmokeTestRunner;
