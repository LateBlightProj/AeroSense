import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../..');
await import(pathToFileURL(path.join(root,'内部工作/验证/v4.3/AOM接管与回退验收.mjs')));
