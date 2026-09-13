import { municipalStreetAliases } from "./street-name-aliases";
import './street-names.css';

/** Names are map annotations, never claims about a photographed physical sign. */
export type StreetPoint = { x: number; z: number };
type Coordinate = { lat: number; lon: number };
type StreetWay = { type?: string; id: number; tags?: Record<string, string>; geometry?: Coordinate[] };
type StreetDataset = { elements: StreetWay[]; osm3s?: { timestamp_osm_base?: string } };
export type NamedStreet = {
  id: string;
  name: string;
  tamilNames: string[];
  aliases: string[];
  municipalAliases: ReturnType<typeof municipalStreetAliases>;
  wayIds: number[];
  highwayClasses: string[];
  paths: { wayId: number; tamilName: string; coordinates: Coordinate[]; points: StreetPoint[] }[];
};
export type StreetMatch = {
  street: NamedStreet;
  distanceMeters: number;
  wayId: number;
  point: StreetPoint;
  coordinate: Coordinate;
};
const clean = (value: string | undefined) => (value || '').normalize('NFC').trim().replace(/\s+/g, ' ');
const coordinateKey = (p: Coordinate) => `${p.lat},${p.lon}`;

export function buildStreetNameIndex(data: StreetDataset, project: (lat: number, lon: number) => StreetPoint) {
  const roadWays = data.elements.filter(way => (!way.type || way.type === 'way') && !!way.tags?.highway);
  const valid = roadWays.filter(way => way.geometry && way.geometry.length >= 2 && way.geometry.every(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)));
  const named = valid.filter(way => clean(way.tags?.name));
  const parents = named.map((_, i) => i);
  function root(i: number): number { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
  // Connect only equal source names that share an exact source vertex. A numbered
  // street elsewhere in the neighborhood must not disappear into its namesake.
  const vertices = new Map<string, number>();
  named.forEach((way, i) => {
    for (const coordinate of way.geometry!) {
      const key = `${clean(way.tags?.name)}\u0000${coordinateKey(coordinate)}`;
      const previous = vertices.get(key);
      if (previous !== undefined) parents[root(i)] = root(previous);
      else vertices.set(key, i);
    }
  });
  const groups = new Map<number, StreetWay[]>();
  named.forEach((way, i) => { const key = root(i); const group = groups.get(key) || []; group.push(way); groups.set(key, group); });
  const streets: NamedStreet[] = [...groups.values()].map(ways => {
    ways.sort((a, b) => a.id - b.id);
    const values = (key: string) => [...new Set(ways.map(way => clean(way.tags?.[key])).filter(Boolean))];
    return {
      id: `osm-street-${ways[0].id}`, name: clean(ways[0].tags?.name),
      tamilNames: values('name:ta'),
      aliases: [...new Set(ways.flatMap(way => [...['alt_name', 'alt_name1', 'official_name', 'name:en'].flatMap(key => (way.tags?.[key] || '').split(';').map(clean).filter(Boolean)), ...municipalStreetAliases(way.id,clean(way.tags?.name)).map(a=>a.name)]))],
      municipalAliases: [...new Map(ways.flatMap(way=>municipalStreetAliases(way.id,clean(way.tags?.name))).map(a=>[a.name,a])).values()],
      wayIds: ways.map(way => way.id), highwayClasses: values('highway'),
      paths: ways.map(way => ({ wayId: way.id, tamilName: clean(way.tags?.['name:ta']), coordinates: way.geometry!.map(p => ({ ...p })), points: way.geometry!.map(p => { const point = project(p.lat, p.lon); return { x: point.x, z: point.z }; }) })),
    };
  }).sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }) || a.wayIds[0] - b.wayIds[0]);
  const stats = {
    roadWays: roadWays.length, namedWays: named.length,
    unnamedWays: valid.filter(way => !clean(way.tags?.name)).length,
    invalidGeometryWays: roadWays.length - valid.length,
    distinctNames: new Set(named.map(way => clean(way.tags?.name))).size,
    connectedStreets: streets.length,
    tamilNamedWays: named.filter(way => clean(way.tags?.['name:ta'])).length,
    sourceTimestamp: data.osm3s?.timestamp_osm_base || null,
  };
  function locate(street: NamedStreet, position: StreetPoint): StreetMatch {
    let best: StreetMatch | undefined;
    for (const path of street.paths) for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1], b = path.points[i];
      const dx = b.x - a.x, dz = b.z - a.z;
      const lengthSquared = dx * dx + dz * dz;
      const t = lengthSquared ? Math.max(0, Math.min(1, ((position.x - a.x) * dx + (position.z - a.z) * dz) / lengthSquared)) : 0;
      const point = { x: a.x + dx * t, z: a.z + dz * t };
      const distanceMeters = Math.hypot(position.x - point.x, position.z - point.z);
      if (!best || distanceMeters < best.distanceMeters) {
        const ca = path.coordinates[i - 1], cb = path.coordinates[i];
        best = { street, wayId: path.wayId, distanceMeters, point, coordinate: { lat: ca.lat + (cb.lat - ca.lat) * t, lon: ca.lon + (cb.lon - ca.lon) * t } };
      }
    }
    return best!;
  }
  function nearby(position: StreetPoint, query = '') {
    const term = clean(query).toLocaleLowerCase();
    return streets.filter(street => !term || [street.name, ...street.tamilNames, ...street.aliases].some(name => name.toLocaleLowerCase().includes(term)))
      .map(street => locate(street, position)).sort((a, b) => a.distanceMeters - b.distanceMeters || a.wayId - b.wayId);
  }
  return { streets, stats, nearby, locate };
}

