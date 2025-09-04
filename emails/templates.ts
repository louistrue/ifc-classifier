import fs from 'fs';
import path from 'path';

function readTemplate(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'emails', file), 'utf8');
}

export const sevenDayTemplate = readTemplate('trial-reminder-7d.html');
export const threeDayTemplate = readTemplate('trial-reminder-3d.html');
export const oneDayTemplate = readTemplate('trial-reminder-1d.html');
