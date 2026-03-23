-- Make existing registrations support both legacy user-based entries and new device-based kiosk entries
ALTER TABLE public.friday_registrations
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.friday_registrations
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_label text;

-- Ensure every registration belongs either to a user or a device
ALTER TABLE public.friday_registrations
  DROP CONSTRAINT IF EXISTS friday_registrations_identity_check;

ALTER TABLE public.friday_registrations
  ADD CONSTRAINT friday_registrations_identity_check
  CHECK (user_id IS NOT NULL OR device_id IS NOT NULL);

-- Prevent duplicate registrations per legacy user/date and per device/date
CREATE UNIQUE INDEX IF NOT EXISTS friday_registrations_user_unique_idx
  ON public.friday_registrations (friday_date, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS friday_registrations_device_unique_idx
  ON public.friday_registrations (friday_date, device_id)
  WHERE device_id IS NOT NULL;

-- Secret kitchen access links (stored server-side; no public read access)
CREATE TABLE IF NOT EXISTS public.kitchen_access_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT 'Küche',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kitchen_access_links ENABLE ROW LEVEL SECURITY;

-- Remove old policies on friday_registrations; access will go through backend functions
DROP POLICY IF EXISTS "Users can view own registrations" ON public.friday_registrations;
DROP POLICY IF EXISTS "Admin and Küche can view all registrations" ON public.friday_registrations;
DROP POLICY IF EXISTS "Users can insert own registration" ON public.friday_registrations;
DROP POLICY IF EXISTS "Users can delete own registration" ON public.friday_registrations;

-- Legacy authenticated read for old signed-in users if needed during transition
CREATE POLICY "Authenticated users can view own legacy registrations"
ON public.friday_registrations
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- No anonymous direct table access; public flows must use backend functions
-- Seed one kitchen token if none exists yet
INSERT INTO public.kitchen_access_links (token, label)
SELECT encode(gen_random_bytes(24), 'hex'), 'Küche'
WHERE NOT EXISTS (
  SELECT 1 FROM public.kitchen_access_links WHERE active = true
);