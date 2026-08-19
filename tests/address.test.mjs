import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatPostalCode,
  formatViaCepAddress,
  normalizeAddressForGeocoding,
} from '../src/utils/address.ts';

test('formata o retorno do ViaCEP como um endereço geocodificável completo', () => {
  assert.equal(formatPostalCode('81460296'), '81460-296');
  assert.equal(
    formatViaCepAddress({
      cep: '81460-296',
      logradouro: 'Rua Adão Ribeiro dos Santos',
      bairro: 'Cidade Industrial',
      localidade: 'Curitiba',
      uf: 'PR',
    }),
    'Rua Adão Ribeiro dos Santos, Cidade Industrial, Curitiba - PR, CEP 81460-296, Brasil',
  );
});

test('remove separadores que prejudicavam a busca do mapa', () => {
  assert.equal(
    normalizeAddressForGeocoding('Rua das Flores — Centro; Curitiba, PR'),
    'Rua das Flores, Centro, Curitiba, PR',
  );
});
