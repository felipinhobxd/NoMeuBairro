import { createContext, useContext, useState, type ReactNode } from 'react';

export interface Neighborhood {
  name: string;
  latitude: number;
  longitude: number;
  cepExample: string;
  aliases?: string[];
  kind?: 'official' | 'locality';
  parentNeighborhood?: string;
}

export const normalizeNeighborhoodText = (value: string | null | undefined) =>
  (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// 75 bairros oficiais de Curitiba (IPPUC) + Vitória Régia como localidade útil dentro de Tatuquara.
export const curitibaNeighborhoods: Neighborhood[] = [
  { name: 'Abranches', latitude: -25.3725, longitude: -49.2708, cepExample: '82130-010' },
  { name: 'Água Verde', latitude: -25.4519, longitude: -49.2847, cepExample: '80240-000' },
  { name: 'Ahú', latitude: -25.4080, longitude: -49.2600, cepExample: '80540-000' },
  { name: 'Alto Boqueirão', latitude: -25.5300, longitude: -49.2300, cepExample: '81750-000' },
  { name: 'Alto da Glória', latitude: -25.4200, longitude: -49.2600, cepExample: '80030-000' },
  { name: 'Alto da XV', latitude: -25.4300, longitude: -49.2500, cepExample: '80045-000', aliases: ['Alto da Rua XV'] },
  { name: 'Atuba', latitude: -25.3800, longitude: -49.2100, cepExample: '82630-000' },
  { name: 'Augusta', latitude: -25.4800, longitude: -49.3700, cepExample: '81270-000' },
  { name: 'Bacacheri', latitude: -25.3900, longitude: -49.2300, cepExample: '82520-000' },
  { name: 'Bairro Alto', latitude: -25.4000, longitude: -49.2000, cepExample: '82820-000' },
  { name: 'Barreirinha', latitude: -25.3600, longitude: -49.2500, cepExample: '82700-000', aliases: ['Barrerinha'] },
  { name: 'Batel', latitude: -25.4439, longitude: -49.2886, cepExample: '80420-000' },
  { name: 'Bigorrilho', latitude: -25.4358, longitude: -49.3000, cepExample: '80730-000' },
  { name: 'Boa Vista', latitude: -25.3800, longitude: -49.2400, cepExample: '82540-000' },
  { name: 'Bom Retiro', latitude: -25.4100, longitude: -49.2700, cepExample: '80520-000' },
  { name: 'Boqueirão', latitude: -25.5042, longitude: -49.2375, cepExample: '81650-000' },
  { name: 'Butiatuvinha', latitude: -25.3900, longitude: -49.3400, cepExample: '82320-000' },
  { name: 'Cabral', latitude: -25.4086, longitude: -49.2536, cepExample: '80035-000' },
  { name: 'Cachoeira', latitude: -25.3500, longitude: -49.2700, cepExample: '82710-000' },
  { name: 'Cajuru', latitude: -25.4500, longitude: -49.2000, cepExample: '82900-000' },
  { name: 'Campina do Siqueira', latitude: -25.4300, longitude: -49.3000, cepExample: '80740-000' },
  { name: 'Campo Comprido', latitude: -25.4500, longitude: -49.3400, cepExample: '81220-000' },
  { name: 'Campo do Santana', latitude: -25.5800, longitude: -49.3200, cepExample: '81490-000', aliases: ['Campo de Santana'] },
  { name: 'Capão da Imbuia', latitude: -25.4300, longitude: -49.2100, cepExample: '82810-000' },
  { name: 'Capão Raso', latitude: -25.5000, longitude: -49.2900, cepExample: '81130-000' },
  { name: 'Cascatinha', latitude: -25.4000, longitude: -49.3100, cepExample: '82025-000' },
  { name: 'Caximba', latitude: -25.6200, longitude: -49.3300, cepExample: '81490-512' },
  { name: 'Centro', latitude: -25.4297, longitude: -49.2711, cepExample: '80020-000' },
  { name: 'Centro Cívico', latitude: -25.4100, longitude: -49.2600, cepExample: '80530-000' },
  { name: 'Cidade Industrial de Curitiba', latitude: -25.5000, longitude: -49.3500, cepExample: '81310-000', aliases: ['Cidade Industrial', 'CIC'] },
  { name: 'Cristo Rei', latitude: -25.4300, longitude: -49.2400, cepExample: '80050-000' },
  { name: 'Fanny', latitude: -25.4700, longitude: -49.2600, cepExample: '81030-000' },
  { name: 'Fazendinha', latitude: -25.4700, longitude: -49.3200, cepExample: '81320-000' },
  { name: 'Ganchinho', latitude: -25.5600, longitude: -49.2500, cepExample: '81935-000' },
  { name: 'Guabirotuba', latitude: -25.4600, longitude: -49.2300, cepExample: '81510-000' },
  { name: 'Guaíra', latitude: -25.4600, longitude: -49.2700, cepExample: '80630-000' },
  { name: 'Hauer', latitude: -25.4800, longitude: -49.2400, cepExample: '81610-000' },
  { name: 'Hugo Lange', latitude: -25.4200, longitude: -49.2400, cepExample: '80040-270' },
  { name: 'Jardim Botânico', latitude: -25.4431, longitude: -49.2394, cepExample: '80210-000' },
  { name: 'Jardim das Américas', latitude: -25.4500, longitude: -49.2100, cepExample: '81540-000' },
  { name: 'Jardim Social', latitude: -25.4100, longitude: -49.2300, cepExample: '82520-000' },
  { name: 'Juvevê', latitude: -25.4100, longitude: -49.2500, cepExample: '80030-001' },
  { name: 'Lamenha Pequena', latitude: -25.3500, longitude: -49.3100, cepExample: '82130-740' },
  { name: 'Lindóia', latitude: -25.4800, longitude: -49.2600, cepExample: '81010-000' },
  { name: 'Mercês', latitude: -25.4200, longitude: -49.2900, cepExample: '80710-000' },
  { name: 'Mossunguê', latitude: -25.4400, longitude: -49.3300, cepExample: '81200-100' },
  { name: 'Novo Mundo', latitude: -25.4897, longitude: -49.2958, cepExample: '81050-000' },
  { name: 'Órleans', latitude: -25.4200, longitude: -49.3500, cepExample: '82310-000', aliases: ['Orleans'] },
  { name: 'Parolin', latitude: -25.4500, longitude: -49.2600, cepExample: '80220-000', aliases: ['Parolini'] },
  { name: 'Pilarzinho', latitude: -25.3800, longitude: -49.2800, cepExample: '82100-000' },
  { name: 'Pinheirinho', latitude: -25.5100, longitude: -49.2900, cepExample: '81150-000' },
  { name: 'Portão', latitude: -25.4764, longitude: -49.2894, cepExample: '80320-000' },
  { name: 'Prado Velho', latitude: -25.4500, longitude: -49.2500, cepExample: '80215-000' },
  { name: 'Rebouças', latitude: -25.4467, longitude: -49.2661, cepExample: '80230-000' },
  { name: 'Riviera', latitude: -25.4900, longitude: -49.3800, cepExample: '81260-000' },
  { name: 'Santa Cândida', latitude: -25.3700, longitude: -49.2200, cepExample: '82640-000' },
  { name: 'Santa Felicidade', latitude: -25.4022, longitude: -49.3278, cepExample: '82020-000' },
  { name: 'Santa Quitéria', latitude: -25.4600, longitude: -49.3000, cepExample: '80310-000' },
  { name: 'Santo Inácio', latitude: -25.4100, longitude: -49.3300, cepExample: '82010-000' },
  { name: 'São Braz', latitude: -25.4100, longitude: -49.3500, cepExample: '82320-000' },
  { name: 'São Francisco', latitude: -25.4200, longitude: -49.2700, cepExample: '80020-000' },
  { name: 'São João', latitude: -25.4000, longitude: -49.3000, cepExample: '82030-000' },
  { name: 'São Lourenço', latitude: -25.3900, longitude: -49.2600, cepExample: '82210-000' },
  { name: 'São Miguel', latitude: -25.5100, longitude: -49.3800, cepExample: '81450-000' },
  { name: 'Seminário', latitude: -25.4500, longitude: -49.3000, cepExample: '80310-000' },
  { name: 'Sítio Cercado', latitude: -25.5417, longitude: -49.2644, cepExample: '81900-000' },
  { name: 'Taboão', latitude: -25.3700, longitude: -49.2800, cepExample: '82120-000' },
  { name: 'Tarumã', latitude: -25.4200, longitude: -49.2100, cepExample: '82530-000' },
  { name: 'Tatuquara', latitude: -25.5600, longitude: -49.3400, cepExample: '81470-000' },
  { name: 'Tingui', latitude: -25.3900, longitude: -49.2200, cepExample: '82600-000' },
  { name: 'Uberaba', latitude: -25.4794, longitude: -49.2131, cepExample: '81550-000' },
  { name: 'Umbará', latitude: -25.5700, longitude: -49.2700, cepExample: '81940-000' },
  { name: 'Vila Izabel', latitude: -25.4600, longitude: -49.2900, cepExample: '80320-000' },
  { name: 'Vista Alegre', latitude: -25.4100, longitude: -49.3000, cepExample: '80810-000' },
  { name: 'Xaxim', latitude: -25.4900, longitude: -49.2500, cepExample: '81710-000' },
  { name: 'Vitória Régia', latitude: -25.5415, longitude: -49.3375, cepExample: '81470-430', aliases: ['Vitoria Regia'], kind: 'locality', parentNeighborhood: 'Tatuquara' },
].map((item) => ({ kind: 'official' as const, ...item }));

export function findNeighborhood(value: string | null | undefined) {
  const normalized = normalizeNeighborhoodText(value);
  if (!normalized) return undefined;
  return curitibaNeighborhoods.find((item) => {
    if (normalizeNeighborhoodText(item.name) === normalized) return true;
    return (item.aliases || []).some((alias) => normalizeNeighborhoodText(alias) === normalized);
  });
}

export function canonicalNeighborhoodName(value: string | null | undefined) {
  return findNeighborhood(value)?.name || (value || '').trim();
}

export function neighborhoodSearchText(value: string | null | undefined) {
  const found = findNeighborhood(value);
  if (!found) return normalizeNeighborhoodText(value);
  return normalizeNeighborhoodText([found.name, ...(found.aliases || []), found.parentNeighborhood || ''].join(' '));
}

export function neighborhoodMatches(selected: string, neighborhood?: string | null, locality?: string | null, rawLocation?: string | null) {
  const selectedFound = findNeighborhood(selected);
  if (!selectedFound) return false;

  if (selectedFound.kind === 'locality') {
    return canonicalNeighborhoodName(locality) === selectedFound.name
      || neighborhoodSearchText(rawLocation).includes(normalizeNeighborhoodText(selectedFound.name));
  }

  const resolved = canonicalNeighborhoodName(neighborhood);
  if (resolved) return resolved === selectedFound.name;

  // Compatibilidade apenas para registros antigos sem bairro resolvido.
  const raw = normalizeNeighborhoodText(rawLocation);
  const names = [selectedFound.name, ...(selectedFound.aliases || [])].map(normalizeNeighborhoodText);
  return names.some((name) => name.length >= 3 && raw.includes(name));
}

interface NeighborhoodContextType {
  currentNeighborhood: Neighborhood;
  isNeighborhoodSelected: boolean;
  setNeighborhood: (name: string) => void;
  setNeighborhoodByCep: (cep: string) => Promise<boolean>;
  clearSelection: () => void;
  selectAllNeighborhoods: () => void;
}

const NeighborhoodContext = createContext<NeighborhoodContextType>(null!);

const ALL_NEIGHBORHOODS: Neighborhood = {
  name: '', latitude: -25.4297, longitude: -49.2711, cepExample: '80020-000', kind: 'official',
};

function initialNeighborhood() {
  try {
    const saved = localStorage.getItem('selected-neighborhood');
    return findNeighborhood(saved) || ALL_NEIGHBORHOODS;
  } catch {
    return ALL_NEIGHBORHOODS;
  }
}

export function NeighborhoodProvider({ children }: { children: ReactNode }) {
  const [currentNeighborhood, setCurrentNeighborhood] = useState<Neighborhood>(initialNeighborhood);
  const [isNeighborhoodSelected, setIsNeighborhoodSelected] = useState<boolean>(true);

  const setNeighborhood = (name: string) => {
    const found = findNeighborhood(name);
    if (!found) return;
    setCurrentNeighborhood(found);
    setIsNeighborhoodSelected(true);
    localStorage.setItem('selected-neighborhood', found.name);
  };

  const clearSelection = () => {
    localStorage.removeItem('selected-neighborhood');
    setIsNeighborhoodSelected(false);
  };

  const selectAllNeighborhoods = () => {
    localStorage.removeItem('selected-neighborhood');
    setCurrentNeighborhood(ALL_NEIGHBORHOODS);
    setIsNeighborhoodSelected(true);
  };

  const setNeighborhoodByCep = async (cep: string): Promise<boolean> => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return false;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();
      if (data.erro) return false;
      if (normalizeNeighborhoodText(data.localidade) !== 'curitiba') {
        alert('Este sistema é exclusivo para Curitiba.');
        return false;
      }

      const found = findNeighborhood(data.bairro);
      if (!found) return false;
      setCurrentNeighborhood(found);
      setIsNeighborhoodSelected(true);
      localStorage.setItem('selected-neighborhood', found.name);
      return true;
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      return false;
    }
  };

  return (
    <NeighborhoodContext.Provider value={{ currentNeighborhood, isNeighborhoodSelected, setNeighborhood, setNeighborhoodByCep, clearSelection, selectAllNeighborhoods }}>
      {children}
    </NeighborhoodContext.Provider>
  );
}

export const useNeighborhood = () => useContext(NeighborhoodContext);
