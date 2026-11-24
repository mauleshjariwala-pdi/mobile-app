/**
 * useBrandLists.test.js
 *
 * Copyright 2026-present Prescient Devices, Inc.
 **/

// npm imports
import { renderHook, waitFor } from '@testing-library/react';
// Prescient Devices imports
import { BRAND_CATEGORIES, FALLBACK_BRANDS } from './logbookOptions';
import { useBrandLists } from './useBrandLists';

const CONFIG = {
  apiBase: 'https://designer.test',
  userToken: 'USER',
  digitalTwinID: 'TWIN',
  rig: '575',
  authToken: 'KEY',
};
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  global.fetch = jest.fn();
});

test('without the full API settings it keeps the fallback lists and calls nothing', () => {
  const { result } = renderHook(() => useBrandLists({ ...CONFIG, authToken: '' }));
  expect(result.current).toBe(FALLBACK_BRANDS);
  renderHook(() => useBrandLists());
  expect(global.fetch).not.toHaveBeenCalled();
});

test('reads every category with the authentication header and replaces its list', async () => {
  global.fetch.mockImplementation(async (url) => {
    const component = new URL(url).searchParams.get('component');
    return { ok: true, json: async () => [{ brand: `${component} One` }, { brand: '' }, null] };
  });
  const { result } = renderHook(() => useBrandLists(CONFIG));
  await waitFor(() =>
    BRAND_CATEGORIES.forEach((c) => expect(result.current[c]).toEqual([{ label: `${c} One`, value: `${c} One` }]))
  );
  expect(global.fetch).toHaveBeenCalledTimes(BRAND_CATEGORIES.length);
  const [url, init] = global.fetch.mock.calls[0];
  expect(url).toMatch(/^https:\/\/designer\.test\/api\/private\/pump\/logbook\/brandlist\?/);
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
    userToken: 'USER',
    digitalTwinID: 'TWIN',
    rig: '575',
    component: BRAND_CATEGORIES[0],
  });
  expect(init.headers).toEqual({ authentication: 'KEY' });
});

test('a failed, empty, non-list or offline answer keeps that category fallback', async () => {
  const answers = [
    { ok: false, json: async () => [] },
    { ok: true, json: async () => [] },
    { ok: true, json: async () => ({ brand: 'not a list' }) },
  ];
  global.fetch.mockImplementation(async () => {
    const answer = answers.shift();
    if (!answer) throw new TypeError('Failed to fetch');
    return answer;
  });
  const { result } = renderHook(() => useBrandLists(CONFIG));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(BRAND_CATEGORIES.length));
  await flush();
  expect(result.current).toEqual(FALLBACK_BRANDS);
});

test('answers arriving after the screen closed are ignored', async () => {
  const replies = [];
  global.fetch.mockImplementation(() => new Promise((resolve) => replies.push(resolve)));
  const { result, unmount } = renderHook(() => useBrandLists(CONFIG));
  unmount();
  replies.forEach((reply) => reply({ ok: true, json: async () => [{ brand: 'Late' }] }));
  await flush();
  expect(result.current).toBe(FALLBACK_BRANDS);
});
