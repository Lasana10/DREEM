-- Keep institutional authority RPCs unavailable to anonymous callers.
revoke execute on function public.dreem_has_authority(uuid,text) from anon;
revoke execute on function public.dreem_list_my_school_contexts() from anon;
revoke execute on function public.dreem_set_position(uuid,uuid,text,text,text[]) from anon;
revoke execute on function public.dreem_upsert_school_position(uuid,uuid,text,text,text,text[]) from anon;
revoke execute on function public.dreem_assign_school_position(uuid,uuid,uuid,boolean) from anon;
revoke execute on function public.dreem_end_school_position_assignment(uuid,uuid) from anon;

grant execute on function public.dreem_has_authority(uuid,text) to authenticated;
grant execute on function public.dreem_list_my_school_contexts() to authenticated;
grant execute on function public.dreem_set_position(uuid,uuid,text,text,text[]) to authenticated;
grant execute on function public.dreem_upsert_school_position(uuid,uuid,text,text,text,text[]) to authenticated;
grant execute on function public.dreem_assign_school_position(uuid,uuid,uuid,boolean) to authenticated;
grant execute on function public.dreem_end_school_position_assignment(uuid,uuid) to authenticated;
