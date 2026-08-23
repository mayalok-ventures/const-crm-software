/**
 * Database Diagnostics Engine
 * Classifies failure states to clearly distinguish:
 * 1. Application Down / Process Blocked
 * 2. Database Down / Disconnected
 * 3. Network Failure / DNS / Timeout
 */

export type FailureMode = 'HEALTHY' | 'APP_ISSUE' | 'DB_DOWN' | 'NETWORK_FAILURE';

export interface DiagnosticResult {
  mode: FailureMode;
  title: string;
  message: string;
  isOperational: boolean;
  recoveryAdvice: string;
}

export function diagnoseDatabaseFailure(
  readyState: number,
  error?: any,
  pingLatencyMs?: number,
  eventLoopLagMs?: number
): DiagnosticResult {
  // 1. HEALTHY STATE
  if (readyState === 1 && (!error || error === null)) {
    if (eventLoopLagMs && eventLoopLagMs > 300) {
      return {
        mode: 'APP_ISSUE',
        title: 'Application Event Loop Degraded',
        message: `MongoDB is connected, but Node.js process is experiencing high event loop delay (${Math.round(
          eventLoopLagMs
        )}ms).`,
        isOperational: true,
        recoveryAdvice:
          'Investigate CPU-heavy synchronous JavaScript execution or optimize Node.js worker threads.',
      };
    }

    return {
      mode: 'HEALTHY',
      title: 'Database Operational',
      message: `MongoDB is connected and responsive (${pingLatencyMs ? Math.round(pingLatencyMs) : 5}ms ping).`,
      isOperational: true,
      recoveryAdvice: 'No action required. Database operating under nominal parameters.',
    };
  }

  // 2. ERROR ANALYSIS
  const errCode = error?.code || '';
  const errMsg = String(error?.message || error || '').toLowerCase();

  // 2.1 NETWORK FAILURES (DNS, Socket Timeout, Host Unreachable)
  const isDnsError = errCode === 'ENOTFOUND' || errMsg.includes('getaddrinfo enotfound');
  const isNetworkTimeout =
    errCode === 'ETIMEDOUT' ||
    errCode === 'ESOCKETTIMEDOUT' ||
    errMsg.includes('serverselectiontimeout') ||
    errMsg.includes('socket timeout') ||
    errMsg.includes('connection timed out');
  const isHostUnreachable =
    errCode === 'EHOSTUNREACH' ||
    errCode === 'ENETUNREACH' ||
    errMsg.includes('network unreachable');

  if (isDnsError || isNetworkTimeout || isHostUnreachable) {
    return {
      mode: 'NETWORK_FAILURE',
      title: 'Network & Connectivity Failure',
      message: isDnsError
        ? 'DNS resolution failure for MongoDB cluster host. Network cannot locate database domain.'
        : 'Socket or server selection timeout reaching MongoDB. Cloud or VPC network connection dropped.',
      isOperational: false,
      recoveryAdvice:
        'Verify AWS VPC security groups, outbound internet connectivity, NAT gateway, and DNS resolver configuration.',
    };
  }

  // 2.2 DATABASE DOWN / DISCONNECTED
  const isConnRefused = errCode === 'ECONNREFUSED' || errMsg.includes('connection refused');
  const isAuthFailed = errMsg.includes('authentication failed') || errMsg.includes('auth error');
  const isDisconnectedState = readyState === 0;

  if (isConnRefused || isDisconnectedState || isAuthFailed) {
    return {
      mode: 'DB_DOWN',
      title: 'Database Down / Disconnected',
      message: isConnRefused
        ? 'MongoDB service refused connection on target port. MongoDB process may be stopped.'
        : isAuthFailed
        ? 'MongoDB rejected credentials. Check database user roles and authentication database.'
        : 'Mongoose connection is in disconnected state (readyState: 0).',
      isOperational: false,
      recoveryAdvice:
        'Verify MongoDB service daemon status (`sudo systemctl status mongod`) or MongoDB Atlas cluster availability.',
    };
  }

  // 2.3 APPLICATION DOWN / UNINITIALIZED
  if (readyState === 2) {
    return {
      mode: 'APP_ISSUE',
      title: 'Connecting / Initializing',
      message: 'MongoDB connection is currently in progress (readyState: 2).',
      isOperational: false,
      recoveryAdvice: 'Wait for initial connection handshake or inspect Node.js startup sequence.',
    };
  }

  return {
    mode: 'DB_DOWN',
    title: 'Database Unavailable',
    message: errMsg || 'Database connection error detected.',
    isOperational: false,
    recoveryAdvice: 'Review backend server logs and MongoDB diagnostic logs for root cause.',
  };
}

export default {
  diagnoseDatabaseFailure,
};
