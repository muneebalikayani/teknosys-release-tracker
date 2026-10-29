-- ====================================================================
-- TEKNOSYS RELEASE TRACKER — SUPABASE / POSTGRESQL SCHEMA & SEED DATA
-- ====================================================================
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It creates the tables, sets up Row Level Security (RLS), and seeds all
-- 37 releases and 21 public holidays.
-- ====================================================================

-- 1. Create Releases Table
CREATE TABLE IF NOT EXISTS public.releases (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  ritm TEXT DEFAULT '',
  cr TEXT DEFAULT '',
  developer TEXT DEFAULT '',
  version TEXT DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'GSM',
  type TEXT NOT NULL DEFAULT 'Scheduled',
  start_date DATE,
  target_deploy DATE NOT NULL,
  stage TEXT NOT NULL DEFAULT 'Development',
  owner TEXT NOT NULL DEFAULT 'Dev Team',
  status TEXT NOT NULL DEFAULT 'On Track',
  db_objects TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  email TEXT DEFAULT '',
  holiday_conflict TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Public Holidays Table
CREATE TABLE IF NOT EXISTS public.holidays (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- 4. Create Public Access Policies (Read, Insert, Update, Delete)
-- For team collaboration, allow public access via the anon API key
DROP POLICY IF EXISTS "Public access for releases" ON public.releases;
CREATE POLICY "Public access for releases" 
ON public.releases FOR ALL 
USING (true) 
WITH CHECK (true);

DROP POLICY IF EXISTS "Public access for holidays" ON public.holidays;
CREATE POLICY "Public access for holidays" 
ON public.holidays FOR ALL 
USING (true) 
WITH CHECK (true);

-- 5. Enable Realtime Replication (Safe / Idempotent)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'releases'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.releases;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'holidays'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.holidays;
    END IF;
  END IF;
END $$;

-- 6. Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_releases_timestamp ON public.releases;
CREATE TRIGGER set_releases_timestamp
BEFORE UPDATE ON public.releases
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

DROP TRIGGER IF EXISTS set_holidays_timestamp ON public.holidays;
CREATE TRIGGER set_holidays_timestamp
BEFORE UPDATE ON public.holidays
FOR EACH ROW
EXECUTE FUNCTION update_modified_column();

-- ====================================================================
-- 7. SEED DATA: 21 PUBLIC HOLIDAYS
-- ====================================================================
INSERT INTO public.holidays (id, name, start_date, end_date, notes) VALUES
(1, 'Kashmir Day', '2026-02-05', '2026-02-05', 'Fixed public holiday'),
(2, 'Eid-ul-Fitr', '2026-03-20', '2026-03-21', 'Tentative (moon sighting)'),
(3, 'Pakistan Day', '2026-03-23', '2026-03-23', 'Fixed public holiday'),
(4, 'Labour Day', '2026-05-01', '2026-05-01', 'Fixed public holiday'),
(5, 'Eid-ul-Adha', '2026-05-27', '2026-05-29', 'Tentative (3 days)'),
(6, 'Youm-e-Takbeer', '2026-05-28', '2026-05-28', 'Fixed public holiday'),
(7, 'Ashura (9th-10th Muharram)', '2026-06-25', '2026-06-26', 'Tentative (Islamic calendar)'),
(8, 'Independence Day', '2026-08-14', '2026-08-14', 'Fixed public holiday'),
(9, 'Eid Milad-un-Nabi', '2026-08-26', '2026-08-26', 'Tentative (moon sighting)'),
(10, 'Iqbal Day', '2026-11-09', '2026-11-09', 'Fixed public holiday'),
(11, 'Quaid-e-Azam Day / Christmas', '2026-12-25', '2026-12-25', 'Fixed public holiday'),
(12, 'Kashmir Day', '2027-02-05', '2027-02-05', 'Fixed public holiday'),
(13, 'Eid-ul-Fitr', '2027-03-10', '2027-03-12', 'Tentative (moon sighting)'),
(14, 'Pakistan Day', '2027-03-23', '2027-03-23', 'Fixed public holiday'),
(15, 'Labour Day', '2027-05-01', '2027-05-01', 'Fixed public holiday'),
(16, 'Eid-ul-Adha', '2027-05-17', '2027-05-19', 'Tentative (3 days)'),
(17, 'Youm-e-Takbeer', '2027-05-28', '2027-05-28', 'Fixed public holiday'),
(18, 'Ashura (9th-10th Muharram)', '2027-06-14', '2027-06-15', 'Tentative (Islamic calendar)'),
(19, 'Independence Day', '2027-08-14', '2027-08-14', 'Fixed public holiday'),
(20, 'Eid Milad-un-Nabi', '2027-08-15', '2027-08-15', 'Tentative (moon sighting)'),
(21, 'Iqbal Day', '2027-11-09', '2027-11-09', 'Fixed public holiday')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  notes = EXCLUDED.notes;

-- ====================================================================
-- 8. SEED DATA: 37 RELEASES
-- ====================================================================
INSERT INTO public.releases (id, name, ritm, cr, developer, version, platform, type, start_date, target_deploy, stage, owner, status, db_objects, notes, email, holiday_conflict) VALUES
(1, 'BVS Sales Old Age flag Core', '', '', 'Rabia Qayyum', 'v1', 'GSM', 'Scheduled', '2026-08-04', '2026-08-12', 'Production', 'Ops Team', 'Completed', '', 'Nothing', '', ''),
(2, 'OMNI API table export', '', '', 'Mahum Tariq', 'V1', 'APIs', 'Scheduled', '2026-08-10', '2026-08-12', 'Production', 'Dev Team', 'Completed', '', 'NA', '', ''),
(3, 'Multiplay 90 Days view update', 'RITM0736021', '', 'Adeel Ahmad', 'V1.0', 'GSM', 'Scheduled', '2026-08-05', '2026-08-13', 'Production', 'Ops Team', 'Completed', 'JTR_PRD_01_OPTM_STD_0_V.DWN_5079_POSTPAID_MULTIPLAY_90_DAYS, JTR_PRD_01_SHRD_STD_0_V.POSTPAID_MULTIPLAY_MONTHY', 'Testing signoff was in place', '', ''),
(4, 'M-Wallet Recharges in Advance Recharge Mart', 'RITM0736500', '', 'Muhammad Usman', '', 'DFS', 'Scheduled', '2026-08-05', '2026-08-13', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(5, '5G attribution in SDS Mart', 'RITM0734107', '', 'M. Huzaifa', '', 'GSM', 'Scheduled', '2026-08-04', '2026-08-14', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(6, 'ROX base view update', 'RITM0739818', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-13', '2026-08-15', 'Production', 'Dev Team', 'Completed', '', 'NA', '', ''),
(7, 'UCIP Charging Daily Mart update', 'RITM0741215', '', 'Ali Hamza', '1.0', 'GSM', 'Emergency', '2026-08-16', '2026-08-17', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(8, 'Prepaid Lifecycle view logic', 'RITM0739956', '', 'Abdul Basit', '', 'GSM', 'Scheduled', '2026-08-13', '2026-08-18', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(9, 'UCIP codes enrichment for GameNow', 'RITM0743229', '', 'Ali Hamza', '1.0', 'GSM', 'Emergency', '2026-08-19', '2026-08-20', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(10, 'Subscribers list of 699 for Whitelist plan', 'RITM0742130', '', 'Moheed Imran', '1.0', 'GSM', 'Scheduled', '2026-08-18', '2026-08-20', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(11, 'IP List addition in Tamasha', 'RITM0743329', '', 'Sarmad', '1.0', 'GSM', 'Scheduled', '2026-08-19', '2026-08-20', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(12, 'Digital Funnel Daily Mart for Tamasha', 'RITM0743818', '', 'Moheed Imran', '1.0', 'GSM', 'Scheduled', '2026-08-20', '2026-08-20', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(13, 'B2C Sales enhancement', 'RITM0734007', '', 'Talha', '1.0', 'GSM', 'Scheduled', '2026-08-04', '2026-08-21', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(14, 'Daily KPI table update (Reg base)', 'RITM0739812', '', 'Abdul Basit', '', 'GSM', 'Scheduled', '2026-08-13', '2026-08-21', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(15, 'ReadyCash Recovery in Commutative recovery', 'RITM0741212', '', 'Ali Hamza', '1.0', 'GSM', 'Scheduled', '2026-08-16', '2026-08-21', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(16, 'Revenue in SIT MTD BTEQ script', 'RITM0742131', '', 'Muhammad Usman', '', 'GSM', 'Scheduled', '2026-08-18', '2026-08-21', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(17, 'Ref Data from DFS addition', 'RITM0743819', '', 'Abdul Basit', '', 'GSM', 'Scheduled', '2026-08-20', '2026-08-21', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(18, 'Postpaid Multiplay monthly base script', 'RITM0744778', '', 'Adeel Ahmad', '1.0', 'GSM', 'Scheduled', '2026-08-21', '2026-08-22', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(19, 'Jazz Advance recharge source update', 'RITM0745585', '', 'Ali Hamza', '1.0', 'GSM', 'Emergency', '2026-08-23', '2026-08-24', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(20, 'BVS Sales Semantic View Age flag Addition', 'RITM0745914', '', 'Rabia Qayyum', '', 'GSM', 'Scheduled', '2026-08-24', '2026-08-25', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(21, 'Simosa Hierarchy in Parent Child Live App', 'RITM0744779', '', 'Abdul Basit', '', 'GSM', 'Scheduled', '2026-08-21', '2026-08-26', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(22, 'Dekho lifecycle script modification', 'RITM0747444', '', 'Mahum Tariq', '1.0', 'GSM', 'Scheduled', '2026-08-25', '2026-08-26', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(23, 'CPS license log update in Daily OFT KPI', 'RITM0746973', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-25', '2026-08-27', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(24, 'NBO Sourcing in NBO Base Fact', 'RITM0747063', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-25', '2026-08-27', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(25, '5G tag addition in Sales Fact', 'RITM0747064', '', 'Ali Hamza', '1.0', 'GSM', 'Scheduled', '2026-08-25', '2026-08-27', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(26, 'Postpaid live base flag addition', 'RITM0748110', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-26', '2026-08-27', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(27, 'Dashboard KPI script update Day-Wise', 'RITM0748111', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-26', '2026-08-27', 'Production', 'Ops Team', 'Completed', '', 'Signoff is available', '', ''),
(28, 'Conversion API for Postpaid', 'RITM0748805', '', 'Mahum Tariq', '', 'APIs', 'Scheduled', '2026-08-27', '2026-08-28', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(29, 'IVR API for Jazz CX', 'RITM0748806', '', 'Moheed Imran', '', 'APIs', 'Scheduled', '2026-08-27', '2026-08-28', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(30, 'Fikrfree base mart update', 'RITM0748807', '', 'Sarmad', '', 'GSM', 'Scheduled', '2026-08-27', '2026-08-28', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(31, 'MSPH subscriber summary base', 'RITM0748808', '', 'Talha', '', 'GSM', 'Scheduled', '2026-08-27', '2026-08-28', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(32, 'Discontinuation of Dekho in Hierarchy', 'RITM0745586', '', 'Abdul Basit', '', 'GSM', 'Scheduled', '2026-08-23', '2026-08-28', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(33, 'DFS Wallet Lifecycle in Channel Dimension', 'RITM0744777', '', 'Muhammad Usman', '', 'DFS', 'Scheduled', '2026-08-21', '2026-08-31', 'Production', 'Ops Team', 'Completed', '', 'Deploy successful', '', ''),
(34, 'ROX base view update - Key Attribute', 'RITM0748810', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-27', '2026-08-31', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(35, '5G attribution in SDS Mart v2', 'RITM0748811', '', 'M. Huzaifa', '', 'GSM', 'Scheduled', '2026-08-27', '2026-08-31', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(36, 'Multiplay 90 Days view update v2', 'RITM0748812', '', 'Adeel Ahmad', '', 'GSM', 'Scheduled', '2026-08-27', '2026-08-31', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '', ''),
(37, 'NBO API Sourcing in NBO Base Fact', 'RITM0748813', '', 'Adeel Ahmad', '', 'APIs', 'Scheduled', '2026-08-27', '2026-08-31', 'Production', 'Dev Team', 'Completed', '', 'Signoff is available', '')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  ritm = EXCLUDED.ritm,
  cr = EXCLUDED.cr,
  developer = EXCLUDED.developer,
  version = EXCLUDED.version,
  platform = EXCLUDED.platform,
  type = EXCLUDED.type,
  start_date = EXCLUDED.start_date,
  target_deploy = EXCLUDED.target_deploy,
  stage = EXCLUDED.stage,
  owner = EXCLUDED.owner,
  status = EXCLUDED.status,
  db_objects = EXCLUDED.db_objects,
  notes = EXCLUDED.notes,
  email = EXCLUDED.email,
  holiday_conflict = EXCLUDED.holiday_conflict;

-- ====================================================================
-- SUCCESS VERIFICATION QUERY
-- ====================================================================
SELECT 'Releases count: ' || COUNT(*) FROM public.releases;
SELECT 'Holidays count: ' || COUNT(*) FROM public.holidays;
