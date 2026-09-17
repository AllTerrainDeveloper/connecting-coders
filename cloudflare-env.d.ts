declare namespace Cloudflare {
  interface Env {
    GITHUB_TOKEN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
