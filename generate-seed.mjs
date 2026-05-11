import { readFileSync } from 'fs';
import { join } from 'path';

type Row = { name: string; streamUrl: string; category: string };

const path = join(process.cwd(), 'prisma', 'stations.json');
const stations = JSON.parse(readFileSync(path, 'utf-8')) as Row[];

console.log(`-- Loading ${stations.length} stations`);
console.log('BEGIN TRANSACTION;');

for (const station of stations) {
    const name = station.name.replace(/'/g, "''");
    const streamUrl = station.streamUrl.replace(/'/g, "''");
    const category = station.category.replace(/'/g, "''");
    const id = `station_${Math.random().toString(36).substr(2, 9)}`;

    console.log(`INSERT INTO "Station" (id, name, "streamUrl", category, "isLive", "createdAt", "updatedAt")
VALUES ('${id}', '${name}', '${streamUrl}', '${category}', true, NOW(), NOW())
ON CONFLICT ("streamUrl") DO NOTHING;`);
}

console.log('COMMIT;');
