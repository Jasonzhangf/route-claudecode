/**
 * Credential Store
 * Secure storage for provider credentials separated from code
 */

import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface StoredCredentials {
  [key: string]: any;
  encrypted?: boolean;
  createdAt: Date;
  lastAccessed: Date;
}

export class CredentialStore {
  private credentialsPath: string;
  private credentials: Map<string, StoredCredentials> = new Map();
  private initialized: boolean = false;

  constructor() {
    // Store credentials in user's home directory, separate from code
    this.credentialsPath = join(homedir(), '.claude-code-router', 'credentials.json');
  }

  async initialize(): Promise<void> {
    try {
      // Ensure directory exists
      const credentialsDir = join(homedir(), '.claude-code-router');
      try {
        await access(credentialsDir);
      } catch {
        await mkdir(credentialsDir, { recursive: true });
      }

      // Load existing credentials if file exists
      try {
        await access(this.credentialsPath);
        await this.loadCredentials();
      } catch {
        // File doesn't exist, start with empty credentials
        console.log('No existing credentials file found, starting fresh');
      }

      this.initialized = true;
      console.log('✅ CredentialStore initialized');
    } catch (error) {
      throw new Error(`Failed to initialize CredentialStore: ${error.message}`);
    }
  }

  private async loadCredentials(): Promise<void> {
    try {
      const data = await readFile(this.credentialsPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Convert dates back from strings
      for (const [providerName, creds] of Object.entries(parsed)) {
        const credentials = creds as any;
        credentials.createdAt = new Date(credentials.createdAt);
        credentials.lastAccessed = new Date(credentials.lastAccessed);
        this.credentials.set(providerName, credentials);
      }
      
      console.log(`✅ Loaded credentials for ${this.credentials.size} providers`);
    } catch (error) {
      console.error('Failed to load credentials:', error);
      throw error;
    }
  }

  private async saveCredentials(): Promise<void> {
    try {
      const data = Object.fromEntries(this.credentials);
      await writeFile(this.credentialsPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save credentials:', error);
      throw error;
    }
  }

  async storeCredentials(providerName: string, credentials: Record<string, any>): Promise<void> {
    if (!this.initialized) {
      throw new Error('CredentialStore not initialized');
    }

    // Validate credentials
    this.validateCredentials(providerName, credentials);

    const storedCredentials: StoredCredentials = {
      ...credentials,
      createdAt: new Date(),
      lastAccessed: new Date(),
      encrypted: false // TODO: Implement encryption
    };

    this.credentials.set(providerName, storedCredentials);
    await this.saveCredentials();

    console.log(`✅ Credentials stored for provider '${providerName}'`);
  }

  async getCredentials(providerName: string): Promise<Record<string, any> | undefined> {
    if (!this.initialized) {
      throw new Error('CredentialStore not initialized');
    }

    const credentials = this.credentials.get(providerName);
    
    if (!credentials) {
      return undefined;
    }

    // Update last accessed time
    credentials.lastAccessed = new Date();
    await this.saveCredentials();

    // Return credentials without metadata
    const { createdAt, lastAccessed, encrypted, ...actualCredentials } = credentials;
    return actualCredentials;
  }

  async removeCredentials(providerName: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('CredentialStore not initialized');
    }

    this.credentials.delete(providerName);
    await this.saveCredentials();

    console.log(`✅ Credentials removed for provider '${providerName}'`);
  }

  async updateCredentials(providerName: string, newCredentials: Record<string, any>): Promise<void> {
    const existingCredentials = this.credentials.get(providerName);
    
    if (!existingCredentials) {
      await this.storeCredentials(providerName, newCredentials);
      return;
    }

    // Validate new credentials
    this.validateCredentials(providerName, newCredentials);

    const updatedCredentials: StoredCredentials = {
      ...newCredentials,
      createdAt: existingCredentials.createdAt,
      lastAccessed: new Date(),
      encrypted: existingCredentials.encrypted
    };

    this.credentials.set(providerName, updatedCredentials);
    await this.saveCredentials();

    console.log(`✅ Credentials updated for provider '${providerName}'`);
  }

  hasCredentials(providerName: string): boolean {
    return this.credentials.has(providerName);
  }

  getStoredProviders(): string[] {
    return Array.from(this.credentials.keys());
  }

  private validateCredentials(providerName: string, credentials: Record<string, any>): void {
    if (!credentials || typeof credentials !== 'object') {
      throw new Error('Credentials must be an object');
    }

    // Provider-specific validation
    switch (providerName) {
      case 'anthropic':
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-ant-')) {
          throw new Error('Anthropic credentials must include a valid API key starting with sk-ant-');
        }
        break;
        
      case 'openai':
        if (!credentials.apiKey || !credentials.apiKey.startsWith('sk-')) {
          throw new Error('OpenAI credentials must include a valid API key starting with sk-');
        }
        break;
        
      case 'gemini':
        if (!credentials.apiKey || credentials.apiKey.length < 20) {
          throw new Error('Gemini credentials must include a valid API key');
        }
        break;
        
      case 'codewhisperer':
        if (!credentials.accessKeyId || !credentials.secretAccessKey) {
          throw new Error('CodeWhisperer credentials must include accessKeyId and secretAccessKey');
        }
        if (!credentials.accessKeyId.startsWith('AKIA') && !credentials.accessKeyId.startsWith('ASIA')) {
          throw new Error('Invalid AWS access key format');
        }
        break;
        
      default:
        // Basic validation for unknown providers
        if (Object.keys(credentials).length === 0) {
          throw new Error('Credentials cannot be empty');
        }
    }
  }

