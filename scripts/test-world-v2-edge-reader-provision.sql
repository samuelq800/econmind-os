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
