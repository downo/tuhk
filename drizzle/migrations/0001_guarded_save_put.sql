CREATE TABLE public.save_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  state jsonb NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.save_backups TO authenticated;
GRANT ALL ON public.save_backups TO service_role;
ALTER TABLE public.save_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own backups readable" ON public.save_backups FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX save_backups_user_idx ON public.save_backups(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public._save_buildings(_s jsonb)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT coalesce(sum(greatest(0, (value)::text::numeric))::int, 0)
  FROM jsonb_each(CASE WHEN jsonb_typeof(_s->'structures') = 'object' THEN _s->'structures' ELSE '{}'::jsonb END)
  WHERE jsonb_typeof(value) = 'number'
$$;

-- Writes the caller's save only if it was based on the latest stored save; keeps backups before building loss.
CREATE OR REPLACE FUNCTION public.save_put(_state jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE cur jsonb; have int; got int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in'; END IF;
  IF jsonb_typeof(_state) <> 'object' THEN RAISE EXCEPTION 'invalid save'; END IF;
  SELECT state INTO cur FROM saves WHERE user_id = auth.uid() FOR UPDATE;
  IF cur IS NOT NULL THEN
    have := coalesce((cur->>'rev')::int, 0); got := coalesce((_state->>'rev')::int, 0);
    IF have > 0 AND got <> have + 1 THEN RAISE EXCEPTION 'save_conflict'; END IF;
    IF public._save_buildings(_state) < public._save_buildings(cur) THEN
      INSERT INTO save_backups(user_id, state, reason) VALUES (auth.uid(), cur, 'enne-kadu');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM save_backups WHERE user_id = auth.uid() AND created_at > now() - interval '1 day') THEN
      INSERT INTO save_backups(user_id, state, reason) VALUES (auth.uid(), cur, 'paev');
    END IF;
    DELETE FROM save_backups WHERE user_id = auth.uid() AND id NOT IN (SELECT id FROM save_backups WHERE user_id = auth.uid() ORDER BY created_at DESC LIMIT 40);
  END IF;
  INSERT INTO saves(user_id, state, updated_at) VALUES (auth.uid(), _state, now())
  ON CONFLICT (user_id) DO UPDATE SET state = EXCLUDED.state, updated_at = now();
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.save_put(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.save_put(jsonb) TO authenticated;