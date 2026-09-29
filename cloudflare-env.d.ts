declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    IT_SUPPORT_EMAIL?: string;
  }
}
