-- Candidate snapshot from the public Team page collected 2026-11-15.
-- Reconcile against the current Team page before running; this does not activate it.
begin;
insert into public.organization_directory (name, title, organizational_group, region, legacy_name, focus, sort_order, public_visible)
values
  ('Samuel', 'Initial Founder', 'founding-team', null, 'Samuel', '["Product","Economic Simulation","Academic Development"]'::jsonb, 0, true),
  ('Yale', 'Initial Founder', 'founding-team', null, 'Yale', '["Research","League Development","Partnerships"]'::jsonb, 1, true),
  ('Richard', 'Co-Founder', 'regional-leadership', 'East China & National A-Level', 'Richard', '[]'::jsonb, 2, true),
  ('Angela', 'East China & National A-Level Lead', 'regional-leadership', 'East China & National A-Level', 'Angela', '[]'::jsonb, 3, true),
  ('Aria', 'International Relations Lead', 'regional-leadership', 'International', 'Aria', '[]'::jsonb, 4, true),
  ('Clement', 'Jiangsu Regional Lead', 'regional-leadership', 'Jiangsu', 'Clement', '[]'::jsonb, 5, true),
  ('Emma', 'Beijing Regional Lead', 'regional-leadership', 'Beijing', 'Emma', '[]'::jsonb, 6, true),
  ('Ivy', 'South China Regional Lead', 'regional-leadership', 'South China', 'Ivy', '[]'::jsonb, 7, true),
  ('Jessie', 'Jiangxi Regional Lead', 'regional-leadership', 'Jiangxi', 'Jessie', '[]'::jsonb, 8, true),
  ('Leon Xue', 'Jiangsu Regional Lead', 'regional-leadership', 'Jiangsu', 'Leon Xue', '[]'::jsonb, 9, true),
  ('Olivia', 'Beijing Regional Lead', 'regional-leadership', 'Beijing', 'Olivia', '[]'::jsonb, 10, true),
  ('Rae', 'Shandong Regional Lead', 'regional-leadership', 'Shandong', 'Rae', '[]'::jsonb, 11, true),
  ('Scarlett', 'Northeast China Regional Lead', 'regional-leadership', 'Northeast China (Liaoning, Jilin & Heilongjiang)', 'Scarlett', '[]'::jsonb, 12, true),
  ('Sophia Cai', 'Zhejiang Regional Lead', 'regional-leadership', 'Zhejiang', 'Sophia Cai', '[]'::jsonb, 13, true),
  ('Sophia Liu', 'Beijing Regional Lead', 'regional-leadership', 'Beijing', 'Sophia Liu', '[]'::jsonb, 14, true),
  ('Trione', 'Southwest China Regional Lead', 'regional-leadership', 'Southwest China', 'Trione', '[]'::jsonb, 15, true),
  ('Vader', 'Jiangsu Regional Lead', 'regional-leadership', 'Jiangsu', 'Vader', '[]'::jsonb, 16, true),
  ('Aria', 'Xiaohongshu, Instagram, YouTube & X', 'communications-team', 'Communications Department', 'Aria', '[]'::jsonb, 17, true),
  ('Irene', 'Bilibili, Douyin & Video Editing', 'communications-team', 'Communications Department', 'Irene', '[]'::jsonb, 18, true),
  ('Jessie', 'WeChat Official Account', 'communications-team', 'Communications Department', 'Jessie', '[]'::jsonb, 19, true),
  ('Olivia', 'Bilibili, Douyin & Video Editing', 'communications-team', 'Communications Department', 'Olivia', '[]'::jsonb, 20, true),
  ('Philip', 'Douyin Propagandist', 'communications-team', 'Communications Department', 'Philip', '[]'::jsonb, 21, true),
  ('Regina', 'Bilibili, Douyin & Video Editing', 'communications-team', 'Communications Department', 'Regina', '[]'::jsonb, 22, true),
  ('Yale', 'Design Coordinator', 'communications-team', 'Communications Department', 'Yale', '[]'::jsonb, 23, true),
  ('David', 'Technology Department', 'technology-team', 'Technology Department', 'David', '[]'::jsonb, 24, true),
  ('Samuel', 'Technology Department', 'technology-team', 'Technology Department', 'Samuel', '[]'::jsonb, 25, true)
on conflict (organizational_group, legacy_name) where legacy_name is not null do nothing;
commit;
