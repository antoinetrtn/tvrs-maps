/**
 * Pixel world map for the Conquest rules illustration (48 x 16 cells, one cell = one "country").
 * '.' ocean, 'f' neutral/free, 'a' captured by you in scene 2 (France / Western Europe),
 * 'o' opponent territory (kept in scene 3-5), 's' opponent territory captured in scene 3
 * and stolen by you with a stepped wipe + square shield in scene 4.
 */
export const MAP_ASCII = [
  "...............ffff.............................",
  ".....fffffffff.fffff........ffffffffffffffff....",
  "....fffffffffff.fff.....fffff.fffffffffffffff...",
  "...fffoooofffff......ffffffffffffffffffffffff...",
  "...fffooooffff.......faaaaffffffssssffffffff.ff.",
  "....fffffffff........faaaaffffffssssffffffff.ff.",
  ".....fffffff.........faaaaffffffssssfffffff.....",
  "......fffff...........ffffffffffffffffffff......",
  "........fff..........ffffffffffffff.fffff.......",
  ".........fff.........fffffffffffff..fff.........",
  "...........fffff......ffffffffffff...fffff......",
  "..........ffffffff.....fffffffff.......fffff....",
  "..........fffffffff.....fffffff.................",
  "...........ffffffff.....ffffff..........ffffff..",
  "............ffffff.......fffff.f.......ffffffff.",
  "............ffff..........fff...........ffffff..",
];

export const MAP_COLS = 48;
export const MAP_ROWS = MAP_ASCII.length;

/** One path per map letter plus `all` for the full neutral base layer. */
export function buildLetterPaths(map = MAP_ASCII) {
  const paths = { all: "", f: "", a: "", o: "", s: "" };
  for (let r = 0; r < map.length; r += 1) {
    const row = map[r];
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      if (paths[ch] !== undefined) {
        const cell = `M${c} ${r}h1v1h-1z`;
        paths[ch] += cell;
        paths.all += cell;
      }
    }
  }
  return paths;
}
