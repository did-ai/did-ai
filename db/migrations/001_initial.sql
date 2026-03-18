-- DID Documents table
CREATE TABLE IF NOT EXISTS did_documents (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) UNIQUE NOT NULL,
    document JSONB NOT NULL,
    metadata JSONB NOT NULL,
    version_id INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_did_documents_did ON did_documents(did);
CREATE INDEX IF NOT EXISTS idx_did_documents_controller ON did_documents((document->>'controller'));

-- DID History for versioning
CREATE TABLE IF NOT EXISTS did_history (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) NOT NULL,
    document JSONB NOT NULL,
    metadata JSONB NOT NULL,
    version_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_did_history_did ON did_history(did);
CREATE INDEX IF NOT EXISTS idx_did_history_version ON did_history(did, version_id);

-- Key registry for tracking key usage
CREATE TABLE IF NOT EXISTS key_registry (
    id SERIAL PRIMARY KEY,
    did VARCHAR(255) NOT NULL,
    key_id VARCHAR(255) NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    public_key_multibase VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_registry_did ON key_registry(did);
CREATE INDEX IF NOT EXISTS idx_key_registry_key_id ON key_registry(key_id);
