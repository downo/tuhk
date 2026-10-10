-- Restore the Data API grants the remix's empty migration set no longer carries.
-- Grants are aligned with the existing RLS policies (direct browser reads/writes only).

GRANT SELECT ON public.saves TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.saves TO authenticated;

GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

GRANT SELECT ON public.weekly_contrib TO anon, authenticated;
GRANT INSERT, UPDATE ON public.weekly_contrib TO authenticated;

GRANT SELECT ON public.season_contrib TO anon, authenticated;
GRANT INSERT, UPDATE ON public.season_contrib TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.chat_messages TO authenticated;

GRANT SELECT ON public.clans TO anon, authenticated;
GRANT SELECT ON public.clan_members TO anon, authenticated;
GRANT SELECT ON public.clan_stash TO authenticated;
GRANT SELECT ON public.clan_wars TO anon, authenticated;
GRANT SELECT ON public.gifts TO authenticated;
GRANT SELECT ON public.market_offers TO authenticated;
GRANT SELECT ON public.player_quests TO authenticated;
GRANT SELECT ON public.territories TO anon, authenticated;

GRANT ALL ON public.saves, public.profiles, public.weekly_contrib, public.season_contrib, public.chat_messages, public.clans, public.clan_members, public.clan_stash, public.clan_wars, public.gifts, public.market_offers, public.player_quests, public.territories TO service_role;

GRANT EXECUTE ON FUNCTION public._valid_item(text), public.claim_territory(text), public.clan_raid(uuid), public.create_clan(text), public.gift_claim(), public.gift_send(text, text, integer), public.is_clan_member(uuid, uuid), public.join_clan(uuid), public.leave_clan(), public.market_accept(uuid), public.market_cancel(uuid), public.market_claim(), public.market_post(text, integer, text, integer), public.my_clan(), public.quest_cancel(uuid), public.quest_claim(), public.quest_fulfill(uuid), public.quest_post(text, text, integer, text, integer), public.stash_deposit(text, integer), public.stash_withdraw(text, integer) TO anon, authenticated;