  // Get credential metadata (without sensitive data)
  getCredentialMetadata(providerName: string): {
    createdAt?: Date;
    lastAccessed?: Date;
    encrypted?: boolean;
  } | undefined {
    const credentials = this.credentials.get(providerName);
    
    if (!credentials) {
      return undefined;
    }

    return {
      createdAt: credentials.createdAt,
      lastAccessed: credentials.lastAccessed,
      encrypted: credentials.encrypted
    };
  }

  // Get all credential metadata
  getAllCredentialMetadata(): Map<string, {
    createdAt: Date;
    lastAccessed: Date;
    encrypted: boolean;
  }> {
    const metadata = new Map();
    
    for (const [providerName, credentials] of this.credentials) {
      metadata.set(providerName, {
        createdAt: credentials.createdAt,
        lastAccessed: credentials.lastAccessed,
        encrypted: credentials.encrypted || false
      });
    }
    
    return metadata;
  }

  // Validate stored credentials format
  async validateStoredCredentials(): Promise<{
    valid: string[];
    invalid: string[];
  }> {
    const result = {
      valid: [] as string[],
      invalid: [] as string[]
    };

    for (const [providerName, credentials] of this.credentials) {
      try {
        const { createdAt, lastAccessed, encrypted, ...actualCredentials } = credentials;
        this.validateCredentials(providerName, actualCredentials);
        result.valid.push(providerName);
      } catch (error) {
        result.invalid.push(providerName);
        console.warn(`Invalid credentials for provider '${providerName}':`, error.message);
      }
    }

    return result;
  }

  // Clean up old credentials (not accessed for a long time)
  async cleanupOldCredentials(daysThreshold: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);
    
    let cleanedCount = 0;
    const toRemove: string[] = [];

    for (const [providerName, credentials] of this.credentials) {
      if (credentials.lastAccessed < cutoffDate) {
        toRemove.push(providerName);
      }
    }

    for (const providerName of toRemove) {
      await this.removeCredentials(providerName);
      cleanedCount++;
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old credentials (not accessed for ${daysThreshold} days)`);
    }

    return cleanedCount;
  }

  // Export credentials (for backup, without sensitive data by default)
  async exportCredentials(includeSensitive: boolean = false): Promise<Record<string, any>> {
    const exported: Record<string, any> = {};

    for (const [providerName, credentials] of this.credentials) {
      if (includeSensitive) {
        exported[providerName] = { ...credentials };
      } else {
        exported[providerName] = {
          createdAt: credentials.createdAt,
          lastAccessed: credentials.lastAccessed,
          encrypted: credentials.encrypted,
          hasApiKey: !!credentials.apiKey,
          hasAccessKeyId: !!credentials.accessKeyId,
          hasSecretAccessKey: !!credentials.secretAccessKey
        };
      }
    }

    return exported;
  }

  // Import credentials (for restore)
  async importCredentials(credentialsData: Record<string, any>): Promise<void> {
    for (const [providerName, credentials] of Object.entries(credentialsData)) {
      try {
        await this.storeCredentials(providerName, credentials);
      } catch (error) {
        console.error(`Failed to import credentials for provider '${providerName}':`, error);
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.credentials.size > 0) {
      await this.saveCredentials();
    }
    
    this.credentials.clear();
    this.initialized = false;
    console.log('✅ CredentialStore shutdown completed');
  }
}

console.log('✅ CredentialStore loaded');