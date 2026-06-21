import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { type SettingsState } from "../store/settings";
import { loadSettings, setSetting } from "../store/settings";

let _loaded = false;
let _cache: SettingsState | null = null;
const _listeners = new Set<(key: string, value: unknown) => void>();

function emit<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
  _listeners.forEach(f => f(key as string, value));
}

export function useSettings() {
  const getAll = useCallback(async (): Promise<SettingsState> => {
    if (_loaded && _cache) return { ..._cache };
    const s = await loadSettings();
    _cache = s;
    _loaded = true;
    return s;
  }, []);

  const get = useCallback(<K extends keyof SettingsState>(key: K): SettingsState[K] => {
    return (_cache?.[key] ?? null) as SettingsState[K];
  }, []);

  const set = useCallback(async <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    _cache = { ..._cache!, [key]: value };
    emit(key, value);
    await setSetting(key, value);
  }, []);

  const subscribe = useCallback((fn: (key: string, value: unknown) => void) => {
    _listeners.add(fn);
    return () => { _listeners.delete(fn); };
  }, []);

  return { getAll, get, set, subscribe };
}

/** Listen to a specific key and call onChange when it changes */
export function useSettingsValue<K extends keyof SettingsState>(
  key: K,
  onChange: (value: SettingsState[K]) => void,
) {
  const { subscribe, get } = useSettings();
  useEffect(() => {
    const v = get(key);
    if (v !== null) onChange(v);
    return subscribe((k, v) => {
      if (k === key) onChange(v as SettingsState[K]);
    });
  }, [key]);
}

export function useSpeed() {
  const { set } = useSettings();
  const [speed, setSpeed] = useState(1.0);
  useSettingsValue("speed", v => setSpeed(v as number));

  const updateSpeed = useCallback((s: number) => {
    setSpeed(s);
  }, []);

  const commitSpeed = useCallback(async (s: number) => {
    setSpeed(s);
    await invoke("bridge_set_speed", { factor: s });
    await set("speed", s);
  }, [set]);

  return { speed, setSpeed: updateSpeed, commitSpeed };
}
