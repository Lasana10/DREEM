alter table public.students add column if not exists photo_url text;
alter table public.dreem_guardians add column if not exists photo_url text;
alter table public.dreem_student_guardians add column if not exists collector_label text;
alter table public.dreem_student_guardians add column if not exists collector_photo_url text;
alter table public.dreem_student_guardians add column if not exists collection_notes text;
alter table public.dreem_student_credentials add column if not exists card_number text;
alter table public.dreem_student_credentials add column if not exists card_version integer not null default 1;

create unique index if not exists dreem_student_credentials_school_card_number_uidx
  on public.dreem_student_credentials(school_id,card_number)
  where card_number is not null;

comment on column public.students.photo_url is 'School-controlled learner identity photograph URL.';
comment on column public.dreem_guardians.photo_url is 'Guardian identity photograph URL when consent and school policy permit.';
comment on column public.dreem_student_guardians.collector_photo_url is 'Optional photograph for the person authorized to collect this learner.';
comment on column public.dreem_student_credentials.card_number is 'Human-readable credential/card identifier; QR verification remains token based.';