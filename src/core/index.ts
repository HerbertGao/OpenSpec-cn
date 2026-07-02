// Core OpenSpec logic will be implemented here
export {
  GLOBAL_CONFIG_DIR_NAME,
  GLOBAL_CONFIG_FILE_NAME,
  GLOBAL_DATA_DIR_NAME,
  type GlobalDataDirOptions,
  type GlobalConfig,
  getGlobalConfigDir,
  getGlobalConfigPath,
  getGlobalConfig,
  saveGlobalConfig,
  getGlobalDataDir
} from './global-config.js';

export * from './references.js';
export * from './store/index.js';
export * from './planning-home.js';
export * from './openspec-root.js';

// context-store re-exports, excluding names that collide with store/index.js
// (both modules define assertNoRegisteredStoreConflict and getStoreRootForBackend
// with different config types — the store version is the primary one).
export {
  type ContextStoreBackendConfig,
  type ContextStoreBinding,
  type ContextStoreMetadataState,
  type ContextStoreRegistryEntry,
  type ContextStoreRegistryState,
  type ContextStoreSelector,
  type ResolvedContextStore,
  type ContextStoreDoctorResult,
  type PreparedContextStoreCleanup,
  type PreparedContextStoreSetup,
  type ContextStoreListResult,
  CONTEXT_STORE_METADATA_DIR_NAME,
  CONTEXT_STORE_METADATA_FILE_NAME,
  CONTEXT_STORES_DIR_NAME,
  CONTEXT_STORE_REGISTRY_FILE_NAME,
  ContextStoreError,
  getContextStoresDir,
  getContextStoreRegistryPath,
  getContextStoreMetadataDir,
  getContextStoreMetadataPath,
  validateContextStoreId,
  parseContextStoreMetadataState,
  parseContextStoreRegistryState,
  serializeContextStoreMetadataState,
  serializeContextStoreRegistryState,
  readContextStoreMetadataState,
  readContextStoreRegistryState,
  writeContextStoreMetadataState,
  writeContextStoreRegistryState,
  registerContextStore,
  resolveRegisteredContextStore,
  unregisterContextStoreRegistration,
  listRegisteredContextStores,
  createRegisteredContextStoreBinding,
  createPathContextStoreBinding,
  normalizeContextStoreBinding,
  resolveContextStoreBinding,
  formatContextStoreBinding,
  formatContextStoreBindingSelector,
  sameContextStoreBinding,
  prepareContextStoreSetup,
  setupPreparedContextStore,
  prepareContextStoreCleanup,
  removeContextStore,
  formatContextStoreSelector,
} from './context-store/index.js';
