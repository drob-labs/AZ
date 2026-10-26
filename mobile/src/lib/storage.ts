import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyState, type TrackerState } from '../core/outbox';

const KEY = 'az.tracker.v1';

export async function loadTrackerState(): Promise<TrackerState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...emptyState, ...(JSON.parse(raw) as TrackerState) } : emptyState;
  } catch {
    return emptyState;
  }
}

export async function saveTrackerState(state: TrackerState): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export async function clearTrackerState(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
