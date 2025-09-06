/**
 * Client Module Tests
 */

import { ClientModule, createClient } from '../index';

describe('Client Module', () => {
  it('should create client module', () => {
    const client = new ClientModule();
    expect(client).toBeDefined();
  });

  it('should create client instance', async () => {
    const client = createClient();
    expect(client).toBeDefined();
  });
});