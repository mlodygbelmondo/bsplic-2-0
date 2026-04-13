-- Allow admin corrections to both credit and debit balances.
CREATE OR REPLACE FUNCTION public.admin_credit_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance NUMERIC;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Brak uprawnień';
  END IF;

  IF p_amount IS NULL OR p_amount = 0 THEN
    RAISE EXCEPTION 'Kwota nie może być równa 0';
  END IF;

  IF p_amount <> ROUND(p_amount, 2) THEN
    RAISE EXCEPTION 'Kwota może mieć maksymalnie 2 miejsca po przecinku';
  END IF;

  UPDATE public.profiles
     SET balance = ROUND(balance + p_amount, 2)
   WHERE id = p_user_id
   RETURNING balance INTO v_new_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nie znaleziono użytkownika';
  END IF;

  RETURN v_new_balance;
END;
$$;
