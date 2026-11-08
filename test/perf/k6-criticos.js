// Carga (#574): 50 usuarios concurrentes, 5 min, 3 listados autenticados del flujo principal.
// Solo lecturas: seguro contra cualquier entorno. Los endpoints públicos se evitan a propósito
// (rate limit por IP, #568). Ver test/perf/README.md.
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN = __ENV.TOKEN;
if (!TOKEN) throw new Error('Falta TOKEN (JWT de un rol de M6; ver test/perf/README.md)');

export const options = {
  vus: Number(__ENV.VUS || 50),
  duration: __ENV.DURATION || '5m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const params = { headers: { Authorization: `Bearer ${TOKEN}` } };
const endpoints = ['/services', '/containers', '/zones'];

export default function () {
  for (const path of endpoints) {
    const res = http.get(`${BASE_URL}${path}?page=1&pageSize=20`, params);
    check(res, { [`${path} 200`]: (r) => r.status === 200 });
    sleep(1);
  }
}
