drop policy if exists dreem_transport_assignments_read on public.dreem_transport_assignments;
create policy dreem_transport_assignments_read
on public.dreem_transport_assignments
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','transport_manager','driver','auditor'])
  or private.dreem_is_family_of_student(school_id,student_id)
);

drop policy if exists dreem_transport_routes_read on public.dreem_transport_routes;
create policy dreem_transport_routes_read
on public.dreem_transport_routes
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','transport_manager','driver','auditor'])
  or exists (
    select 1 from public.dreem_transport_assignments a
    where a.route_id=dreem_transport_routes.id
      and a.school_id=dreem_transport_routes.school_id
      and a.status='active'
      and private.dreem_is_family_of_student(a.school_id,a.student_id)
  )
);

drop policy if exists dreem_transport_stops_read on public.dreem_transport_stops;
create policy dreem_transport_stops_read
on public.dreem_transport_stops
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','transport_manager','driver','auditor'])
  or exists (
    select 1 from public.dreem_transport_assignments a
    where a.route_id=dreem_transport_stops.route_id
      and a.school_id=dreem_transport_stops.school_id
      and a.status='active'
      and private.dreem_is_family_of_student(a.school_id,a.student_id)
  )
);

drop policy if exists dreem_transport_trips_read on public.dreem_transport_trips;
create policy dreem_transport_trips_read
on public.dreem_transport_trips
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','transport_manager','driver','auditor'])
  or exists (
    select 1 from public.dreem_transport_assignments a
    where a.route_id=dreem_transport_trips.route_id
      and a.school_id=dreem_transport_trips.school_id
      and a.status='active'
      and private.dreem_is_family_of_student(a.school_id,a.student_id)
  )
);

drop policy if exists dreem_transport_trip_events_read on public.dreem_transport_trip_events;
create policy dreem_transport_trip_events_read
on public.dreem_transport_trip_events
for select
to authenticated
using (
  private.dreem_has_role(school_id,array['platform_founder','school_owner','principal','administrator','transport_manager','driver','auditor'])
  or exists (
    select 1
    from public.dreem_transport_trips t
    join public.dreem_transport_assignments a
      on a.route_id=t.route_id
     and a.school_id=t.school_id
     and a.status='active'
    where t.id=dreem_transport_trip_events.trip_id
      and t.school_id=dreem_transport_trip_events.school_id
      and private.dreem_is_family_of_student(a.school_id,a.student_id)
  )
);
