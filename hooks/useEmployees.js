import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { api } from "@/lib/client";

const ENTRY_SAVE_DELAY = 450;

/**
 * Client-side roster state with optimistic updates: flipping someone in or out
 * of the weekly draw, or changing their monthly entries, shows instantly and
 * saves in the background, rolling back with a toast if the request fails.
 */
export default function useEmployees(initial = []) {
  const [employees, setEmployees] = useState(initial);
  const [savingIds, setSavingIds] = useState(() => new Set());
  const latest = useRef(employees);
  const entryTimers = useRef(new Map()); // id → pending save of monthly entries
  const savedEntries = useRef(new Map()); // id → the count the server last confirmed

  useEffect(() => {
    latest.current = employees;
  }, [employees]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api("/api/employees");
      setEmployees(data);
    } catch (err) {
      toast.error(err.message);
    }
  }, []);

  const markSaving = (id, on) =>
    setSavingIds((prev) => {
      const next = new Set(prev);
      on ? next.add(id) : next.delete(id);
      return next;
    });

  /** Change one teammate's fields locally (after a save, or to show one in advance). */
  const patch = useCallback((id, change) => {
    setEmployees((list) => list.map((e) => (e._id === id ? { ...e, ...change } : e)));
  }, []);

  const setInDraw = useCallback(
    async (id, inDraw) => {
      patch(id, { inDraw });
      markSaving(id, true);
      try {
        await api(`/api/employees/${id}`, { method: "PUT", body: { inDraw } });
      } catch (err) {
        toast.error(`Couldn't save: ${err.message}`);
        patch(id, { inDraw: !inDraw });
      } finally {
        markSaving(id, false);
      }
    },
    [patch]
  );

  /**
   * Monthly entries tend to change a click at a time (+, +, +), so the count
   * updates instantly and a single save goes out once the clicking stops.
   */
  const setEntries = useCallback(
    (id, entries) => {
      const timers = entryTimers.current;
      const saved = savedEntries.current;
      if (!saved.has(id)) saved.set(id, latest.current.find((e) => e._id === id)?.entries ?? 0);
      patch(id, { entries });

      clearTimeout(timers.get(id));
      timers.set(
        id,
        setTimeout(async () => {
          timers.delete(id);
          if (saved.get(id) === entries) return; // clicked back to where it was
          markSaving(id, true);
          try {
            await api(`/api/employees/${id}`, { method: "PUT", body: { entries } });
            saved.set(id, entries);
          } catch (err) {
            toast.error(`Couldn't save: ${err.message}`);
            // Put it back, unless they've already changed it again.
            if (!timers.has(id)) patch(id, { entries: saved.get(id) });
          } finally {
            markSaving(id, false);
          }
        }, ENTRY_SAVE_DELAY)
      );
    },
    [patch]
  );

  const remove = useCallback(async (id) => {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    setEmployees((list) => list.filter((e) => e._id !== id));
  }, []);

  const setAllInDraw = useCallback(async (inDraw) => {
    const { data } = await api("/api/reset-entries", { method: "PUT", body: { inDraw } });
    setEmployees((list) => list.map((e) => ({ ...e, inDraw })));
    return data;
  }, []);

  const setAllEntries = useCallback(async (entries) => {
    // A bulk change wins over any single save still waiting to go out.
    for (const timer of entryTimers.current.values()) clearTimeout(timer);
    entryTimers.current.clear();
    savedEntries.current.clear();
    try {
      const { data } = await api("/api/reset-entries", { method: "PUT", body: { entries } });
      setEmployees((list) => list.map((e) => ({ ...e, entries })));
      return data;
    } catch (err) {
      refresh(); // show what the server actually has
      throw err;
    }
  }, [refresh]);

  return { employees, savingIds, refresh, patch, setInDraw, setEntries, remove, setAllInDraw, setAllEntries };
}
