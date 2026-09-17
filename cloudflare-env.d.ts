declare namespace Cloudflare {
  interface Env {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    GITHUB_SESSION_KEY?: string;
    GITHUB_APP_URL?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
