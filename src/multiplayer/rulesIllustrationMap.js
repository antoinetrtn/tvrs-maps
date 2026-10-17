/**
 * Pixel world map for the rules illustration (48 x 20 cells, one cell = one "country").
 * '.' ocean, 'f' free, 'a' yours, 'o' opponent, 's' yours + shielded, 'n' the country that
 * gets captured in the loop (free at the start of the loop, yours afterwards).
 */
export const MAP_ASCII = [
  "...............ffff.............................",
  ".....fffffffff.fffff........ffffooooooooofff....",
  "....fffffffffff.fff.....fffff.ffoooooooooffff...",
  "...aaaffssfffff......faaaffffffffffffffffffff...",
  "...aaaffssffff.......faaaffffffffffffaaaaaff.ff.",
  "....aafffffff..........aaffffffffffffaaaaaff.ff.",
  ".....fffffff...........ffffffffffffffaaaaaf.....",
  "......fffff...........nnnfffffffffffffffff......",
  "........fff..........fnnnfffffffffoooffff.......",
  ".........fff.........fnnnffffffff.ooo...........",
  "...........fffff......ffoooooofff..oo.ffff......",
  "..........fffaaaa......fooooooff.......fffff....",
  "..........fffaaaaf......oooooof.................",
  "...........ffaaaaf......ffffff..........ffffff..",
  "............ffffff.......aaaaf.f.......foooooof.",
  "............oooff........aaaa..........foooooof.",
  "............ooof..........aaa...........oooooo..",
  "............ooo..........................ffff...",
  "............oo..................................",
  "............ff..................................",
];

export const MAP_COLS = 48;
export const MAP_ROWS = MAP_ASCII.length;

/** One path per map letter: every land cell is its own 1x1 subpath (the stroke separates them). */
export function buildLetterPaths(map = MAP_ASCII) {
  const paths = { a: "", o: "", f: "", s: "", n: "" };
  for (let r = 0; r < map.length; r += 1) {
    const row = map[r];
    for (let c = 0; c < row.length; c += 1) {
      const ch = row[c];
      if (paths[ch] !== undefined) {
        paths[ch] += `M${c} ${r}h1v1h-1z`;
      }
    }
  }
  return paths;
}
