import { useState } from "react";

/**
 * Latches to `true` the first time `open` is truthy and never goes back.
 * Lets a React.lazy panel be fetched only on first open while staying mounted
 * afterwards, so its closing (exit) animation still plays as before.
 */
export default function useMountedOnce(open) {
  const [mounted, setMounted] = useState(Boolean(open));
  if (open && !mounted) setMounted(true);
  return mounted || Boolean(open);
}
