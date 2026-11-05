/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** server：账号与数据保存在 Student OS 服务器；未设置时为浏览器本地账号 */
  readonly VITE_AUTH_MODE?: 'server' | 'local';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