/** Append element below Explore; call update(camera.position) after moving the camera. */
export function createStreetNames(data: StreetDataset, project: (lat: number, lon: number) => StreetPoint, options: { onSelect?: (match: StreetMatch) => void } = {}) {
  const index = buildStreetNameIndex(data, project);
  const element = document.createElement('details');
  element.className = 'street-name-ui';
  const summary = document.createElement('summary');
  summary.setAttribute('aria-label', 'Browse mapped street names');
  const eyebrow = document.createElement('span'); eyebrow.className = 'street-name-eyebrow'; eyebrow.textContent = 'Nearby mapped street';
  const nearest = document.createElement('span'); nearest.className = 'street-name-nearest'; nearest.textContent = 'Street names';
  summary.append(eyebrow, nearest);
  const panel = document.createElement('section'); panel.className = 'street-name-panel'; panel.setAttribute('aria-label', 'Mapped street directory');
  const top = document.createElement('div'); top.className = 'street-name-top';
  const title = document.createElement('strong'); title.textContent = 'Find a street';
  const close = document.createElement('button'); close.type = 'button'; close.textContent = '×'; close.setAttribute('aria-label', 'Close street directory');
  close.onclick = () => { element.open = false; summary.focus(); };
  top.append(title, close);
  const search = document.createElement('input'); search.type = 'search'; search.placeholder = 'English or தமிழ் street name'; search.setAttribute('aria-label', 'Search mapped street names');
  const count = document.createElement('p'); count.className = 'street-name-count'; count.setAttribute('role', 'status');
  const list = document.createElement('ul'); list.className = 'street-name-list';
  const attribution = document.createElement('p'); attribution.className = 'street-name-credit';
  attribution.append(document.createTextNode('Map labels · '));
  const osm = document.createElement('a'); osm.href = 'https://www.openstreetmap.org/copyright'; osm.target = '_blank'; osm.rel = 'noopener'; osm.textContent = '© OpenStreetMap contributors';
  const snapshotDate = index.stats.sourceTimestamp?.slice(0, 10);
  attribution.append(osm, document.createTextNode(`. ${snapshotDate ? `Snapshot ${snapshotDate}. ` : ''}${index.stats.unnamedWays} road ways have no name in this map snapshot. Names and distances follow mapped centerlines; physical signs are unverified.`));
  panel.append(top, search, count, list, attribution); element.append(summary, panel);
  let position: StreetPoint = { x: 0, z: 0 };
  let lastPosition: StreetPoint | undefined;
  const formatDistance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
  function renderList() {
    const matches = index.nearby(position, search.value);
    count.textContent = `${matches.length} mapped street sections · nearest first`;
    list.replaceChildren();
    if (!matches.length) { const empty = document.createElement('li'); empty.className = 'street-name-empty'; empty.textContent = 'No matching name in this map snapshot.'; list.append(empty); }
    for (const match of matches) {
      const row = document.createElement('li'); row.dataset.streetId = match.street.id;
      const name = document.createElement(options.onSelect ? 'button' : 'a');
      name.className = 'street-name-choice'; name.textContent = match.street.name;
      if (name instanceof HTMLButtonElement) {
        name.type = 'button'; name.onclick = () => { options.onSelect?.(match); element.open = false; summary.focus(); };
        name.setAttribute('aria-label', `View ${match.street.name}, ${formatDistance(match.distanceMeters)} away`);
      } else { name.href = `https://www.openstreetmap.org/way/${match.wayId}`; name.target = '_blank'; name.rel = 'noopener'; }
      row.append(name);
      for (const ta of match.street.tamilNames) { const tamil = document.createElement('span'); tamil.className = 'street-name-tamil'; tamil.lang = 'ta'; tamil.textContent = ta; row.append(tamil); }
      const detail = document.createElement('div'); detail.className = 'street-name-detail';
      const construction = match.street.highwayClasses.includes('construction') ? ' · mapped construction' : '';
      detail.append(document.createTextNode(`${formatDistance(match.distanceMeters)} away${construction} · `));
      const source = document.createElement('a'); source.href = `https://www.openstreetmap.org/way/${match.wayId}`; source.target = '_blank'; source.rel = 'noopener'; source.textContent = 'Map source ↗';
      source.setAttribute('aria-label', `Open source way ${match.wayId} for ${match.street.name}`); detail.append(source);
      for (const alias of match.street.municipalAliases) {
        const reference=document.createElement('a'); reference.href=alias.sourceUrl; reference.target='_blank'; reference.rel='noopener'; reference.textContent='Name reference ↗'; reference.title=`${alias.name} · ${alias.sourceTitle}`;
        detail.append(document.createTextNode(' · '),reference);
      }
      row.append(detail); list.append(row);
    }
  }
  element.addEventListener('toggle', () => { if (element.open) renderList(); });
  search.addEventListener('input', renderList);
  element.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { element.open = false; summary.focus(); } });
  function update(next: StreetPoint) {
    position = { x: next.x, z: next.z };
    if (lastPosition && Math.hypot(position.x - lastPosition.x, position.z - lastPosition.z) < 2) return;
    lastPosition = { ...position };
    const match = index.nearby(position)[0];
    nearest.textContent = match ? `${match.street.name} · ${formatDistance(match.distanceMeters)}` : 'No names in this map snapshot';
    summary.title = match ? `${match.street.name} — mapped centerline ${formatDistance(match.distanceMeters)} away` : nearest.textContent;
    // Do not replace focused links as the camera moves while the directory is open.
    if (element.open && !element.contains(document.activeElement)) renderList();
  }
  update(position);
  return { element, index, update, dispose: () => element.remove() };
}
