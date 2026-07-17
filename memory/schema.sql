-- VENUS Memory Schema (SQLite)

CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    type        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    outcome     TEXT
);

CREATE TABLE IF NOT EXISTS patterns (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    pattern     TEXT    NOT NULL UNIQUE,
    frequency   INTEGER NOT NULL DEFAULT 1,
    success_rate REAL   NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS rules (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    rule         TEXT    NOT NULL,
    created      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    last_updated TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_events_type      ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts        ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_type_ts   ON events(type, timestamp);
CREATE INDEX IF NOT EXISTS idx_patterns_freq    ON patterns(frequency DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_sr      ON patterns(success_rate DESC);
