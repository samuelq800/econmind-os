-- EconMind OS Twelve-Country Interconnected World Economy
-- Extends the existing League tables in place. The original four-country
-- scenario and its historic competition remain untouched.

alter table public.country_templates
  add column if not exists display_name text,
  add column if not exists short_code text,
  add column if not exists category text,
  add column if not exists tagline text,
  add column if not exists description text,
  add column if not exists sector_shares jsonb not null default '{}'::jsonb check (jsonb_typeof(sector_shares) = 'object'),
  add column if not exists macro_modifiers jsonb not null default '{}'::jsonb check (jsonb_typeof(macro_modifiers) = 'object'),
  add column if not exists commodity_capacity jsonb not null default '{}'::jsonb check (jsonb_typeof(commodity_capacity) = 'object'),
  add column if not exists policy_sensitivities jsonb not null default '{}'::jsonb check (jsonb_typeof(policy_sensitivities) = 'object'),
  add column if not exists shock_sensitivities jsonb not null default '{}'::jsonb check (jsonb_typeof(shock_sensitivities) = 'object'),
  add column if not exists viable_strategies jsonb not null default '[]'::jsonb check (jsonb_typeof(viable_strategies) = 'array'),
  add column if not exists visual_identity jsonb not null default '{}'::jsonb check (jsonb_typeof(visual_identity) = 'object'),
  add column if not exists version smallint not null default 1 check (version >= 1),
  add column if not exists status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  add column if not exists published_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists config_hash text,
  add column if not exists is_active boolean not null default true;

update public.country_templates
set display_name = coalesce(display_name, name), short_code = coalesce(short_code, upper(left(slug, 3))), category = coalesce(category, 'League world'), tagline = coalesce(tagline, specialisation), description = coalesce(description, specialisation), config_hash = coalesce(config_hash, 'legacy-' || slug)
where display_name is null or short_code is null or category is null or tagline is null or description is null or config_hash is null;

alter table public.country_templates
  alter column display_name set not null,
  alter column short_code set not null,
  alter column category set not null,
  alter column tagline set not null,
  alter column description set not null,
  alter column config_hash set not null;

create unique index if not exists country_templates_scenario_short_code_idx on public.country_templates(scenario_id, short_code);
create index if not exists country_templates_active_idx on public.country_templates(scenario_id, status, is_active);

alter table public.competition_countries
  add column if not exists template_version smallint not null default 1,
  add column if not exists immutable_template_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(immutable_template_snapshot) = 'object');

create or replace function public.country_template_snapshot(p_template_id uuid)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', template.id, 'slug', template.slug, 'name', template.name,
    'displayName', template.display_name, 'shortCode', template.short_code,
    'category', template.category, 'tagline', template.tagline,
    'description', template.description, 'version', template.version,
    'configHash', template.config_hash, 'config', template.config,
    'sectorShares', template.sector_shares, 'macroModifiers', template.macro_modifiers,
    'commodityCapacity', template.commodity_capacity,
    'policySensitivities', template.policy_sensitivities,
    'shockSensitivities', template.shock_sensitivities,
    'viableStrategies', template.viable_strategies,
    'visualIdentity', template.visual_identity, 'balanceScore', template.balance_score
  )
  from public.country_templates template where template.id = p_template_id
$$;

create or replace function public.capture_competition_country_template_snapshot()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.country_template_id is distinct from old.country_template_id or new.immutable_template_snapshot = '{}'::jsonb then
    new.template_version := coalesce((select version from public.country_templates where id = new.country_template_id), 1);
    new.immutable_template_snapshot := public.country_template_snapshot(new.country_template_id);
  end if;
  return new;
end; $$;

drop trigger if exists competition_countries_snapshot_template on public.competition_countries;
create trigger competition_countries_snapshot_template before insert or update of country_template_id on public.competition_countries for each row execute function public.capture_competition_country_template_snapshot();

update public.competition_countries country
set template_version = template.version, immutable_template_snapshot = public.country_template_snapshot(country.country_template_id)
from public.country_templates template
where template.id = country.country_template_id and country.immutable_template_snapshot = '{}'::jsonb;

