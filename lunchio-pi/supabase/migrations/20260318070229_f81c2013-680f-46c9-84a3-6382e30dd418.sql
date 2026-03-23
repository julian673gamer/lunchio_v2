ALTER TABLE public.kitchen_access_links
ADD COLUMN IF NOT EXISTS pin text;

UPDATE public.kitchen_access_links
SET pin = token
WHERE pin IS NULL;

ALTER TABLE public.kitchen_access_links
ALTER COLUMN pin SET NOT NULL;

DROP FUNCTION IF EXISTS public.get_kitchen_friday_counts(date[], text);

CREATE OR REPLACE FUNCTION public.verify_kitchen_pin(_pin text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kitchen_access_links kal
    WHERE kal.pin = btrim(_pin)
      AND kal.active = true
  );
$$;

CREATE FUNCTION public.get_kitchen_friday_counts(_friday_dates date[], _pin text)
RETURNS TABLE(friday_date date, registrations bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _pin IS NULL OR btrim(_pin) = '' OR NOT public.verify_kitchen_pin(_pin) THEN
    RAISE EXCEPTION 'invalid_kitchen_pin';
  END IF;

  RETURN QUERY
  SELECT d.friday_date, COUNT(fr.id)::bigint AS registrations
  FROM unnest(_friday_dates) AS d(friday_date)
  LEFT JOIN public.friday_registrations fr
    ON fr.friday_date = d.friday_date
  GROUP BY d.friday_date
  ORDER BY d.friday_date;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_kitchen_pin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_kitchen_friday_counts(date[], text) TO anon, authenticated;