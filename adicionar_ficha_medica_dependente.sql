-- =========================================================================
-- MIGRAÇÃO: Ficha Médica e Cuidados de Saúde para Dependentes (apc_dependente)
-- =========================================================================
-- Execute este script no SQL Editor do Supabase para adicionar as colunas
-- de Ficha Médica e Cuidados de Saúde na tabela de dependentes (apc_dependente).

ALTER TABLE public.apc_dependente
  ADD COLUMN IF NOT EXISTS tipo_sanguineo TEXT,
  ADD COLUMN IF NOT EXISTS problema_saude BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS problema_saude_qual TEXT,
  ADD COLUMN IF NOT EXISTS historico_convulsao BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS historico_convulsao_tempo TEXT,
  ADD COLUMN IF NOT EXISTS tratamento_medico BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tratamento_medico_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicamento_continuo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS medicamento_continuo_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicamento_continuo_dosagem TEXT,
  ADD COLUMN IF NOT EXISTS lesao_contusao BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS lesao_contusao_qual TEXT,
  ADD COLUMN IF NOT EXISTS restricao_alimentar BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS restricao_alimentar_qual TEXT,
  ADD COLUMN IF NOT EXISTS doenca_respiratoria BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS usa_bombinha BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_medicamento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_medicamento_qual TEXT,
  ADD COLUMN IF NOT EXISTS alergia_alimento BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS alergia_alimento_qual TEXT,
  ADD COLUMN IF NOT EXISTS cuidado_especial BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS cuidado_especial_qual TEXT,
  ADD COLUMN IF NOT EXISTS medicacao_sintomas TEXT;
