type SearchFilters = {
  q: string; city: string; museum: string; status: string; admission: string;
  asOf: string; includeSample: boolean;
};

type ExhibitionIdentity = {
  id: string; museumId: string; sourceStatus: string; exhibitionStatus: string; isSample: boolean;
};

type GtagWindow = Window & { gtag?: (command: 'event', name: string, parameters: Record<string, string | number>) => void };

function sendEvent(name: string, parameters: Record<string, string | number>) {
  if (typeof window === 'undefined') return;
  try {
    (window as GtagWindow).gtag?.('event', name, parameters);
  } catch {
    // Analytics must never interrupt searching or opening an official page.
  }
}

export function trackExhibitionSearchCompleted(filters: SearchFilters, resultCount: number) {
  if (filters.includeSample) return;
  sendEvent('exhibition_search_complete', {
    result_count: resultCount,
    city: filters.city || 'all',
    museum_id: filters.museum || 'all',
    status: filters.status,
    admission: filters.admission,
    has_keyword: Number(Boolean(filters.q.trim())),
    has_date_filter: Number(Boolean(filters.asOf)),
  });
}

function exhibitionParameters(item: ExhibitionIdentity) {
  return {
    exhibition_id: item.id,
    museum_id: item.museumId,
    source_status: item.sourceStatus,
    exhibition_status: item.exhibitionStatus,
  };
}

export function trackExhibitionDetailOpen(item: ExhibitionIdentity) {
  if (!item.isSample) sendEvent('exhibition_detail_open', exhibitionParameters(item));
}

export function trackOfficialExhibitionClick(item: ExhibitionIdentity) {
  if (!item.isSample) sendEvent('official_exhibition_click', exhibitionParameters(item));
}
