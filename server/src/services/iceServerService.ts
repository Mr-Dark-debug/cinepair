/**
 * @fileoverview ICE server credential service.
 * Generates short-lived, server-side TURN credentials.
 * Client fetches from GET /api/ice-servers — no VITE_TURN_* vars exposed.
 * @module services/iceServerService
 */

import crypto from 'crypto';
import type { AppConfig } from '../config/env.js';
import { createLogger } from '../observability/logger.js';

const logger = createLogger('IceServerService');

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface IceServersResponse {
  iceServers: IceServerConfig[];
  expiresAt: string;
}

export class IceServerService {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  /**
   * Generates ephemeral ICE server configuration.
   * STUN servers are always included.
   * TURN credentials are generated with HMAC if configured.
   */
  getIceServers(): IceServersResponse {
    const iceServers: IceServerConfig[] = [];

    // Always include public STUN servers
    for (const url of this.config.stunUrls) {
      iceServers.push({ urls: url });
    }

    // Generate ephemeral TURN credentials if configured
    if (this.config.turnUrl && this.config.turnCredential) {
      const ttl = this.config.turnTtlSeconds;
      const expiryTimestamp = Math.floor(Date.now() / 1000) + ttl;
      const username = `${expiryTimestamp}:cinepair`;

      // HMAC-SHA1 credential (standard TURN REST API)
      const hmac = crypto.createHmac('sha1', this.config.turnCredential);
      hmac.update(username);
      const credential = hmac.digest('base64');

      iceServers.push({
        urls: this.config.turnUrl,
        username,
        credential,
      });

      logger.debug('Generated ephemeral TURN credentials');
    }

    const expiresAt = new Date(Date.now() + this.config.turnTtlSeconds * 1000).toISOString();

    return { iceServers, expiresAt };
  }
}
