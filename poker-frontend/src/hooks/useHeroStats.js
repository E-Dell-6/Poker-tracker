import { useState, useEffect } from 'react';
import { getMyStats, getMyFilteredStats, recomputeMyStats } from '../api/stats';
import { useIsLoggedIn } from './useIsLoggedIn';

// Same presets/convention as Profile.jsx's TIME_FILTERS (plain component
// state, no URL sync).
export const TIME_FILTERS = [
  { key: '30', label: '30D' },
  { key: '90', label: '90D' },
  { key: '365', label: '365D' },
  { key: 'all', label: 'All Time' }
];

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Shared hero-stats fetch/filter logic - extracted from Stats.jsx so the
// Study page and its Range Matrix subpage (PreflopMatrixPage.jsx) don't
// each carry their own copy of the baseStats/filteredStats/stakes/date-range
// plumbing. `baseStats` is the cached, unfiltered GET /api/stats/me result -
// always fetched once on load, kept around even while a filter is active so
// a stakes <select> always has its full option list. `filteredStats` is the
// live GET /api/stats/me/filtered result, only populated when a filter is
// actually active. `stats` (derived below) is whichever of the two the
// caller should actually render.
export function useHeroStats() {
  const isLoggedIn = useIsLoggedIn();
  const [baseStats, setBaseStats] = useState(null);
  const [filteredStats, setFilteredStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [stakesFilter, setStakesFilter] = useState('');
  const [daysFilter, setDaysFilter] = useState('all');

  const isFilterActive = stakesFilter !== '' || daysFilter !== 'all';
  const fromISO = daysFilter !== 'all' ? daysAgoISO(Number(daysFilter)) : null;
  const stats = isFilterActive ? filteredStats : baseStats;

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      setBaseStats(await getMyStats());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredStats = async () => {
    try {
      setFilterLoading(true);
      setError(null);
      setFilteredStats(await getMyFilteredStats({ stakes: stakesFilter, from: fromISO }));
    } catch (err) {
      setError(err.message);
    } finally {
      setFilterLoading(false);
    }
  };

  const refreshStats = async () => {
    try {
      setRefreshing(true);
      setBaseStats(await recomputeMyStats());
      // Recompute always refreshes the unfiltered cached doc - if a filter
      // is active, re-run it too so the visible (filtered) view reflects
      // the fresh data instead of silently going stale.
      if (isFilterActive) await fetchFilteredStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn === false) {
      setLoading(false);
      return;
    }
    if (isLoggedIn !== true) return; // still checking auth
    fetchStats();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isFilterActive) return;
    fetchFilteredStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stakesFilter, daysFilter]);

  return {
    isLoggedIn,
    baseStats, filteredStats, stats,
    isFilterActive, fromISO,
    loading, filterLoading, refreshing, error,
    stakesFilter, setStakesFilter,
    daysFilter, setDaysFilter,
    fetchStats, refreshStats
  };
}

export default useHeroStats;
