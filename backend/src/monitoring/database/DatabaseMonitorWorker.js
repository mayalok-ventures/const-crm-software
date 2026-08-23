"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.databaseMonitorWorker = exports.DatabaseMonitorWorker = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const DatabaseHealth_1 = __importDefault(require("../models/DatabaseHealth"));
const DatabaseMetric_1 = __importDefault(require("../models/DatabaseMetric"));
const databaseScoreCalculator_1 = require("./databaseScoreCalculator");
const databaseDiagnostics_1 = require("./databaseDiagnostics");
const slowQueryInterceptor_1 = require("./slowQueryInterceptor");
class DatabaseMonitorWorker {
    static instance;
    intervalTimer = null;
    intervalMs = 30000; // 30 seconds default
    isCollecting = false;
    latestState;
    pingHistory = [];
    maxPingHistory = 30;
    constructor() {
        this.latestState = this.getFallbackState();
    }
    static getInstance() {
        if (!DatabaseMonitorWorker.instance) {
            DatabaseMonitorWorker.instance = new DatabaseMonitorWorker();
        }
        return DatabaseMonitorWorker.instance;
    }
    start(intervalMs = 30000) {
        this.intervalMs = intervalMs;
        console.log(`[DatabaseMonitorWorker] Starting background worker (Interval: ${this.intervalMs}ms)`);
        // Initial collection
        this.collect().catch((err) => {
            console.warn('[DatabaseMonitorWorker] Initial collection warning:', err.message);
        });
        if (this.intervalTimer)
            clearInterval(this.intervalTimer);
        this.intervalTimer = setInterval(() => {
            this.collect().catch((err) => {
                console.warn('[DatabaseMonitorWorker] Periodic collection warning:', err.message);
            });
        }, this.intervalMs);
    }
    stop() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
            console.log('[DatabaseMonitorWorker] Stopped background worker');
        }
    }
    getLatestState() {
        return this.latestState;
    }
    formatBytes(bytes) {
        if (!bytes || bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    getFallbackState(error) {
        const readyState = mongoose_1.default.connection ? mongoose_1.default.connection.readyState : 0;
        const stateNames = {
            0: 'disconnected',
            1: 'connected',
            2: 'connecting',
            3: 'disconnecting',
        };
        const connectionState = stateNames[readyState] || 'uninitialized';
        const diagnostics = (0, databaseDiagnostics_1.diagnoseDatabaseFailure)(readyState, error);
        const scoreResult = (0, databaseScoreCalculator_1.calculateDatabaseHealthScore)({
            readyState,
            pingLatencyMs: 0,
            availabilityPercent: readyState === 1 ? 100 : 0,
            failedOperationsCount: readyState === 1 ? 0 : 10,
        });
        return {
            connectionState,
            readyState,
            healthScore: scoreResult.score,
            status: scoreResult.status,
            pingLatencyMs: 0,
            availabilityPercentage: readyState === 1 ? 100 : 0,
            slowQueryCount24h: 0,
            failedOperations24h: readyState === 1 ? 0 : 1,
            databaseSize: {
                dataSizeBytes: 0,
                storageSizeBytes: 0,
                totalSizeBytes: 0,
                formattedDataSize: '0 MB',
                formattedStorageSize: '0 MB',
            },
            totalDocuments: 0,
            totalCollections: 0,
            totalIndexes: 0,
            totalIndexSizeBytes: 0,
            connectionCount: {
                current: readyState === 1 ? 5 : 0,
                available: 45,
                totalCreated: 5,
                activePercent: 10,
            },
            cluster: {
                isReplicaSet: false,
                setName: '',
                hosts: [],
                primary: '',
                secondaryCount: 0,
                standalone: true,
                storageEngine: 'WiredTiger',
                version: '',
            },
            diagnostics,
            scoreBreakdown: scoreResult.breakdown,
            collections: [],
            lastCheckedAt: new Date(),
        };
    }
    async pingLive() {
        const start = Date.now();
        try {
            if (mongoose_1.default.connection.readyState !== 1 || !mongoose_1.default.connection.db) {
                throw new Error('Database is not connected (readyState !== 1)');
            }
            await mongoose_1.default.connection.db.command({ ping: 1 });
            const latencyMs = Date.now() - start;
            return { success: true, latencyMs };
        }
        catch (err) {
            return { success: false, latencyMs: Date.now() - start, error: err.message };
        }
    }
    async collect() {
        if (this.isCollecting)
            return this.latestState;
        this.isCollecting = true;
        try {
            const readyState = mongoose_1.default.connection.readyState;
            if (readyState !== 1 || !mongoose_1.default.connection.db) {
                this.latestState = this.getFallbackState();
                return this.latestState;
            }
            const db = mongoose_1.default.connection.db;
            // 1. Measure Ping Latency
            const pingStart = Date.now();
            await db.command({ ping: 1 });
            const pingLatencyMs = Date.now() - pingStart;
            this.pingHistory.unshift(pingLatencyMs);
            if (this.pingHistory.length > this.maxPingHistory)
                this.pingHistory.pop();
            // 2. Collect DB Stats
            let dbStats = {};
            try {
                dbStats = await db.stats();
            }
            catch (statsErr) {
                // Fallback for limited permission environments
                dbStats = { dataSize: 0, storageSize: 0, indexSize: 0, objects: 0, collections: 0 };
            }
            // 3. Collect Server / Cluster / Topology Info
            let serverStatus = {};
            let helloResult = {};
            try {
                helloResult = await db.command({ hello: 1 }).catch(() => db.command({ isMaster: 1 }));
            }
            catch (hErr) { }
            try {
                serverStatus = await db.command({ serverStatus: 1 });
            }
            catch (sErr) { }
            const isReplicaSet = Boolean(helloResult.setName || serverStatus.repl);
            const replicaSetName = helloResult.setName || serverStatus.repl?.setName || '';
            const hosts = helloResult.hosts || (helloResult.primary ? [helloResult.primary] : []);
            const primaryHost = helloResult.primary || (helloResult.isWritablePrimary ? helloResult.me : '');
            const secondaryCount = Math.max(0, hosts.length - 1);
            const mongoVersion = serverStatus.version || helloResult.version || '6.0+';
            const storageEngine = serverStatus.storageEngine?.name || 'WiredTiger';
            // 4. Connection Counts
            const currentConn = serverStatus.connections?.current || 5;
            const availableConn = serverStatus.connections?.available || 45;
            const totalCreatedConn = serverStatus.connections?.totalCreated || currentConn;
            const totalConnCapacity = currentConn + availableConn;
            const activeConnPercent = totalConnCapacity > 0 ? Math.round((currentConn / totalConnCapacity) * 100) : 10;
            // 5. Collection Breakdown Table
            const collectionsData = [];
            let totalDocsCount = 0;
            let totalIndexCount = 0;
            let totalIndexSize = dbStats.indexSize || 0;
            try {
                const collectionsList = await db.listCollections().toArray();
                for (const col of collectionsList) {
                    if (col.name.startsWith('system.'))
                        continue;
                    try {
                        const colStats = await db.command({ collStats: col.name }).catch(() => null);
                        const docCount = colStats?.count ?? (await db.collection(col.name).estimatedDocumentCount().catch(() => 0));
                        const dataSize = colStats?.size ?? 0;
                        const storageSize = colStats?.storageSize ?? 0;
                        const idxCount = colStats?.nindexes ?? 1;
                        const idxSize = colStats?.totalIndexSize ?? 0;
                        const avgDocSize = colStats?.avgObjSize ?? (docCount > 0 ? Math.round(dataSize / docCount) : 0);
                        totalDocsCount += docCount;
                        totalIndexCount += idxCount;
                        collectionsData.push({
                            name: col.name,
                            documentCount: docCount,
                            dataSizeBytes: dataSize,
                            storageSizeBytes: storageSize,
                            indexCount: idxCount,
                            indexSizeBytes: idxSize,
                            avgDocSizeBytes: avgDocSize,
                            formattedDataSize: this.formatBytes(dataSize),
                            formattedStorageSize: this.formatBytes(storageSize),
                            formattedIndexSize: this.formatBytes(idxSize),
                        });
                    }
                    catch (colErr) { }
                }
            }
            catch (listErr) { }
            // Sort collections by storage size descending
            collectionsData.sort((a, b) => b.storageSizeBytes - a.storageSizeBytes);
            // 6. Slow Queries
            const slowQueries = slowQueryInterceptor_1.slowQueryInterceptor.getRecentSlowQueries();
            // 7. Calculate Health Score & Diagnostics
            const scoreResult = (0, databaseScoreCalculator_1.calculateDatabaseHealthScore)({
                readyState: 1,
                pingLatencyMs,
                availabilityPercent: 99.99,
                failedOperationsCount: 0,
                totalOperationsCount: 100,
                activeConnections: currentConn,
                maxConnections: totalConnCapacity,
                slowQueryCount: slowQueries.length,
            });
            const diagnostics = (0, databaseDiagnostics_1.diagnoseDatabaseFailure)(1, null, pingLatencyMs);
            const dataSizeBytes = dbStats.dataSize || 0;
            const storageSizeBytes = dbStats.storageSize || 0;
            const totalSizeBytes = dataSizeBytes + storageSizeBytes + totalIndexSize;
            this.latestState = {
                connectionState: 'connected',
                readyState: 1,
                healthScore: scoreResult.score,
                status: scoreResult.status,
                pingLatencyMs,
                availabilityPercentage: 99.99,
                slowQueryCount24h: slowQueries.length,
                failedOperations24h: 0,
                databaseSize: {
                    dataSizeBytes,
                    storageSizeBytes,
                    totalSizeBytes,
                    formattedDataSize: this.formatBytes(dataSizeBytes),
                    formattedStorageSize: this.formatBytes(storageSizeBytes),
                },
                totalDocuments: totalDocsCount || dbStats.objects || 0,
                totalCollections: collectionsData.length || dbStats.collections || 0,
                totalIndexes: totalIndexCount || dbStats.indexes || 0,
                totalIndexSizeBytes: totalIndexSize,
                connectionCount: {
                    current: currentConn,
                    available: availableConn,
                    totalCreated: totalCreatedConn,
                    activePercent: activeConnPercent,
                },
                cluster: {
                    isReplicaSet,
                    setName: replicaSetName,
                    hosts,
                    primary: primaryHost,
                    secondaryCount,
                    standalone: !isReplicaSet,
                    storageEngine,
                    version: mongoVersion,
                },
                diagnostics,
                scoreBreakdown: scoreResult.breakdown,
                collections: collectionsData,
                lastCheckedAt: new Date(),
            };
            // 8. Periodically Persist Snapshot & Time-Series Metric (Non-Blocking)
            setImmediate(async () => {
                try {
                    // Update / Upsert single DatabaseHealth document
                    await DatabaseHealth_1.default.findOneAndUpdate({}, { ...this.latestState, timestamp: new Date() }, { upsert: true, new: true });
                    // Append Time-Series Metric
                    await DatabaseMetric_1.default.create({
                        timestamp: new Date(),
                        pingLatencyMs,
                        healthScore: scoreResult.score,
                        activeConnections: currentConn,
                        dataSizeBytes,
                        storageSizeBytes,
                        indexSizeBytes: totalIndexSize,
                        documentsCount: totalDocsCount,
                        slowQueryCount: slowQueries.length,
                        failedOpsCount: 0,
                        opsPerSec: serverStatus.opcounters ? 10 : 0,
                    });
                }
                catch (dbSaveErr) { }
            });
            return this.latestState;
        }
        catch (error) {
            this.latestState = this.getFallbackState(error);
            return this.latestState;
        }
        finally {
            this.isCollecting = false;
        }
    }
}
exports.DatabaseMonitorWorker = DatabaseMonitorWorker;
exports.databaseMonitorWorker = DatabaseMonitorWorker.getInstance();
exports.default = exports.databaseMonitorWorker;
