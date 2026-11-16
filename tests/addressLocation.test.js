import { test, before, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { setupTestApp, teardownTestApp } from './helpers/buildApp.js';

let app, headers;
before(async () => {
  process.env.GOOGLE_MAPS_API_KEY = 'test-geocoding-key';
  app = await setupTestApp();
  const res = await app.inject({ method: 'POST', url: '/api/auth/register', payload: {
    name: 'Asha Rao', email: 'location@example.com', password: 'pass1234', birthDate: '1990-01-01',
    consents: ['TOS', 'PRIVACY', 'HEALTH_RECORDS'].map(kind => ({ kind, given: true })),
  } });
  headers = { authorization: `Bearer ${res.json().accessToken}` };
});
after(async () => teardownTestApp(app));

const address = { label: 'Home', line1: '12 MG Road', city: 'Pune', state: 'Maharashtra', zipCode: '411001' };

test('address coordinates survive create, profile fetch, and edit', async () => {
  const created = await app.inject({ method: 'POST', url: '/api/addresses', headers, payload: { ...address, coordinates: [73.8, 18.5] } });
  assert.equal(created.statusCode, 201);
  const saved = created.json().addresses.at(-1);
  assert.deepEqual(saved.coordinates, [73.8, 18.5]);
  const updated = await app.inject({ method: 'PUT', url: `/api/addresses/${saved._id}`, headers, payload: { coordinates: [73.9, 18.6] } });
  assert.equal(updated.statusCode, 200);
  const profile = await app.inject({ method: 'GET', url: '/api/me', headers });
  assert.deepEqual(profile.json().user.addresses.at(-1).coordinates, [73.9, 18.6]);
  const cleared = await app.inject({ method: 'PUT', url: `/api/addresses/${saved._id}`, headers, payload: { coordinates: null } });
  assert.equal(cleared.statusCode, 200);
  assert.deepEqual(cleared.json().addresses.at(-1).coordinates, []);
});

test('address rejects out-of-range and incomplete coordinates', async () => {
  for (const coordinates of [[181, 18], [73, 91], [73], [73, 18, 4]]) {
    const res = await app.inject({ method: 'POST', url: '/api/addresses', headers, payload: { ...address, coordinates } });
    assert.equal(res.statusCode, 400);
  }
});

test('location returns structured address details and accepts a zero latitude', async () => {
  const google = mock.method(https, 'get', (_url, callback) => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    queueMicrotask(() => {
      const response = new EventEmitter();
      callback(response);
      response.emit('data', JSON.stringify({ status: 'OK', results: [{
        formatted_address: '12 MG Road, Pune, Maharashtra 411001, India',
        address_components: [
          { long_name: 'Pune', types: ['locality'] },
          { long_name: 'Maharashtra', types: ['administrative_area_level_1'] },
          { long_name: '411001', types: ['postal_code'] },
          { long_name: 'India', types: ['country'] },
        ],
      }] }));
      response.emit('end');
    });
    return request;
  });
  try {
    const res = await app.inject({ method: 'POST', url: '/api/location', headers, payload: { latitude: 0, longitude: 73.8 } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().user.location.coordinates, [73.8, 0]);
    assert.deepEqual(res.json().addressDetails, {
      line1: '12 MG Road, Pune, Maharashtra 411001, India', city: 'Pune', state: 'Maharashtra', zipCode: '411001', country: 'India',
    });
  } finally { google.mock.restore(); }
});

test('location lookup failure still saves GPS without a fabricated address', async () => {
  const google = mock.method(https, 'get', () => {
    const request = new EventEmitter();
    request.setTimeout = () => request;
    queueMicrotask(() => request.emit('error', new Error('offline')));
    return request;
  });
  try {
    const res = await app.inject({ method: 'POST', url: '/api/location', headers, payload: { latitude: 18.5, longitude: 73.8 } });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json().user.location.coordinates, [73.8, 18.5]);
    assert.equal(res.json().addressDetails, null);
  } finally { google.mock.restore(); }
});

test('location rejects incomplete and invalid GPS payloads', async () => {
  for (const payload of [{}, { latitude: 18 }, { latitude: 91, longitude: 73 }, { latitude: 18, longitude: -181 }]) {
    const res = await app.inject({ method: 'POST', url: '/api/location', headers, payload });
    assert.equal(res.statusCode, 400);
  }
});
