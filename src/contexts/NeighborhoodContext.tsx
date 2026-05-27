import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface Neighborhood {
  name: string;
  latitude: number;
  longitude: number;
  cepExample: string;
}

// Lista completa dos 75 bairros de Curitiba com coordenadas aproximadas e CEPs de exemplo
export const curitibaNeighborhoods: Neighborhood[] = [
  { name: 'Abranches', latitude: -25.3725, longitude: -49.2708, cepExample: '82130-010' },
  { name: 'Água Verde', latitude: -25.4519, longitude: -49.2847, cepExample: '80240-000' },
  { name: 'Ahú', latitude: -25.4080, longitude: -49.2600, cepExample: '80540-000' },
  { name: 'Alto Boqueirão', latitude: -25.5300, longitude: -49.2300, cepExample: '81750-000' },
  { name: 'Alto da Glória', latitude: -25.4200, longitude: -49.2600, cepExample: '80030-000' },
  { name: 'Alto da Rua XV', latitude: -25.4300, longitude: -49.2500, cepExample: '80045-000' },
  { name: 'Atuba', latitude: -25.3800, longitude: -49.2100, cepExample: '82630-000' },
  { name: 'Augusta', latitude: -25.4800, longitude: -49.3700, cepExample: '81270-000' },
  { name: 'Bacacheri', latitude: -25.3900, longitude: -49.2300, cepExample: '82520-000' },
  { name: 'Bairro Alto', latitude: -25.4000, longitude: -49.2000, cepExample: '82820-000' },
  { name: 'Barreirinha', latitude: -25.3600, longitude: -49.2500, cepExample: '82700-000' },
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
  { name: 'Campo de Santana', latitude: -25.5800, longitude: -49.3200, cepExample: '81490-000' },
  { name: 'Capão da Imbuia', latitude: -25.4300, longitude: -49.2100, cepExample: '82810-000' },
  { name: 'Capão Raso', latitude: -25.5000, longitude: -49.2900, cepExample: '81130-000' },
  { name: 'Cascatinha', latitude: -25.4000, longitude: -49.3100, cepExample: '82025-000' },
  { name: 'Caximba', latitude: -25.6200, longitude: -49.3300, cepExample: '81490-512' },
  { name: 'Centro', latitude: -25.4297, longitude: -49.2711, cepExample: '80020-000' },
  { name: 'Centro Cívico', latitude: -25.4100, longitude: -49.2600, cepExample: '80530-000' },
  { name: 'Cidade Industrial', latitude: -25.5000, longitude: -49.3500, cepExample: '81310-000' },
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
  { name: 'Orleans', latitude: -25.4200, longitude: -49.3500, cepExample: '82310-000' },
  { name: 'Parolin', latitude: -25.4500, longitude: -49.2600, cepExample: '80220-000' },
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
  { name: 'Vitoria Regia', latitude: -25.5415, longitude: -49.3375, cepExample: '81470-430' },
  { name: 'Xaxim', latitude: -25.4900, longitude: -49.2500, cepExample: '81710-000' },
];

interface NeighborhoodContextType {
  currentNeighborhood: Neighborhood;
  setNeighborhood: (name: string) => void;
  setNeighborhoodByCep: (cep: string) => boolean;
}

const NeighborhoodContext = createContext<NeighborhoodContextType>(null!);

const DEFAULT_NEIGHBORHOOD = curitibaNeighborhoods.find(n => n.name === 'Vitoria Regia') || curitibaNeighborhoods[0];

export function NeighborhoodProvider({ children }: { children: ReactNode }) {
  const [currentNeighborhood, setCurrentNeighborhood] = useState<Neighborhood>(() => {
    const saved = localStorage.getItem('selected-neighborhood');
    if (saved) {
      const found = curitibaNeighborhoods.find(n => n.name === saved);
      if (found) return found;
    }
    return DEFAULT_NEIGHBORHOOD;
  });

  const setNeighborhood = (name: string) => {
    const found = curitibaNeighborhoods.find(n => n.name === name);
    if (found) {
      setCurrentNeighborhood(found);
      localStorage.setItem('selected-neighborhood', found.name);
    }
  };

  const setNeighborhoodByCep = (cep: string): boolean => {
    // Normaliza o CEP para busca
    const cleanCep = cep.replace(/\D/g, '');

    // Como Curitiba é CEP por rua, uma busca exata por "faixa" é complexa sem API externa.
    // Para este MVP, vamos mapear alguns prefixos ou permitir que o usuário digite o CEP de exemplo.
    // Uma abordagem melhor é usar os 5 primeiros dígitos para algumas regiões.

    const found = curitibaNeighborhoods.find(n => n.cepExample.replace(/\D/g, '') === cleanCep);

    if (found) {
      setCurrentNeighborhood(found);
      localStorage.setItem('selected-neighborhood', found.name);
      return true;
    }

    // Fallback: Tenta encontrar pelo prefixo (primeiros 5 dígitos) se houver correspondência aproximada
    const prefix = cleanCep.substring(0, 5);
    const foundByPrefix = curitibaNeighborhoods.find(n => n.cepExample.replace(/\D/g, '').startsWith(prefix));

    if (foundByPrefix) {
      setCurrentNeighborhood(foundByPrefix);
      localStorage.setItem('selected-neighborhood', foundByPrefix.name);
      return true;
    }

    return false;
  };

  return (
    <NeighborhoodContext.Provider value={{ currentNeighborhood, setNeighborhood, setNeighborhoodByCep }}>
      {children}
    </NeighborhoodContext.Provider>
  );
}

export const useNeighborhood = () => useContext(NeighborhoodContext);
