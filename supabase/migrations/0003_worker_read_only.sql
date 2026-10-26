-- Punëtori nuk shkruan drejtpërdrejt në tabela: çdo shkrim kalon vetëm nga sync_shift(),
-- përndryshe mund t'i ndryshonte orët e veta me API-n (p.sh. started_at prapa në kohë).
drop policy if exists shifts_worker_insert on shifts;
drop policy if exists shifts_worker_stop on shifts;
drop policy if exists breaks_worker_write on breaks;
