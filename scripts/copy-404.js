import { copyFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const distPath = resolve(process.cwd(), 'dist');
const source = resolve(distPath, 'index.html');
const target = resolve(distPath, '404.html');

async function copy404() {
    try {
        await rm(target, { force: true });
        await copyFile(source, target);
        console.log('Created dist/404.html from dist/index.html');
    } catch (error) {
        console.error('Failed to create 404.html fallback:', error);
        process.exit(1);
    }
}

copy404();
