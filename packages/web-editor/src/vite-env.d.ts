/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MERMAID_WORKSPACE_ROOT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
