import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import { api } from "@/lib/client";

/**
 * Client-side roster state with optimistic updates: flipping someone in or out
 * of the draw shows instantly and saves in the background, rolling back with a
 * toast if the request fails.
 */
export default function useEmployees(initial = []) {
  const [employees, setEmployees] = useState(initial);
  const [savingIds, setSavingIds] = useState(() => new Set());

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

  const setInDraw = useCallback(async (id, inDraw) => {
    let previous;
    setEmployees((list) =>
      list.map((e) => {
        if (e._id !== id) return e;
        previous = e.entries;
        return { ...e, entries: inDraw ? 1 : 0 };
      })
    );
    markSaving(id, true);
    try {
      await api(`/api/employees/${id}`, { method: "PUT", body: { inDraw } });
    } catch (err) {
      toast.error(`Couldn't save: ${err.message}`);
      setEmployees((list) => list.map((e) => (e._id === id ? { ...e, entries: previous ?? e.entries } : e)));
    } finally {
      markSaving(id, false);
    }
  }, []);

  const remove = useCallback(async (id) => {
    await api(`/api/employees/${id}`, { method: "DELETE" });
    setEmployees((list) => list.filter((e) => e._id !== id));
  }, []);

  const setAllInDraw = useCallback(async (inDraw) => {
    const { data } = await api("/api/reset-entries", { method: "PUT", body: { inDraw } });
    setEmployees((list) => list.map((e) => ({ ...e, entries: inDraw ? 1 : 0 })));
    return data;
  }, []);

  return { employees, savingIds, refresh, setInDraw, remove, setAllInDraw };
}
