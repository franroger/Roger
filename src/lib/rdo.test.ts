import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { lerRdo, importarDiario, importarDias } from './importar';
import { obraExemplo } from './demo';

// RDO preenchido a partir de modelos/RDO-modelo.xlsx (2 dias, 3 serviços).
it('importa o RDO preenchido (produção e dias)', async () => {
  const f = new File([readFileSync(new URL('./__fixtures__/rdo-exemplo.xlsx', import.meta.url))], 'RDO.xlsx');
  const { producao, dias } = await lerRdo(f);
  const o = obraExemplo();
  const p = importarDiario(o, producao);
  const d = importarDias(dias);
  expect(p.avisos).toEqual([]);
  const cod = (id: string) => o.itens.find((i) => i.id === id)?.codigo;
  expect(p.registros.map((r) => [r.data, cod(r.itemId), r.panos?.length ?? null])).toEqual([
    ['2026-11-25', '4.1', 4], // prumada 3, pav. 10 a 7
    ['2026-11-26', '4.1', 4], // prumadas 4-5, pav. 10 a 9
    ['2026-11-26', '3.2', null], // reservatório por quantidade
  ]);
  expect(p.registros[2].quantidade).toBe(30);
  expect(d.registros.map((x) => [x.data, x.condicao, x.horasParadas, x.motivoParalisacao])).toEqual([
    ['2026-11-25', 'praticavel', 0, ''],
    ['2026-11-26', 'parcial', 4, 'Chuva'],
  ]);
});
