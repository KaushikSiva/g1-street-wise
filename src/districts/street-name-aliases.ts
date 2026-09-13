/** Municipal locality-qualified search terms; source map labels and geometries remain intact. */
const gazette = 'https://chennaicorporation.gov.in/gcc/area_sabha/pdf/gazette.pdf';
const entries = [
  {wayIds:[27189809], expectedName:'UI Colony 1st Main Road', alias:'United India Colony 1st Main Road', page:472},
  {wayIds:[26764010], expectedName:'UI Colony 3rd Main Road', alias:'United India Colony 3rd Main Road', page:471},
  {wayIds:[27189810], expectedName:'UI Colony 1st Cross Street', alias:'United India Colony 1st Cross Street', page:471},
  {wayIds:[27189807], expectedName:'2nd Cross Street', alias:'United India Colony 2nd Cross Street', page:471},
  {wayIds:[27192062], expectedName:'4th Cross Street', alias:'United India Colony 4th Cross Street', page:471},
  {wayIds:[27189808], expectedName:'6th Cross Street', alias:'United India Colony 6th Cross Street', page:472},
  {wayIds:[184913318,1434320094], expectedName:'Circular Road', alias:'United India Colony Circular Road', page:471},
];
export function municipalStreetAliases(wayId:number, sourceName:string) {
  return entries.filter(entry=>entry.wayIds.includes(wayId)&&entry.expectedName===sourceName)
    .map(entry=>({name:entry.alias,sourceUrl:`${gazette}#page=${entry.page}`,sourceTitle:`Chennai District Gazette, December 2022, page ${entry.page}`}));
}
