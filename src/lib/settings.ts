import "server-only";
import { query, transaction } from "./db";
import { nextOpening } from "./hours";
import type { StoreSettings } from "./types";

export const getStoreSettings = () => query((db) => db.settings);

export const saveStoreSettings = (settings: Omit<StoreSettings, "closedUntil">) =>
  transaction((db) => (db.settings = { ...db.settings, ...settings }));

// Fecha a loja até a próxima abertura da agenda (reabre sozinha) ou reabre já.
export const setClosedNow = (closed: boolean) =>
  transaction((db) => {
    db.settings.closedUntil = closed ? nextOpening(db.settings.hours) : null;
    return db.settings;
  });
