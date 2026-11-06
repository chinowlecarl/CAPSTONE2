import { lazy } from "react";

export const CHUNK_RELOAD_KEY = "fitcheque:chunk-reload-attempted";

export function lazyWithRecovery(importer) {
  return lazy(() => importer()
    .then((module) => {
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return module;
    })
    .catch((error) => {
      if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) throw error;

      sessionStorage.setItem(CHUNK_RELOAD_KEY, "true");
      const url = new URL(window.location.href);
      url.searchParams.set("__chunk_retry", String(Date.now()));
      window.location.replace(url.href);
      return new Promise(() => {});
    }));
}
