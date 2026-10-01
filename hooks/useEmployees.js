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
  const pendingEntries = useRef(new Map()); // id → { entries, timer }: a save waiting for the clicking to stop
  const inflightEntries = useRef(new Set()); // saves on their way to the server
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

  /** Send one teammate's waiting entries save now. */
  const saveEntries = useCallback(
    async (id) => {
      const pending = pendingEntries.current;
      const saved = savedEntries.current;
      const job = pending.get(id);
      if (!job) return;
      clearTimeout(job.timer);
      pending.delete(id);
      if (saved.get(id) === job.entries) return; // clicked back to where it was

      markSaving(id, true);
      const request = api(`/api/employees/${id}`, { method: "PUT", body: { entries: job.entries } });
      inflightEntries.current.add(request);
      try {
        await request;
        saved.set(id, job.entries);
      } catch (err) {
        toast.error(`Couldn't save: ${err.message}`);
        // Put it back, unless they've already changed it again.
        if (!pending.has(id)) patch(id, { entries: saved.get(id) });
      } finally {
        inflightEntries.current.delete(request);
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
      const pending = pendingEntries.current;
      const saved = savedEntries.current;
      if (!saved.has(id)) saved.set(id, latest.current.find((e) => e._id === id)?.entries ?? 0);
      patch(id, { entries });
      clearTimeout(pending.get(id)?.timer);
      pending.set(id, { entries, timer: setTimeout(() => saveEntries(id), ENTRY_SAVE_DELAY) });
    },
    [patch, saveEntries]
  );

  /**
   * Before a change to everyone, land every single save first (sending any
   * still waiting on their timer), so none of them can arrive afterwards and
   * undo the bulk change for that teammate.
   */
  const settleEntries = useCallback(async () => {
    await Promise.all([...pendingEntries.current.keys()].map(saveEntries));
    await Promise.allSettled([...inflightEntries.current]);
  }, [saveEntries]);

  const remove = useCallback(async (id) => {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    setEmployees((list) => list.filter((e) => e._id !== id));
  }, []);

  const setAllInDraw = useCallback(async (inDraw) => {
    const { data } = await api("/api/reset-entries", { method: "PUT", body: { inDraw } });
    setEmployees((list) => list.map((e) => ({ ...e, inDraw })));
    return data;
  }, []);

  const setAllEntries = useCallback(
    async (entries) => {
      await settleEntries();
      savedEntries.current.clear();
      try {
        const { data } = await api("/api/reset-entries", { method: "PUT", body: { entries } });
        setEmployees((list) => list.map((e) => ({ ...e, entries })));
        return data;
      } catch (err) {
        refresh(); // show what the server actually has
        throw err;
      }
    },
    [refresh, settleEntries]
  );

  /** Give everyone `change` more monthly entries (or fewer, if negative), as the server counts them. */
  const changeAllEntries = useCallback(
    async (change) => {
      await settleEntries();
      savedEntries.current.clear();
      try {
        const { data } = await api("/api/reset-entries", { method: "PUT", body: { change } });
        setEmployees((list) => list.map((e) => (e._id in data.entries ? { ...e, entries: data.entries[e._id] } : e)));
        return data;
      } catch (err) {
        refresh();
        throw err;
      }
    },
    [refresh, settleEntries]
  );

  return {
    employees,
    savingIds,
    refresh,
    patch,
    setInDraw,
    setEntries,
    remove,
    setAllInDraw,
    setAllEntries,
    changeAllEntries,
  };
}
