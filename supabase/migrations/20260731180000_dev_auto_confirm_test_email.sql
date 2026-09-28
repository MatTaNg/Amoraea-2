-- Dev-only: auto-confirm mattang5280@gmail.com so signup/login skips the confirmation email step.
-- Callable from anon (post-signup, pre-session) and authenticated clients.

CREATE OR REPLACE FUNCTION public.dev_auto_confirm_test_email(
  p_email text,
  p_user_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_email constant text := 'mattang5280@gmail.com';
  normalized text;
  updated_count int;
BEGIN
  normalized := lower(trim(coalesce(p_email, '')));
  IF normalized != target_email THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NOT NULL THEN
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = p_user_id
      AND lower(trim(coalesce(email, ''))) = target_email;
  ELSE
    UPDATE auth.users
    SET
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE lower(trim(coalesce(email, ''))) = target_email;
  END IF;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count = 0 THEN
    RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002';
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.dev_auto_confirm_test_email(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dev_auto_confirm_test_email(text, uuid) TO anon, authenticated;

COMMENT ON FUNCTION public.dev_auto_confirm_test_email(text, uuid) IS
  'Dev-only: marks mattang5280@gmail.com as email-confirmed for faster testing.';

-- Confirm any existing unconfirmed row for the test account.
DO $$
BEGIN
  PERFORM public.dev_auto_confirm_test_email('mattang5280@gmail.com');
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'dev_auto_confirm_test_email one-off skipped: %', SQLERRM;
END;
$$;
