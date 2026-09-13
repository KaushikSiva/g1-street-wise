export type LandmarkView={key:string;label:string;wayId?:number;frontageId?:string;eye:[number,number,number];target:[number,number,number]};
/** Inspection views, not calibrated photographic camera poses. */
export const LANDMARK_VIEWS:LandmarkView[]=[
  {key:'lakshmi',label:'Lakshmi Apartments',wayId:355940221,eye:[0,1.68,13],target:[0,4.8,0]},
  {key:'surya',label:'Surya Apartments',wayId:354840134,eye:[-10,1.68,13.2],target:[-3,5.8,0]},
  {key:'avinash',label:'Avinash Apartments',wayId:354839974,eye:[-10,1.68,9.5],target:[-1,6,0]},
  {key:'vasanth',label:'Vasanth Vihar',wayId:354840013,eye:[10,1.68,11],target:[1,5.8,-.5]},
  {key:'rams',label:'13/7 · partial frontage',frontageId:'central-avenue-13-7',eye:[-7,1.68,12],target:[0,4.6,0]},
  {key:'prashanth',label:'Prashanth',wayId:354840171,eye:[-4,1.68,13],target:[.7,3,0]},
  {key:'encaarpus',label:'Encaarpus Villa',wayId:354839754,eye:[0,1.68,13],target:[0,6.2,0]},
  {key:'malles',label:'Malles Roy Enclave',wayId:354839651,eye:[-10,1.68,11],target:[-2,5.8,-.5]},
];
