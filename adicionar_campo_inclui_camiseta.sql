-- Execute este script no SQL Editor do Supabase para adicionar a coluna inclui_camiseta na tabela apc_evento:

ALTER TABLE public.apc_evento 
ADD COLUMN IF NOT EXISTS inclui_camiseta BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.apc_evento.inclui_camiseta IS 'Indica se o valor da inscrição do evento inclui a camiseta do participante';
