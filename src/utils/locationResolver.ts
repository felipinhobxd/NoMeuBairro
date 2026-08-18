import { canonicalNeighborhoodName, curitibaNeighborhoods, findNeighborhood } from '../contexts/NeighborhoodContext';
import { supabase } from './supabase';

type ResolvedLocation = {
  latitude: number | null;
  longitude: number | null;
  neighborhood: string | null;
  locality: string | null;
  precision: 'exact' | 'reverse' | 'neighborhood' | null;
  displayAddress?: string | null;
};

export async function resolveCuritibaLocation(input: {
  location?: string;
  neighborhood?: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<ResolvedLocation> {
  try {
    const { data, error } = await supabase.functions.invoke('anonymous-post-control', {
      body: { action: 'resolve_location', ...input },
    });
    if (!error && data?.ok) {
      return {
        latitude: data.latitude == null ? null : Number(data.latitude),
        longitude: data.longitude == null ? null : Number(data.longitude),
        neighborhood: data.neighborhood || null,
        locality: data.locality || null,
        precision: data.precision || null,
        displayAddress: data.displayAddress || null,
      };
    }
  } catch (error) {
    console.warn('Falha ao resolver localização:', error);
  }

  const canonical = canonicalNeighborhoodName(input.neighborhood) || null;
  const known = canonical ? findNeighborhood(canonical) : undefined;
  if (input.latitude != null && input.longitude != null) {
    return {
      latitude: Number(input.latitude), longitude: Number(input.longitude),
      neighborhood: canonical, locality: null, precision: 'exact', displayAddress: null,
    };
  }
  if (known) {
    return {
      latitude: known.latitude, longitude: known.longitude,
      neighborhood: known.kind === 'locality' ? known.parentNeighborhood || null : known.name,
      locality: known.kind === 'locality' ? known.name : null,
      precision: 'neighborhood', displayAddress: null,
    };
  }
  const fallback = curitibaNeighborhoods.find((item) => item.name === canonical);
  return {
    latitude: fallback?.latitude ?? null,
    longitude: fallback?.longitude ?? null,
    neighborhood: fallback?.name || canonical,
    locality: null,
    precision: fallback ? 'neighborhood' : null,
    displayAddress: null,
  };
}
