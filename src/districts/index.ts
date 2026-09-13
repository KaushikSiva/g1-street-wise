import {createHighRoadHeightSampler, HIGH_ROAD_REPLACED_WAY_IDS} from './high-road';
import {buildHighRoadSurfaces} from './high-road-surfaces';
import {buildUnitedIndiaColony, UNITED_INDIA_COLONY_VIEW} from './united-india-colony';
import {buildCentralAvenue, createCentralAvenueHeightSampler, CENTRAL_AVENUE_WAY_ID} from './central-avenue';
export type DistrictId = 'station' | 'high-road' | 'united-india-colony' | 'govindam' | 'central-avenue';
export const DISTRICT_VIEWS = {
  'central-avenue': {label:'Central Avenue Road',overview:{position:[-238,106,-153],target:[-174,0,-160]},street:{lon:80.229307018,lat:13.05380317,forward:[-.287162584,0,.957881]}},
  station: {label:'Railway station', overview:{position:[190,220,260],target:[0,0,-30]}, street:{lon:80.2303042,lat:13.0518735,forward:[-.08,0,-.494]}},
  'high-road': {label:'High Road / flyover',overview:{position:[90,48,-215],target:[50,8.6,-274]},street:{lon:80.2313321,lat:13.054141,forward:[.995,0,.10]}},
  'united-india-colony': {label:'United India Colony',overview:UNITED_INDIA_COLONY_VIEW,street:{lon:80.2255267,lat:13.0518067,forward:[0,0,-1]}},
  govindam: {label:'Govindam · 4th Cross St',overview:{position:[-558.05,3.4,38.06],target:[-559.691629,3.9,53.105206]},street:{lon:80.22555013196916,lat:13.051272579428673,forward:[-.238924,.22,.971038]}},
} as const;
export function buildDistricts(data:any){
  const highRoad=buildHighRoadSurfaces(data),colony=buildUnitedIndiaColony(data),centralAvenue=buildCentralAvenue(data);
  return {groups:[highRoad,colony,centralAvenue],centralAvenue,centralAvenueHeightAt:createCentralAvenueHeightSampler(data),bridgeHeightAt:createHighRoadHeightSampler(data),replacedRoadIds:new Set<number>([...(highRoad.children.length?HIGH_ROAD_REPLACED_WAY_IDS:[]),...(centralAvenue.children.length?[CENTRAL_AVENUE_WAY_ID]:[])])};
}
