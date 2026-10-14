/**
 * Utilitários para validação e formatação de CPF
 */

/**
 * Remove todos os caracteres não numéricos de uma string
 * @param {string} valor
 * @returns {string}
 */
export const limparCPF = (valor) => {
  if (!valor) return '';
  return valor.toString().replace(/\D/g, '');
};

/**
 * Aplica máscara de CPF (000.000.000-00)
 * @param {string} valor
 * @returns {string}
 */
export const formatarCPF = (valor) => {
  if (!valor) return '';
  const digits = limparCPF(valor).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
};

/**
 * Valida se um CPF possui 11 dígitos e dígitos verificadores válidos segundo o algoritmo oficial
 * @param {string} cpf
 * @returns {boolean}
 */
export const validarCPF = (cpf) => {
  if (!cpf) return false;
  const digits = limparCPF(cpf);

  if (digits.length !== 11) return false;

  // Rejeita sequências de dígitos repetidos (ex: 111.111.111-11)
  if (/^(\d)\1{10}$/.test(digits)) return false;

  // Validação do 1º dígito verificador
  let soma = 0;
  for (let i = 0; i < 9; i++) {
    soma += parseInt(digits.charAt(i), 10) * (10 - i);
  }
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(digits.charAt(9), 10)) return false;

  // Validação do 2º dígito verificador
  soma = 0;
  for (let i = 0; i < 10; i++) {
    soma += parseInt(digits.charAt(i), 10) * (11 - i);
  }
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== parseInt(digits.charAt(10), 10)) return false;

  return true;
};
