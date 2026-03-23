-- Public device-based registration helpers
CREATE OR REPLACE FUNCTION public.register_device_for_friday(
  _friday_date date,
  _device_id text,
  _device_label text DEFAULT NULL
)
RETURNS TABLE (success boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _device_id IS NULL OR btrim(_device_id) = '' THEN
    RETURN QUERY SELECT false, 'device_id_required'::text;
    RETURN;
  END IF;

  INSERT INTO public.friday_registrations (friday_date, device_id, device_label)
  VALUES (_friday_date, btrim(_device_id), NULLIF(btrim(_device_label), ''))
  ON CONFLICT (friday_date, device_id) WHERE device_id IS NOT NULL DO NOTHING;

  IF EXISTS (
    SELECT 1
    FROM public.friday_registrations
    WHERE friday_date = _friday_date
      AND device_id = btrim(_device_id)
  ) THEN
    RETURN QUERY SELECT true, 'registered'::text;
  ELSE
    RETURN QUERY SELECT false, 'registration_failed'::text;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.unregister_device_for_friday(
  _friday_date date,
  _device_id text
)
RETURNS TABLE (success boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _device_id IS NULL OR btrim(_device_id) = '' THEN
    RETURN QUERY SELECT false;
    RETURN;
  END IF;

  DELETE FROM public.friday_registrations
  WHERE friday_date = _friday_date
    AND device_id = btrim(_device_id);

  RETURN QUERY SELECT true;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_device_registration_dates(
  _friday_dates date[],
  _device_id text
)
RETURNS TABLE (friday_date date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fr.friday_date
  FROM public.friday_registrations fr
  WHERE fr.device_id = btrim(_device_id)
    AND fr.friday_date = ANY(_friday_dates);
$$;

CREATE OR REPLACE FUNCTION public.verify_kitchen_token(
  _token text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.kitchen_access_links kal
    WHERE kal.token = btrim(_token)
      AND kal.active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.get_kitchen_friday_counts(
  _friday_dates date[],
  _token text
)
RETURNS TABLE (friday_date date, registrations bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_kitchen_token(_token) THEN
    RAISE EXCEPTION 'invalid_kitchen_token';
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

REVOKE ALL ON FUNCTION public.register_device_for_friday(date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unregister_device_for_friday(date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_device_registration_dates(date[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_kitchen_token(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_kitchen_friday_counts(date[], text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.register_device_for_friday(date, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unregister_device_for_friday(date, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_device_registration_dates(date[], text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_kitchen_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_kitchen_friday_counts(date[], text) TO anon, authenticated;