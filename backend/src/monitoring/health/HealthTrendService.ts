import mongoose from 'mongoose';
import { PlatformHealthSnapshot, IPlatformHealthSnapshot } from '../models/PlatformHealthSnapshot';

export interface IHealthTrendSummary {
  currentScore: number;
  currentStatus: string;
  confidence: number;
  delta1Hour: number; // e.g. +0.5
  deltaYesterday: number; // e.g. +4.2
  deltaLastWeek: number; // e.g. -1.8
  historicalAverage24h: number;
  lowestScore24h: number;
  highestScore24h: number;
  timeline: Array<{
    timestamp: Date;
    overallScore: number;
    infrastructureScore: number;
    availabilityScore: number;
    databaseScore: number;
    apiScore: number;
    securityScore: number;
  }>;
}

export class HealthTrendService {
  private static instance: HealthTrendService;

  public static getInstance(): HealthTrendService {
    if (!HealthTrendService.instance) {
      HealthTrendService.instance = new HealthTrendService();
    }
    return HealthTrendService.instance;
  }

  /**
   * Retrieves historical time series data within a specified range.
   */
  public async getHistory(range: string = '24h'): Promise<any[]> {
    if (mongoose.connection.readyState !== 1) {
      return [];
    }

    const now = Date.now();
    let ms = 24 * 3600 * 1000;

    switch (range) {
      case '1h':
        ms = 1 * 3600 * 1000;
        break;
      case '6h':
        ms = 6 * 3600 * 1000;
        break;
      case '24h':
        ms = 24 * 3600 * 1000;
        break;
      case '7d':
        ms = 7 * 24 * 3600 * 1000;
        break;
      case '30d':
        ms = 30 * 24 * 3600 * 1000;
        break;
      default:
        ms = 24 * 3600 * 1000;
    }

    const since = new Date(now - ms);
    const snapshots = await PlatformHealthSnapshot.find({ timestamp: { $gte: since } })
      .sort({ timestamp: 1 })
      .lean();

    return snapshots.map((s: any) => {
      const getCompScore = (id: string) => {
        const c = (s.components || []).find((comp: any) => comp.componentId === id);
        return c ? c.score : s.overallScore;
      };

      return {
        timestamp: s.timestamp,
        overallScore: s.overallScore,
        overallStatus: s.overallStatus,
        confidence: s.confidence,
        isCircuitBreakerActive: s.isCircuitBreakerActive,
        infrastructure: getCompScore('infrastructure'),
        availability: getCompScore('availability'),
        database: getCompScore('database'),
        api: getCompScore('api_performance'),
        security: getCompScore('security'),
        storage: getCompScore('storage'),
      };
    });
  }

  /**
   * Computes comprehensive mathematical trend analysis comparing current score with 1h ago, yesterday, and last week.
   */
  public async getTrendSummary(latestSnapshot: IPlatformHealthSnapshot): Promise<IHealthTrendSummary> {
    const currentScore = latestSnapshot.overallScore;

    if (mongoose.connection.readyState !== 1) {
      return {
        currentScore,
        currentStatus: latestSnapshot.overallStatus,
        confidence: latestSnapshot.confidence,
        delta1Hour: 0.0,
        deltaYesterday: 0.0,
        deltaLastWeek: 0.0,
        historicalAverage24h: currentScore,
        lowestScore24h: currentScore,
        highestScore24h: currentScore,
        timeline: [],
      };
    }

    const now = Date.now();
    const oneHourAgo = new Date(now - 3600 * 1000);
    const yesterday = new Date(now - 24 * 3600 * 1000);
    const lastWeek = new Date(now - 7 * 24 * 3600 * 1000);

    const [snap1h, snap24h, snap7d, last24hSnaps] = await Promise.all([
      PlatformHealthSnapshot.findOne({ timestamp: { $lte: oneHourAgo } }).sort({ timestamp: -1 }).lean(),
      PlatformHealthSnapshot.findOne({ timestamp: { $lte: yesterday } }).sort({ timestamp: -1 }).lean(),
      PlatformHealthSnapshot.findOne({ timestamp: { $lte: lastWeek } }).sort({ timestamp: -1 }).lean(),
      PlatformHealthSnapshot.find({ timestamp: { $gte: yesterday } }).sort({ timestamp: 1 }).lean(),
    ]);

    const score1h = snap1h ? (snap1h as any).overallScore : currentScore;
    const score24h = snap24h ? (snap24h as any).overallScore : currentScore;
    const score7d = snap7d ? (snap7d as any).overallScore : currentScore;

    const delta1Hour = Math.round((currentScore - score1h) * 10) / 10;
    const deltaYesterday = Math.round((currentScore - score24h) * 10) / 10;
    const deltaLastWeek = Math.round((currentScore - score7d) * 10) / 10;

    let total24h = currentScore;
    let count24h = 1;
    let lowestScore24h = currentScore;
    let highestScore24h = currentScore;

    if (last24hSnaps && last24hSnaps.length > 0) {
      total24h = 0;
      count24h = last24hSnaps.length;
      lowestScore24h = 100;
      highestScore24h = 0;

      for (const s of last24hSnaps as any[]) {
        const sc = s.overallScore;
        total24h += sc;
        if (sc < lowestScore24h) lowestScore24h = sc;
        if (sc > highestScore24h) highestScore24h = sc;
      }
    }

    const historicalAverage24h = Math.round((total24h / count24h) * 10) / 10;

    // Timeline points (up to 30 sample points for smooth rendering)
    const timeline = (last24hSnaps as any[] || []).map((s) => {
      const getComp = (id: string) => {
        const c = (s.components || []).find((comp: any) => comp.componentId === id);
        return c ? c.score : s.overallScore;
      };
      return {
        timestamp: s.timestamp,
        overallScore: s.overallScore,
        infrastructureScore: getComp('infrastructure'),
        availabilityScore: getComp('availability'),
        databaseScore: getComp('database'),
        apiScore: getComp('api_performance'),
        securityScore: getComp('security'),
      };
    });

    return {
      currentScore,
      currentStatus: latestSnapshot.overallStatus,
      confidence: latestSnapshot.confidence,
      delta1Hour,
      deltaYesterday,
      deltaLastWeek,
      historicalAverage24h,
      lowestScore24h,
      highestScore24h,
      timeline,
    };
  }
}

export const healthTrendService = HealthTrendService.getInstance();
export default healthTrendService;
