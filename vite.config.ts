import {defineConfig} from 'vite';
const proxy={'/fork-api':{target:'http://127.0.0.1:8191',rewrite:(path:string)=>path.replace(/^\/fork-api/,'')}};
export default defineConfig({server:{proxy},preview:{proxy}});
