/// <reference types="vite/client" />

// Augments Vite's own (otherwise empty) ImportMetaEnv — without this,
// import.meta.env.VITE_API_BASE_URL would be untyped and TS strict mode
// would flag every read of it.
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
