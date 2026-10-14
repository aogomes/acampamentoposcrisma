-- Execute este script no SQL Editor do Supabase para adicionar as colunas
-- de valor por intervalo de idade na tabela apc_evento:

ALTER TABLE public.apc_evento
  ADD COLUMN IF NOT EXISTS valor_diferenciado NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS idade_min_diferenciada INTEGER,
  ADD COLUMN IF NOT EXISTS idade_max_diferenciada INTEGER,
  ADD COLUMN IF NOT EXISTS descricao_valor_diferenciado TEXT;

COMMENT ON COLUMN public.apc_evento.valor_diferenciado IS 'Valor diferenciado do acampamento para determinada faixa etária (ex: 295.00)';
COMMENT ON COLUMN public.apc_evento.idade_min_diferenciada IS 'Idade mínima para aplicação do valor diferenciado (ex: 8)';
COMMENT ON COLUMN public.apc_evento.idade_max_diferenciada IS 'Idade máxima para aplicação do valor diferenciado (ex: 12)';
COMMENT ON COLUMN public.apc_evento.descricao_valor_diferenciado IS 'Descrição/identificação da faixa (ex: Crianças de 8 a 12 anos)';
