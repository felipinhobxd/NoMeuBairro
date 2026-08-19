export type ViaCepAddress = {
  cep?: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

export function formatPostalCode(value: string | undefined) {
  const digits = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (digits.length !== 8) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function normalizeAddressForGeocoding(value: string) {
  return value
    .trim()
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/\s*;\s*/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:,\s*){2,}/g, ', ')
    .replace(/^,\s*|,\s*$/g, '');
}

export function formatViaCepAddress(address: ViaCepAddress) {
  const cityAndState = [address.localidade?.trim(), address.uf?.trim()].filter(Boolean).join(' - ');
  const postalCode = formatPostalCode(address.cep);

  return normalizeAddressForGeocoding([
    address.logradouro?.trim(),
    address.bairro?.trim(),
    cityAndState,
    postalCode ? `CEP ${postalCode}` : '',
    'Brasil',
  ].filter(Boolean).join(', '));
}
