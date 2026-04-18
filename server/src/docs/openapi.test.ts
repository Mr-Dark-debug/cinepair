import { describe, expect, it } from 'vitest';
import { openApiSpec } from './openapi.js';

describe('openApiSpec', () => {
  it('declares the expected OpenAPI version and API title', () => {
    expect(openApiSpec.openapi).toBe('3.0.3');
    expect(openApiSpec.info.title).toBe('CinePair Signaling API');
  });

  it('documents the operational HTTP endpoints', () => {
    expect(openApiSpec.paths).toHaveProperty('/health');
    expect(openApiSpec.paths).toHaveProperty('/ready');
    expect(openApiSpec.paths).toHaveProperty('/config/public');
    expect(openApiSpec.paths).toHaveProperty('/api/ice-servers');
    expect(openApiSpec.paths).toHaveProperty('/metrics');
    expect(openApiSpec.paths).toHaveProperty('/openapi.json');
    expect(openApiSpec.paths).toHaveProperty('/api/openapi.json');
    expect(openApiSpec.paths).toHaveProperty('/docs');
    expect(openApiSpec.paths).toHaveProperty('/api/docs');
  });

  it('includes reusable response schemas for health, config, and errors', () => {
    expect(openApiSpec.components.schemas).toHaveProperty('HealthResponse');
    expect(openApiSpec.components.schemas).toHaveProperty(
      'PublicConfigResponse',
    );
    expect(openApiSpec.components.schemas).toHaveProperty('IceServersResponse');
    expect(openApiSpec.components.schemas).toHaveProperty('ErrorResponse');
  });
});
