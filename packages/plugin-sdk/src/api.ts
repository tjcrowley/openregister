import type { PluginManifest } from './manifest.js';

export interface PluginContext {
  merchantId: string;
  locationId: string;
  pluginId: string;
}

export interface PluginAPI {
  context: PluginContext;

  catalog: {
    getProduct(id: string): Promise<unknown>;
    listProducts(filter?: { categoryId?: string; search?: string }): Promise<unknown[]>;
  };

  sales: {
    getRecentSales(limit?: number): Promise<unknown[]>;
  };

  events: {
    emit(eventType: string, payload: unknown): Promise<void>;
    subscribe(eventType: string, handler: (payload: unknown) => void): () => void;
  };

  ui: {
    showToast(message: string, type?: 'info' | 'success' | 'error'): void;
    showModal(component: string, props?: unknown): Promise<unknown>;
  };

  storage: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
}

export interface Plugin {
  manifest: PluginManifest;
  install(api: PluginAPI): Promise<void>;
  uninstall(): Promise<void>;
}
