import { isConquestEnabled } from "./conquestConfig";
import { normalizeRoomCode } from "./conquestLogic";

/** Query parameter carried by Conquête invite links: https://<host>/?conquest=CODE */
const CONQUEST_LINK_PARAM = "conquest";

/** Valid room code from the current URL, or "" when absent/invalid. */
export function readConquestCode(loc = globalThis.location) {
  try {
    return normalizeRoomCode(new URLSearchParams(loc?.search || "").get(CONQUEST_LINK_PARAM));
  } catch {
    return "";
  }
}

/** Invite link on the current host (works on dev-maps and maps.tvrs.fr alike). */
export function buildConquestLink(code, loc = globalThis.location) {
  const url = new URL("/", loc?.origin || "https://maps.tvrs.fr");
  url.searchParams.set(CONQUEST_LINK_PARAM, code);
  return url.toString();
}

/** Drops ?conquest= from the address bar without a reload (keeps other params/hash). */
export function clearConquestParam(loc = globalThis.location, hist = globalThis.history) {
  if (!loc?.href || !hist?.replaceState) return;
  const url = new URL(loc.href);
  if (!url.searchParams.has(CONQUEST_LINK_PARAM)) return;
  url.searchParams.delete(CONQUEST_LINK_PARAM);
  hist.replaceState(hist.state, "", `${url.pathname}${url.search}${url.hash}`);
}

/** App launched from a valid invite link (flag on): skip the auth modal, the join signs in anonymously. */
const isOpenedFromInvite = () => isConquestEnabled() && Boolean(readConquestCode());

/** No auth prompt for explicit guests nor for invitees (the join signs them in anonymously). */
export const isGuestLaunch = () => {
  try {
    if (globalThis.localStorage?.getItem("tvrs-guest-mode") === "true") return true;
  } catch {
    /* storage unavailable */
  }
  return isOpenedFromInvite();
};
