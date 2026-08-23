import mongoose, { Document, Schema } from 'mongoose';

export interface IDatabaseHealth extends Document {
  connectionState: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'uninitialized';
  readyState: number; // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  healthScore: number; // 0 - 100
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
  pingLatencyMs: number;
  availabilityPercentage: number;
  slowQueryCount24h: number;
  failedOperations24h: number;
  databaseSize: {
    dataSizeBytes: number;
    storageSizeBytes: number;
    totalSizeBytes: number;
    formattedDataSize: string;
    formattedStorageSize: string;
  };
  totalDocuments: number;
  totalCollections: number;
  totalIndexes: number;
  totalIndexSizeBytes: number;
  connectionCount: {
    current: number;
    available: number;
    totalCreated: number;
    activePercent: number;
  };
  cluster: {
    isReplicaSet: boolean;
    setName: string;
    hosts: string[];
    primary: string;
    secondaryCount: number;
    standalone: boolean;
    storageEngine: string;
    version: string;
  };
  diagnostics: {
    mode: 'HEALTHY' | 'APP_ISSUE' | 'DB_DOWN' | 'NETWORK_FAILURE';
    message: string;
    lastTestedAt: Date;
  };
  scoreBreakdown: {
    availabilityScore: number;
    latencyScore: number;
    errorScore: number;
    resourceScore: number;
  };
  lastCheckedAt: Date;
  timestamp: Date;
}

const DatabaseHealthSchema: Schema = new Schema(
  {
    connectionState: {
      type: String,
      enum: ['connected', 'disconnected', 'connecting', 'disconnecting', 'uninitialized'],
      default: 'uninitialized',
    },
    readyState: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'UNHEALTHY', 'DOWN'],
      default: 'HEALTHY',
    },
    pingLatencyMs: { type: Number, default: 0 },
    availabilityPercentage: { type: Number, default: 100 },
    slowQueryCount24h: { type: Number, default: 0 },
    failedOperations24h: { type: Number, default: 0 },
    databaseSize: {
      dataSizeBytes: { type: Number, default: 0 },
      storageSizeBytes: { type: Number, default: 0 },
      totalSizeBytes: { type: Number, default: 0 },
      formattedDataSize: { type: String, default: '0 MB' },
      formattedStorageSize: { type: String, default: '0 MB' },
    },
    totalDocuments: { type: Number, default: 0 },
    totalCollections: { type: Number, default: 0 },
    totalIndexes: { type: Number, default: 0 },
    totalIndexSizeBytes: { type: Number, default: 0 },
    connectionCount: {
      current: { type: Number, default: 0 },
      available: { type: Number, default: 0 },
      totalCreated: { type: Number, default: 0 },
      activePercent: { type: Number, default: 0 },
    },
    cluster: {
      isReplicaSet: { type: Boolean, default: false },
      setName: { type: String, default: '' },
      hosts: [{ type: String }],
      primary: { type: String, default: '' },
      secondaryCount: { type: Number, default: 0 },
      standalone: { type: Boolean, default: true },
      storageEngine: { type: String, default: 'WiredTiger' },
      version: { type: String, default: '' },
    },
    diagnostics: {
      mode: {
        type: String,
        enum: ['HEALTHY', 'APP_ISSUE', 'DB_DOWN', 'NETWORK_FAILURE'],
        default: 'HEALTHY',
      },
      message: { type: String, default: 'MongoDB operational and responsive' },
      lastTestedAt: { type: Date, default: Date.now },
    },
    scoreBreakdown: {
      availabilityScore: { type: Number, default: 100 },
      latencyScore: { type: Number, default: 100 },
      errorScore: { type: Number, default: 100 },
      resourceScore: { type: Number, default: 100 },
    },
    lastCheckedAt: { type: Date, default: Date.now },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Indexes
DatabaseHealthSchema.index({ timestamp: -1 });

export default mongoose.models.DatabaseHealth ||
  mongoose.model<IDatabaseHealth>('DatabaseHealth', DatabaseHealthSchema);
