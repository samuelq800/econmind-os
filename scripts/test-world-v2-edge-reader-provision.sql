\set ON_ERROR_STOP on

create schema world_v2;
create table world_v2.schema_release (
  migration_id text primary key,
  artifact_sha256 text not null,
  source_repo_commit text not null,
  release_order integer not null unique
);

insert into world_v2.schema_release
  (migration_id, artifact_sha256, source_repo_commit, release_order)
select
  'disposable_prior_' || series::text,
  repeat('0', 64),
  repeat('0', 40),
  series
from generate_series(1, 20) as series;

insert into world_v2.schema_release
  (migration_id, artifact_sha256, source_repo_commit, release_order)
values (
  '0021_world_v2_official_full_data_reader',
  'e5c75c9f731283571680647d0447fd88924bf8a1476f67fe71b7c663ead1f670',
  'f2ceea4bce70e8d2a193c641f87af5ce8d2e47e3',
  21
);

create role world_v2_api_reader
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role world_v2_api_login
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
grant world_v2_api_reader to world_v2_api_login;
create table world_v2.country_candidate_artifact (
  bundle_id text, artifact_path text, content_sha256 text, content_utf8 text
);
create table world_v2.country_candidate_bundle (
  bundle_id text, package_manifest_sha256 text, source_status text, activation_allowed boolean
);
grant usage on schema world_v2 to world_v2_api_reader;
grant select (bundle_id, artifact_path, content_sha256, content_utf8)
  on world_v2.country_candidate_artifact to world_v2_api_reader;
grant select (bundle_id, package_manifest_sha256, source_status, activation_allowed)
  on world_v2.country_candidate_bundle to world_v2_api_reader;
