
-- Roles enum and user_roles table (FIRST)
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '⚽',
  color TEXT NOT NULL DEFAULT '#dc2626',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Only admins can manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  balance NUMERIC NOT NULL DEFAULT 500,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_bet_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bets table
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  bet_type TEXT NOT NULL CHECK (bet_type IN ('1x2', '12', 'multi')),
  options JSONB NOT NULL DEFAULT '[]',
  ends_at TIMESTAMPTZ NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  winning_option TEXT,
  bet_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bets are viewable by everyone" ON public.bets FOR SELECT USING (true);
CREATE POLICY "Only admins can manage bets" ON public.bets FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Placed bets table
CREATE TABLE public.placed_bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bet_id UUID REFERENCES public.bets(id) ON DELETE CASCADE NOT NULL,
  selected_option TEXT NOT NULL,
  stake NUMERIC NOT NULL,
  odds_at_time NUMERIC NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'won', 'lost')),
  payout NUMERIC DEFAULT 0,
  coupon_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.placed_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own placed bets" ON public.placed_bets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own placed bets" ON public.placed_bets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all placed bets" ON public.placed_bets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update placed bets" ON public.placed_bets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Coupons table
CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  total_odds NUMERIC NOT NULL DEFAULT 1,
  stake NUMERIC NOT NULL,
  payout NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own coupons" ON public.coupons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own coupons" ON public.coupons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage coupons" ON public.coupons FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Bet proposals table
CREATE TABLE public.bet_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  bet_type TEXT NOT NULL CHECK (bet_type IN ('1x2', '12', 'multi')),
  options JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bet_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own proposals" ON public.bet_proposals FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own proposals" ON public.bet_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage proposals" ON public.bet_proposals FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Badges table
CREATE TABLE public.badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  badge_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, badge_key)
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges viewable by everyone" ON public.badges FOR SELECT USING (true);

-- Function to increment bet count
CREATE OR REPLACE FUNCTION public.increment_bet_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bets SET bet_count = bet_count + 1 WHERE id = NEW.bet_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_placed_bet_created
  AFTER INSERT ON public.placed_bets
  FOR EACH ROW EXECUTE FUNCTION public.increment_bet_count();

-- Insert default categories
INSERT INTO public.categories (name, emoji, color, sort_order) VALUES
  ('Piłka nożna', '⚽', '#22c55e', 1),
  ('Koszykówka', '🏀', '#f97316', 2),
  ('Tenis', '🎾', '#eab308', 3),
  ('Hokej', '🏒', '#3b82f6', 4),
  ('Esport', '🎮', '#8b5cf6', 5),
  ('MMA / Boks', '🥊', '#ef4444', 6),
  ('Inne', '🎲', '#6b7280', 7);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.placed_bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
