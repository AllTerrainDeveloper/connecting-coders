export interface Attempt {
  stateHash: string;
  viewer: string;
  verifier: string;
  expires: number;
}
export interface Session {
  idHash: string;
  viewer: string;
  token: string;
  login: string;
  expires: number;
}
export interface AuthStore {
  saveAttempt(attempt: Attempt): Promise<void>;
  consumeAttempt(
    stateHash: string,
    viewer: string,
    now: number,
  ): Promise<Attempt | null>;
  saveSession(session: Session): Promise<void>;
  getSession(
    idHash: string,
    viewer: string,
    now: number,
  ): Promise<Session | null>;
  deleteSession(idHash: string, viewer: string): Promise<void>;
  cleanup(now: number): Promise<void>;
}
export class D1AuthStore implements AuthStore {
  constructor(private db: D1Database) {}
  async saveAttempt(a: Attempt) {
    await this.db
      .prepare(
        "INSERT INTO github_oauth_attempts (state_hash, viewer, verifier, expires) VALUES (?, ?, ?, ?)",
      )
      .bind(a.stateHash, a.viewer, a.verifier, a.expires)
      .run();
  }
  async consumeAttempt(id: string, viewer: string, now: number) {
    return this.db
      .prepare(
        "DELETE FROM github_oauth_attempts WHERE state_hash = ? AND viewer = ? AND expires > ? RETURNING state_hash AS stateHash, viewer, verifier, expires",
      )
      .bind(id, viewer, now)
      .first<Attempt>();
  }
  async saveSession(s: Session) {
    await this.db
      .prepare(
        "INSERT INTO github_sessions (id_hash, viewer, token, login, expires) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(s.idHash, s.viewer, s.token, s.login, s.expires)
      .run();
  }
  async getSession(id: string, viewer: string, now: number) {
    return this.db
      .prepare(
        "SELECT id_hash AS idHash, viewer, token, login, expires FROM github_sessions WHERE id_hash = ? AND viewer = ? AND expires > ?",
      )
      .bind(id, viewer, now)
      .first<Session>();
  }
  async deleteSession(id: string, viewer: string) {
    await this.db
      .prepare("DELETE FROM github_sessions WHERE id_hash = ? AND viewer = ?")
      .bind(id, viewer)
      .run();
  }
  async cleanup(now: number) {
    await this.db.batch([
      this.db
        .prepare("DELETE FROM github_oauth_attempts WHERE expires <= ?")
        .bind(now),
      this.db
        .prepare("DELETE FROM github_sessions WHERE expires <= ?")
        .bind(now),
    ]);
  }
}
