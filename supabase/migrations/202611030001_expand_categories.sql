begin;

alter table public.appointments
  drop constraint if exists appointments_category_check;

alter table public.appointments
  add constraint appointments_category_check
  check (category in (
    'Atendimento',
    'Pessoal',
    'Academia',
    'Igreja',
    'Saúde',
    'Família',
    'Trabalho',
    'Estudos',
    'Lazer',
    'Outros'
  ));

commit;