create table if not exists public.scenario_editor_access (
  scenario_id uuid not null references public.scenario_definitions(id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  granted_by uuid references public.profiles(user_id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (scenario_id, user_id)
);
create index if not exists scenario_editor_access_user_idx on public.scenario_editor_access(user_id, scenario_id);

create or replace function public.is_scenario_editor(p_scenario_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin(p_user_id)
    or exists(select 1 from public.scenario_editor_access access where access.scenario_id = p_scenario_id and access.user_id = p_user_id)
$$;

alter table public.scenario_editor_access enable row level security;
drop policy if exists scenario_editor_access_read on public.scenario_editor_access;
create policy scenario_editor_access_read on public.scenario_editor_access for select to authenticated using (user_id = auth.uid() or public.is_platform_admin());
drop policy if exists scenario_editor_access_admin_manage on public.scenario_editor_access;
create policy scenario_editor_access_admin_manage on public.scenario_editor_access for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists scenario_definitions_admin_manage on public.scenario_definitions;
drop policy if exists scenario_definitions_editor_manage on public.scenario_definitions;
drop policy if exists scenario_definitions_platform_insert on public.scenario_definitions;
drop policy if exists scenario_definitions_editor_read on public.scenario_definitions;
create policy scenario_definitions_editor_manage on public.scenario_definitions for update to authenticated using (public.is_scenario_editor(id)) with check (public.is_scenario_editor(id));
create policy scenario_definitions_platform_insert on public.scenario_definitions for insert to authenticated with check (public.is_platform_admin());
create policy scenario_definitions_editor_read on public.scenario_definitions for select to authenticated using (public.is_scenario_editor(id));
drop policy if exists country_templates_admin_manage on public.country_templates;
drop policy if exists country_templates_editor_manage on public.country_templates;
drop policy if exists country_templates_editor_read on public.country_templates;
create policy country_templates_editor_manage on public.country_templates for all to authenticated using (public.is_scenario_editor(scenario_id)) with check (public.is_scenario_editor(scenario_id));
create policy country_templates_editor_read on public.country_templates for select to authenticated using (public.is_scenario_editor(scenario_id));
drop policy if exists scenario_validations_admin_only on public.scenario_validations;
drop policy if exists scenario_validations_editor_read on public.scenario_validations;
drop policy if exists scenario_validations_editor_insert on public.scenario_validations;
create policy scenario_validations_editor_read on public.scenario_validations for select to authenticated using (public.is_scenario_editor(scenario_id));
create policy scenario_validations_editor_insert on public.scenario_validations for insert to authenticated with check (public.is_scenario_editor(scenario_id));

grant select, insert, update, delete on public.scenario_editor_access to authenticated;
grant execute on function public.is_scenario_editor(uuid, uuid), public.country_template_snapshot(uuid) to authenticated;

-- New builder path: snakes are a deterministic two-round school draft option.
create or replace function public.create_league_competition(p_scenario_id uuid, p_name text, p_description text default '', p_assignment_method text default 'manual')
returns public.competitions language plpgsql security definer set search_path = public
as $$
declare created public.competitions%rowtype; rounds_count integer;
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'Platform administrator role required'; end if;
  if p_assignment_method not in ('manual', 'random', 'balanced_random', 'snake_draft') then raise exception 'Invalid country-assignment method'; end if;
  if not exists(select 1 from public.scenario_definitions where id = p_scenario_id and status = 'published') then raise exception 'Only a published scenario can create a competition'; end if;
  insert into public.competitions(scenario_id, name, description, status, config, created_by)
  values(p_scenario_id, trim(p_name), coalesce(p_description, ''), 'registration', jsonb_build_object('countryAssignment', p_assignment_method, 'minimumTeamSize', 1, 'maximumTeamSize', 20, 'observerAccess', 'authenticated_public'), auth.uid())
  returning * into created;
  select coalesce((config ->> 'numberOfRounds')::integer, 3) into rounds_count from public.scenario_definitions where id = p_scenario_id;
  insert into public.competition_countries(competition_id, country_template_id, display_name, status)
  select created.id, template.id, template.display_name, 'unassigned' from public.country_templates template
  where template.scenario_id = p_scenario_id and template.status = 'published' and template.is_active;
  insert into public.competition_rounds(competition_id, round_number)
  select created.id, round_number from generate_series(1, least(3, greatest(1, rounds_count))) as round_number;
  perform public.write_competition_audit(created.id, 'competition_created', 'competition', created.id, jsonb_build_object('scenario_id', p_scenario_id, 'country_assignment', p_assignment_method));
  return created;
end; $$;

-- A published twelve-country world. This is deliberately separate from the
-- legacy four-country scenario and can be safely re-run without duplicates.
insert into public.scenario_definitions(title, slug, description, scenario_type, status, config, created_by, published_at)
select 'Twelve Nations: Interconnected World Economy', 'twelve-nations-interconnected-world', 'A balanced twelve-country, long-running multiplayer world. Countries trade four commodities, coordinate four institutions and carry policy choices into future quarters.', 'league_world', 'published',
  jsonb_build_object('version', 2, 'numberOfCountries', 12, 'numberOfRounds', 3, 'roundDurationSeconds', null, 'enabledAgreements', jsonb_build_array('trade', 'energy_supply', 'investment', 'technology_partnership', 'currency_swap', 'climate_fund'), 'enabledMarkets', jsonb_build_array('energy', 'food', 'manufactured_goods', 'technology_services'), 'scoringWeights', jsonb_build_object('domesticEconomicPerformance',25,'institutionalGovernance',20,'internationalEconomicPosition',15,'crisisResilience',20,'longTermDevelopment',10,'globalContribution',10), 'tradeNetworkRule', jsonb_build_object('minimumPartners',4,'maximumSinglePartnerShare',25,'minimumImportSources',2,'minimumExportMarkets',2), 'assumptions', jsonb_build_array('Twelve countries start within a 96–104 power band.', 'Fiscal deficits are permitted and have delayed consequences.', 'No country holds a commodity monopoly.')),
  (select user_id from public.profiles where platform_role = 'platform_admin' order by created_at limit 1), timezone('utc', now())
where not exists(select 1 from public.scenario_definitions where slug = 'twelve-nations-interconnected-world');

with seed as (
  select value as item from jsonb_array_elements($countries$[
    {"slug":"techoria","name":"Techoria","code":"TEC","category":"Knowledge and Innovation","tagline":"Innovation powered by research, technology and skilled labour.","description":"A research-led economy whose technology exports can compound productivity, but whose skilled labour and investment respond sharply to financial conditions.","specialisation":"Research-led productivity · Technology exports","score":102,"shares":{"manufacturing":18,"technology":30,"services":32,"energy":8,"agriculture":12},"macro":{"populationIndex":100,"realGdpIndex":100,"productivityIndex":105,"inflationRate":3.4,"unemploymentRate":5.8,"governmentDebtPctGdp":65,"foreignReservesIndex":101,"institutionalCapacity":103},"commodities":{"energy":0.8,"food":0.8,"manufactured_goods":0.95,"technology_services":1.25},"advantages":{"technology":8},"vulnerabilities":{"interestRateSensitivity":7,"skilledLabourCostPressure":5},"policy":{"researchEfficiency":7,"technologyPartnership":6},"shocks":{"financial":6,"technology":-4},"strategies":["Research-led productivity growth","Technology exports and international partnerships"],"visual":{"primary":"#4f46e5","secondary":"#a5b4fc","symbol":"orbit","flag":"/league/flags/techoria.svg"},"modifiers":{"productivityModifier":5,"fiscalModifier":0,"tradeModifier":2,"resourceModifier":-1,"capitalAttractionModifier":3}},
    {"slug":"meditoria","name":"Meditoria","code":"MED","category":"Knowledge and Human Capital","tagline":"A service economy built around education, healthcare and human capital.","description":"Human capital and professional services are its durable route to growth, balanced by longer lags and a visible public-service fiscal commitment.","specialisation":"Human capital · Professional services","score":100,"shares":{"manufacturing":14,"technology":18,"services":43,"energy":8,"agriculture":17},"macro":{"populationIndex":101,"realGdpIndex":100,"productivityIndex":103,"inflationRate":3.5,"unemploymentRate":5.7,"governmentDebtPctGdp":67,"foreignReservesIndex":100,"institutionalCapacity":102},"commodities":{"energy":0.85,"food":0.95,"manufactured_goods":0.85,"technology_services":1.18},"advantages":{"services":7,"technology":3},"vulnerabilities":{"publicServiceFiscalPressure":6,"longPolicyLag":5},"policy":{"educationReturn":8,"publicServiceLag":5},"shocks":{"fiscal":5,"labour":-3},"strategies":["Public education and long-run productivity","Healthcare, professional services and biotechnology exports"],"visual":{"primary":"#0f766e","secondary":"#99f6e4","symbol":"column","flag":"/league/flags/meditoria.svg"},"modifiers":{"productivityModifier":3,"fiscalModifier":-2,"tradeModifier":1,"resourceModifier":-1,"capitalAttractionModifier":1}},
    {"slug":"culturia","name":"Culturia","code":"CUL","category":"Knowledge and Creative Services","tagline":"A creative and service economy shaped by tourism, culture and global demand.","description":"Culturia converts openness and creative capacity into service employment, while global confidence and exchange-rate changes transmit quickly through its economy.","specialisation":"Creative-service exports · Digital media","score":98,"shares":{"manufacturing":12,"technology":17,"services":49,"energy":7,"agriculture":15},"macro":{"populationIndex":99,"realGdpIndex":98,"productivityIndex":100,"inflationRate":3.6,"unemploymentRate":6.2,"governmentDebtPctGdp":65,"foreignReservesIndex":98,"institutionalCapacity":99},"commodities":{"energy":0.8,"food":0.9,"manufactured_goods":0.8,"technology_services":1.12},"advantages":{"services":8,"technology":2},"vulnerabilities":{"consumerConfidenceSensitivity":8,"exchangeRateSensitivity":5},"policy":{"marketOpening":6,"exchangeRateExportBoost":5},"shocks":{"globalDemand":8,"currency":5},"strategies":["Tourism and creative-service exports","Digital media and creative technology"],"visual":{"primary":"#be185d","secondary":"#f9a8d4","symbol":"wave","flag":"/league/flags/culturia.svg"},"modifiers":{"productivityModifier":1,"fiscalModifier":-1,"tradeModifier":4,"resourceModifier":-2,"capitalAttractionModifier":0}},
    {"slug":"manufactura","name":"Manufactura","code":"MAN","category":"Production and Industry","tagline":"An export-oriented economy driven by manufacturing and industrial employment.","description":"Industrial scale and employment absorption support two upgrade paths, but imported energy and changes in global demand are central vulnerabilities.","specialisation":"Export manufacturing · Automation upgrade","score":102,"shares":{"manufacturing":34,"technology":16,"services":25,"energy":13,"agriculture":12},"macro":{"populationIndex":103,"realGdpIndex":102,"productivityIndex":101,"inflationRate":3.7,"unemploymentRate":5.6,"governmentDebtPctGdp":66,"foreignReservesIndex":100,"institutionalCapacity":100},"commodities":{"energy":0.9,"food":0.85,"manufactured_goods":1.25,"technology_services":0.95},"advantages":{"manufacturing":9},"vulnerabilities":{"importedEnergyDependency":8,"globalDemandSensitivity":6},"policy":{"infrastructureMultiplier":7,"technologyImportProductivity":5},"shocks":{"energy":8,"globalDemand":6},"strategies":["Export manufacturing","Automation and high-value manufacturing"],"visual":{"primary":"#c2410c","secondary":"#fdba74","symbol":"grid","flag":"/league/flags/manufactura.svg"},"modifiers":{"productivityModifier":1,"fiscalModifier":-1,"tradeModifier":5,"resourceModifier":1,"capitalAttractionModifier":0}},
    {"slug":"materia","name":"Materia","code":"MAT","category":"Production and Resources","tagline":"A materials economy connecting natural resources with industrial processing.","description":"Materia can turn resource processing into higher-value industrial exports, but commodity volatility and environmental pressure punish an undiversified path.","specialisation":"Industrial materials · Value-chain upgrading","score":101,"shares":{"manufacturing":28,"technology":13,"services":24,"energy":23,"agriculture":12},"macro":{"populationIndex":100,"realGdpIndex":101,"productivityIndex":98,"inflationRate":3.5,"unemploymentRate":6,"governmentDebtPctGdp":63,"foreignReservesIndex":103,"institutionalCapacity":100},"commodities":{"energy":1.1,"food":0.9,"manufactured_goods":1.15,"technology_services":0.85},"advantages":{"manufacturing":6,"energy":4},"vulnerabilities":{"environmentalPressure":7,"commodityPriceVolatility":6},"policy":{"processingUpgrade":7,"resourceDepletionCost":6},"shocks":{"commodity":6,"climate":4},"strategies":["Industrial-material exports","Resource processing and value-chain upgrading"],"visual":{"primary":"#a16207","secondary":"#fde68a","symbol":"facet","flag":"/league/flags/materia.svg"},"modifiers":{"productivityModifier":-2,"fiscalModifier":2,"tradeModifier":3,"resourceModifier":4,"capitalAttractionModifier":0}},
    {"slug":"agritania","name":"Agritania","code":"AGR","category":"Production and Land Resources","tagline":"A land-rich economy specialising in food security and agricultural production.","description":"Agritania can pair food exports with agricultural technology, yet climate exposure and a productivity constraint keep its two development routes distinct.","specialisation":"Food security · Agricultural technology","score":97,"shares":{"manufacturing":16,"technology":12,"services":26,"energy":10,"agriculture":36},"macro":{"populationIndex":98,"realGdpIndex":97,"productivityIndex":95,"inflationRate":3.8,"unemploymentRate":6.3,"governmentDebtPctGdp":64,"foreignReservesIndex":100,"institutionalCapacity":99},"commodities":{"energy":0.9,"food":1.3,"manufactured_goods":0.85,"technology_services":0.8},"advantages":{"services":1},"vulnerabilities":{"climateVulnerability":8,"productivityConstraint":5},"policy":{"agricultureInvestment":8,"technologyImportRelief":5},"shocks":{"climate":8,"food":-4},"strategies":["Food security and agricultural exports","Agricultural technology and productivity upgrading"],"visual":{"primary":"#4d7c0f","secondary":"#bef264","symbol":"field","flag":"/league/flags/agritania.svg"},"modifiers":{"productivityModifier":-5,"fiscalModifier":1,"tradeModifier":3,"resourceModifier":4,"capitalAttractionModifier":-2}},
    {"slug":"greenovia","name":"Greenovia","code":"GRN","category":"Energy and Sustainability","tagline":"A transition economy investing in renewable energy and environmental resilience.","description":"Its early green investments are costly, but renewable capacity and emissions efficiency offer a resilient long-run route and export potential.","specialisation":"Green transition · Renewable technology exports","score":101,"shares":{"manufacturing":20,"technology":19,"services":29,"energy":20,"agriculture":12},"macro":{"populationIndex":100,"realGdpIndex":100,"productivityIndex":101,"inflationRate":3.3,"unemploymentRate":6,"governmentDebtPctGdp":67,"foreignReservesIndex":99,"institutionalCapacity":104},"commodities":{"energy":1.15,"food":0.95,"manufactured_goods":1,"technology_services":1.05},"advantages":{"energy":8,"technology":3},"vulnerabilities":{"initialInvestmentCost":6,"shortRunFiscalPressure":5},"policy":{"greenInvestmentReturn":8,"energyShockResilience":7},"shocks":{"energy":-5,"climate":-4},"strategies":["Domestic green transition","Renewable technology exports"],"visual":{"primary":"#047857","secondary":"#6ee7b7","symbol":"leaf","flag":"/league/flags/greenovia.svg"},"modifiers":{"productivityModifier":1,"fiscalModifier":-2,"tradeModifier":1,"resourceModifier":4,"capitalAttractionModifier":1}},
    {"slug":"energea","name":"Energea","code":"ENG","category":"Energy and Strategic Supply","tagline":"A diversified energy producer balancing export revenues with economic transition.","description":"Energy exports offer fiscal capacity and a path to diversification, but price volatility and concentration make strategic reinvestment essential.","specialisation":"Energy exports · Industrial diversification","score":100,"shares":{"manufacturing":22,"technology":13,"services":24,"energy":30,"agriculture":11},"macro":{"populationIndex":100,"realGdpIndex":102,"productivityIndex":97,"inflationRate":3.4,"unemploymentRate":6.1,"governmentDebtPctGdp":62,"foreignReservesIndex":105,"institutionalCapacity":100},"commodities":{"energy":1.3,"food":0.85,"manufactured_goods":1,"technology_services":0.85},"advantages":{"energy":9},"vulnerabilities":{"energyPriceVolatility":8,"diversificationWeakness":6},"policy":{"energyRevenue":7,"diversificationInvestment":7},"shocks":{"energy":8,"climate":5},"strategies":["Energy exports and fiscal accumulation","Energy-funded industrial diversification"],"visual":{"primary":"#b45309","secondary":"#fcd34d","symbol":"beam","flag":"/league/flags/energea.svg"},"modifiers":{"productivityModifier":-3,"fiscalModifier":3,"tradeModifier":3,"resourceModifier":5,"capitalAttractionModifier":1}},
    {"slug":"constructa","name":"Constructa","code":"CON","category":"Infrastructure and Urban Development","tagline":"An infrastructure economy centred on construction, housing and urban productivity.","description":"Build-out investment can create immediate and delayed gains, yet debt sensitivity and a construction cycle require careful fiscal pacing.","specialisation":"Infrastructure-led growth · Urban productivity","score":99,"shares":{"manufacturing":30,"technology":12,"services":31,"energy":15,"agriculture":12},"macro":{"populationIndex":104,"realGdpIndex":103,"productivityIndex":99,"inflationRate":3.5,"unemploymentRate":6,"governmentDebtPctGdp":68,"foreignReservesIndex":100,"institutionalCapacity":100},"commodities":{"energy":1,"food":0.9,"manufactured_goods":1.2,"technology_services":0.85},"advantages":{"manufacturing":6,"services":3},"vulnerabilities":{"debtSensitivity":7,"constructionCycleVolatility":5},"policy":{"infrastructureEfficiency":8,"landConstraint":5},"shocks":{"financial":7,"commodity":3},"strategies":["Infrastructure-led growth","Housing reform and urban productivity"],"visual":{"primary":"#0369a1","secondary":"#7dd3fc","symbol":"arch","flag":"/league/flags/constructa.svg"},"modifiers":{"productivityModifier":-1,"fiscalModifier":-3,"tradeModifier":2,"resourceModifier":0,"capitalAttractionModifier":0}},
    {"slug":"financora","name":"Financora","code":"FIN","category":"Finance and Services","tagline":"A financial and commercial-service economy integrated into global capital markets.","description":"Financora attracts capital and intermediates finance efficiently, but confidence reversals and contagion make its financial stability a live policy challenge.","specialisation":"International finance · Productive long-term finance","score":103,"shares":{"manufacturing":12,"technology":19,"services":52,"energy":8,"agriculture":9},"macro":{"populationIndex":99,"realGdpIndex":99,"productivityIndex":104,"inflationRate":3.2,"unemploymentRate":5.9,"governmentDebtPctGdp":64,"foreignReservesIndex":104,"institutionalCapacity":103},"commodities":{"energy":0.85,"food":0.85,"manufactured_goods":0.8,"technology_services":1.15},"advantages":{"services":8,"technology":4},"vulnerabilities":{"capitalFlowVolatility":8,"financialContagionRisk":6},"policy":{"credibilityCapitalFlow":8,"currencySwapBenefit":6},"shocks":{"financial":8,"currency":5},"strategies":["International financial centre","Domestic long-term finance and productive investment"],"visual":{"primary":"#7e22ce","secondary":"#d8b4fe","symbol":"node","flag":"/league/flags/financora.svg"},"modifiers":{"productivityModifier":4,"fiscalModifier":1,"tradeModifier":3,"resourceModifier":1,"capitalAttractionModifier":4}},
    {"slug":"logistica","name":"Logistica","code":"LOG","category":"Trade and Connectivity","tagline":"A logistics and trade hub connecting regional supply chains and markets.","description":"Low transport costs and reliable trade links create a connectivity path, while fuel costs and external demand can quickly alter its fortunes.","specialisation":"Global logistics · Supply-chain integration","score":101,"shares":{"manufacturing":24,"technology":15,"services":44,"energy":9,"agriculture":8},"macro":{"populationIndex":97,"realGdpIndex":99,"productivityIndex":102,"inflationRate":3.6,"unemploymentRate":5.8,"governmentDebtPctGdp":63,"foreignReservesIndex":102,"institutionalCapacity":101},"commodities":{"energy":0.85,"food":0.9,"manufactured_goods":1.1,"technology_services":1},"advantages":{"services":6,"manufacturing":3},"vulnerabilities":{"externalDemandDependency":7,"fuelCostSensitivity":5},"policy":{"transportEfficiency":9,"tradeAgreementDelivery":6},"shocks":{"trade":7,"energy":5},"strategies":["Global logistics hub","Regional supply-chain integration"],"visual":{"primary":"#075985","secondary":"#67e8f9","symbol":"route","flag":"/league/flags/logistica.svg"},"modifiers":{"productivityModifier":2,"fiscalModifier":2,"tradeModifier":5,"resourceModifier":-1,"capitalAttractionModifier":1}},
    {"slug":"centravia","name":"Centravia","code":"CEN","category":"Diversified Domestic Market","tagline":"A balanced economy supported by a large domestic market and diversified production.","description":"Centravia absorbs shocks through a broad domestic market and diversified sectors, trading peak export specialisation for steadier policy choices.","specialisation":"Domestic-demand growth · Diversified regional economy","score":99,"shares":{"manufacturing":22,"technology":18,"services":38,"energy":11,"agriculture":11},"macro":{"populationIndex":105,"realGdpIndex":103,"productivityIndex":100,"inflationRate":3.5,"unemploymentRate":5.5,"governmentDebtPctGdp":69,"foreignReservesIndex":101,"institutionalCapacity":101},"commodities":{"energy":0.95,"food":1.05,"manufactured_goods":1,"technology_services":0.95},"advantages":{"services":4,"manufacturing":2,"technology":2},"vulnerabilities":{"exportSpecialisationLimit":5,"welfarePublicServicePressure":6},"policy":{"domesticDemandSupport":8,"welfareResponse":6},"shocks":{"globalDemand":-4,"fiscal":5},"strategies":["Domestic-demand-led growth","Diversified regional economy"],"visual":{"primary":"#334155","secondary":"#cbd5e1","symbol":"ring","flag":"/league/flags/centravia.svg"},"modifiers":{"productivityModifier":0,"fiscalModifier":-3,"tradeModifier":0,"resourceModifier":1,"capitalAttractionModifier":0}}
  ]$countries$::jsonb)
)
insert into public.country_templates(scenario_id, slug, name, display_name, short_code, category, tagline, description, specialisation, config, sector_shares, macro_modifiers, commodity_capacity, policy_sensitivities, shock_sensitivities, viable_strategies, visual_identity, balance_score, version, status, published_at, config_hash, is_active)
select scenario.id, item->>'slug', item->>'name', item->>'name', item->>'code', item->>'category', item->>'tagline', item->>'description', item->>'specialisation',
  jsonb_build_object('version', 1, 'sectorAdvantages', item->'advantages', 'commodityAdvantages', item->'commodities', 'vulnerabilities', item->'vulnerabilities') || item->'modifiers',
  item->'shares', item->'macro', item->'commodities', item->'policy', item->'shocks', item->'strategies', item->'visual', (item->>'score')::numeric, 1, 'published', timezone('utc', now()), 'twelve-country-v1-' || (item->>'slug'), true
from public.scenario_definitions scenario cross join seed
where scenario.slug = 'twelve-nations-interconnected-world'
on conflict (scenario_id, slug) do update set
  name = excluded.name, display_name = excluded.display_name, short_code = excluded.short_code, category = excluded.category, tagline = excluded.tagline, description = excluded.description, specialisation = excluded.specialisation, config = excluded.config, sector_shares = excluded.sector_shares, macro_modifiers = excluded.macro_modifiers, commodity_capacity = excluded.commodity_capacity, policy_sensitivities = excluded.policy_sensitivities, shock_sensitivities = excluded.shock_sensitivities, viable_strategies = excluded.viable_strategies, visual_identity = excluded.visual_identity, balance_score = excluded.balance_score, version = excluded.version, config_hash = excluded.config_hash, is_active = excluded.is_active
where public.country_templates.status = 'draft' or public.country_templates.config_hash = excluded.config_hash;

insert into public.competitions(scenario_id, name, description, status, current_round, round_duration_seconds, leaderboard_visibility, config, created_by, started_at)
select scenario.id, 'EconMind Twelve Nations World League', 'A long-running twelve-country world. Registration is open; teachers assign countries and manually advance each quarterly settlement.', 'registration', 1, null, 'after_round', jsonb_build_object('countryAssignment', 'balanced_random', 'longRunning', true, 'openIndividualRegistration', true, 'defaultCompetition', true), (select user_id from public.profiles where platform_role = 'platform_admin' order by created_at limit 1), timezone('utc', now())
from public.scenario_definitions scenario where scenario.slug = 'twelve-nations-interconnected-world'
on conflict (name) do nothing;

insert into public.competition_countries(competition_id, country_template_id, display_name, status)
select competition.id, template.id, template.display_name, 'unassigned'
from public.competitions competition
join public.scenario_definitions scenario on scenario.id = competition.scenario_id
join public.country_templates template on template.scenario_id = scenario.id
where competition.name = 'EconMind Twelve Nations World League' and template.status = 'published' and template.is_active
on conflict (competition_id, country_template_id) do nothing;

insert into public.competition_rounds(competition_id, round_number, status)
select competition.id, round_number, 'pending'
from public.competitions competition cross join (values (1), (2), (3)) as round_seed(round_number)
where competition.name = 'EconMind Twelve Nations World League'
on conflict (competition_id, round_number) do nothing;

grant execute on function public.create_league_competition(uuid, text, text, text) to authenticated;

-- The twelve-nation default is open to individual registered users.  Legacy
-- school-team competitions retain the original team-membership gate.
create or replace function public.claim_competition_role(p_competition_id uuid, p_country_id uuid, p_role_type text, p_is_captain boolean default false)
returns public.competition_roles language plpgsql security definer set search_path = public
as $$
declare
  country_row public.competition_countries%rowtype;
  competition_config jsonb;
  created public.competition_roles%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_role_type not in ('country_captain', 'central_bank_governor', 'economic_policy_minister', 'trade_minister', 'investment_resources_minister') then
    raise exception 'Invalid competition role';
  end if;
  select country.*
    into country_row
  from public.competition_countries country
  join public.competitions competition on competition.id = country.competition_id
  where country.id = p_country_id and country.competition_id = p_competition_id;
  if not found then raise exception 'Country is not part of this competition'; end if;
  select config into competition_config from public.competitions where id = p_competition_id;
  if not coalesce((competition_config ->> 'openIndividualRegistration')::boolean, false)
     and (country_row.assigned_team_id is null or not public.is_team_member(country_row.assigned_team_id, auth.uid())) then
    raise exception 'Only a member of the assigned team can claim this role';
  end if;
  if not exists(select 1 from public.competitions where id = p_competition_id and status in ('registration', 'country_assignment', 'role_assignment')) then
    raise exception 'Roles cannot be claimed in the current competition state';
  end if;
  insert into public.competition_roles(competition_id, country_id, user_id, role_type, is_captain, assigned_by)
  values(p_competition_id, p_country_id, auth.uid(), p_role_type, p_is_captain or p_role_type = 'country_captain', auth.uid())
  returning * into created;
  perform public.write_competition_audit(p_competition_id, 'role_claimed', 'competition_role', created.id, jsonb_build_object('country_id', p_country_id, 'role_type', p_role_type, 'open_individual_registration', coalesce((competition_config ->> 'openIndividualRegistration')::boolean, false)));
  return created;
exception when unique_violation then
  raise exception 'This role has already been claimed';
end; $$;

grant execute on function public.claim_competition_role(uuid, uuid, text, boolean) to authenticated;
