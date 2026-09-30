CREATE TABLE media_assets (
 id uuid PRIMARY KEY, app text NOT NULL, owner text NOT NULL,
 mime text NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 width integer NOT NULL CHECK(width>0), height integer NOT NULL CHECK(height>0),
 bytes integer NOT NULL CHECK(bytes>0), checksum text NOT NULL,
 filename text NOT NULL, upload_session uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX media_owner_list ON media_assets(app,owner,created_at DESC,id);
CREATE TABLE media_binary (
 asset_id uuid PRIMARY KEY REFERENCES media_assets(id) ON DELETE CASCADE,
 data bytea NOT NULL
);
CREATE TABLE media_pins (
 asset_id uuid NOT NULL REFERENCES media_assets(id), operation text NOT NULL,
 PRIMARY KEY(asset_id,operation)
);
