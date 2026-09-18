(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('gameSvg');
  const boardLayer = document.getElementById('boardLayer');
  const ghostLayer = document.getElementById('ghostLayer');
  const pieceLayer = document.getElementById('pieceLayer');
  const effectsLayer = document.getElementById('effectsLayer');

  let ROWS = 8;
  let COLS = 6;
  const CELL = 64;
  let BOARD = { x: 258, y: 220, w: COLS * CELL, h: ROWS * CELL };
  let boardMask = [];
  const HOME_SCALE = 0.54;
  const VIEW = { w: 900, h: 980 };

  const COLORS = [
    '#ff746b', '#59d69a', '#55bdf3', '#ffd34f',
    '#9a72e7', '#ff9a4d', '#ff7eb2', '#62d7cf',
    '#f5b84c', '#90c96d', '#7f90f4', '#ff8f7b'
  ];

  // Every level owns its board geometry. A # is a playable cell; a . is wooden space.
  // This keeps the game ready for a 50-level pack without locking us to rectangles.
  const LEVELS = [
    {
      title: 'Hello, Little Blocks!',
      subtitle: 'Tutorial: drag a big block into the glowing space.',
      difficulty: 'TUTORIAL',
      scramble: 'none',
      tutorial: true,
      rotationLocked: true,
      par: 5,
      board: { cols: 4, rows: 4, name: 'starter shape', mask: ['####','####','####','####'] },
      pieces: [
        ['Big Block', [[0,0],[1,0],[0,1],[1,1]], 0,0],
        ['Big Block', [[0,0],[1,0],[0,1],[1,1]], 2,0],
        ['Big Block', [[0,0],[1,0],[0,1],[1,1]], 0,2],
        ['Big Block', [[0,0],[1,0],[0,1],[1,1]], 2,2]
      ]
    },
    {
      title: 'First Mix',
      subtitle: 'Still easy: different pieces, but they are already facing the right way.',
      difficulty: 'EASY',
      scramble: 'none',
      rotationLocked: true,
      par: 9,
      board: { cols: 5, rows: 4, name: 'little rectangle', mask: ['#####','#####','#####','#####'] },
      pieces: [
        ['Tiny Corner', [[0,0],[0,1],[1,0]], 3,0],
        ['Tiny Corner', [[0,1],[1,0],[1,1]], 3,1],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 0,2],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 0,0],
        ['Short Bar', [[0,0],[1,0],[2,0]], 2,3],
        ['Short Bar', [[0,0],[0,1],[0,2]], 2,0]
      ]
    },
    {
      title: 'Arrow Garden',
      subtitle: 'Rotation is on. The board has a real silhouette now, so read the empty space.',
      difficulty: 'EASY +',
      scramble: 'half',
      par: 13,
      board: { cols: 7, rows: 6, name: 'arrow', mask: ['..###..','.#####.','#######','..###..','..###..','..###..'] },
      pieces: [
        ['Tiny Corner', [[0,0],[0,1],[1,1]], 5,1],
        ['Tiny Corner', [[0,1],[1,0],[1,1]], 0,1],
        ['Short Bar', [[0,0],[0,1],[0,2]], 4,0],
        ['Short Bar', [[0,0],[0,1],[0,2]], 2,2],
        ['Tee', [[0,1],[1,0],[1,1],[2,1]], 2,4],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 2,0],
        ['Zig', [[0,0],[0,1],[1,1],[1,2]], 3,2]
      ]
    },
    {
      title: 'Step by Step',
      subtitle: 'The staircase looks simple until the P-piece turns up.',
      difficulty: 'MEDIUM',
      scramble: 'all',
      par: 12,
      board: { cols: 7, rows: 7, name: 'staircase', mask: ['##.....','###....','.###...','..###..','...###.','....###','.....##'] },
      pieces: [
        ['Tee', [[0,1],[1,0],[1,1],[2,1]], 1,1],
        ['Short Bar', [[0,0],[1,0],[2,0]], 3,4],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 0,0],
        ['Short Bar', [[0,0],[1,0],[2,0]], 2,3],
        ['P Pocket', [[0,0],[1,0],[1,1],[2,0],[2,1]], 4,5]
      ]
    },
    {
      title: 'Plus One',
      subtitle: 'A compact cross with fewer pieces, but every rotation matters.',
      difficulty: 'MEDIUM',
      scramble: 'all',
      par: 12,
      board: { cols: 6, rows: 6, name: 'plus', mask: ['..##..','..##..','######','######','..##..','..##..'] },
      pieces: [
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 1,2],
        ['Hook', [[0,0],[0,1],[1,1],[2,1]], 0,2],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 2,4],
        ['Long L', [[0,1],[1,1],[2,0],[2,1]], 3,2],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 2,0]
      ]
    },
    {
      title: 'Pixel Diamond',
      subtitle: 'Now the pieces start lying to your eyes. Look for pockets, not colors.',
      difficulty: 'TRICKY',
      scramble: 'all',
      par: 16,
      board: { cols: 7, rows: 7, name: 'diamond', mask: ['...#...','..###..','.#####.','#######','.#####.','..###..','...#...'] },
      pieces: [
        ['Tiny Corner', [[0,0],[1,0],[1,1]], 0,3],
        ['Wiggle Five', [[0,1],[0,2],[1,0],[1,1],[2,0]], 3,4],
        ['Tee', [[0,1],[1,0],[1,1],[2,1]], 4,2],
        ['Tiny Corner', [[0,1],[1,0],[1,1]], 1,1],
        ['Tiny Corner', [[0,0],[0,1],[1,1]], 3,0],
        ['Hook', [[0,0],[0,1],[0,2],[1,0]], 3,2],
        ['Short Bar', [[0,0],[0,1],[0,2]], 2,3]
      ]
    },
    {
      title: 'Keyhole Club',
      subtitle: 'Two U-pieces share the same room. This is where planning starts to matter.',
      difficulty: 'TRICKY',
      scramble: 'all',
      par: 16,
      board: { cols: 7, rows: 7, name: 'keyhole', mask: ['..###..','.#####.','.#####.','..###..','..###..','..###..','..###..'] },
      pieces: [
        ['Zig', [[0,0],[0,1],[1,1],[1,2]], 1,1],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 3,3],
        ['Tiny Corner', [[0,1],[1,0],[1,1]], 3,5],
        ['U Cup', [[0,0],[0,1],[1,0],[2,0],[2,1]], 2,0],
        ['U Cup', [[0,0],[0,1],[1,1],[2,0],[2,1]], 3,1],
        ['Tee', [[0,0],[0,1],[0,2],[1,1]], 2,4]
      ]
    },
    {
      title: 'U-Turn',
      subtitle: 'The empty center is not playable. Long pieces can create nasty dead ends.',
      difficulty: 'HARD',
      scramble: 'all',
      par: 19,
      board: { cols: 7, rows: 6, name: 'U shape', mask: ['##...##','##...##','##...##','##...##','#######','#######'] },
      pieces: [
        ['Hook', [[0,0],[0,1],[0,2],[1,0]], 0,0],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 1,5],
        ['Short Bar', [[0,0],[0,1],[0,2]], 1,1],
        ['Short Bar', [[0,0],[1,0],[2,0]], 3,4],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 5,0],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 5,2],
        ['Tiny Corner', [[0,1],[1,0],[1,1]], 5,4],
        ['Tall Tee', [[0,0],[0,1],[0,2],[1,1],[2,1]], 0,3]
      ]
    },
    {
      title: 'Heartbreaker',
      subtitle: 'A cute board with mean little decisions. Do not trust the obvious first fit.',
      difficulty: 'HARD',
      scramble: 'all',
      par: 22,
      board: { cols: 8, rows: 7, name: 'heart', mask: ['.##..##.','########','########','.######.','..####..','...##...','...##...'] },
      pieces: [
        ['Tiny Corner', [[0,0],[1,0],[1,1]], 1,3],
        ['P Pocket', [[0,1],[0,2],[1,0],[1,1],[1,2]], 0,0],
        ['Tiny Corner', [[0,0],[0,1],[1,0]], 5,3],
        ['Tiny Corner', [[0,0],[0,1],[1,1]], 6,0],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 4,3],
        ['Long L', [[0,0],[0,1],[0,2],[1,2]], 2,0],
        ['Long L', [[0,1],[1,1],[2,0],[2,1]], 3,0],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 3,3],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 4,2]
      ]
    },
    {
      title: 'Crown Jewel',
      subtitle: 'Prototype boss level: five-cell pieces, narrow teeth, and very little forgiveness.',
      difficulty: 'BOSS',
      scramble: 'all',
      par: 22,
      board: { cols: 7, rows: 6, name: 'crown', mask: ['#.#.#.#','#######','.#####.','.#####.','.#####.','.#####.'] },
      pieces: [
        ['P Pocket', [[0,1],[0,2],[1,0],[1,1],[1,2]], 3,0],
        ['U Cup', [[0,0],[0,1],[1,1],[2,0],[2,1]], 0,0],
        ['Big V', [[0,2],[1,2],[2,0],[2,1],[2,2]], 3,2],
        ['Tall Tee', [[0,0],[0,1],[0,2],[1,1],[2,1]], 2,2],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,3]], 1,2],
        ['Tiny Corner', [[0,1],[1,0],[1,1]], 5,0],
        ['Short Bar', [[0,0],[1,0],[2,0]], 3,5]
      ]
    },
    {
      title: 'Lightning Lane',
      subtitle: 'A narrow zig-zag. The five pieces are chunky, but the turns punish lazy rotations.',
      difficulty: 'HARD',
      scramble: 'all',
      par: 16,
      board: { cols: 7, rows: 8, name: 'lightning', mask: ['....##.','...###.','..###..','.###...','###....','.###...','..###..','...##..'] },
      pieces: [
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 1,4],
        ['P Pocket', [[0,0],[0,1],[0,2],[1,0],[1,1]], 4,0],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 3,6],
        ['Zig', [[0,1],[1,0],[1,1],[2,0]], 0,3],
        ['Tee', [[0,1],[1,0],[1,1],[1,2]], 2,1]
      ]
    },
    {
      title: 'Rocket Pocket',
      subtitle: 'Fins, nose, and a skinny middle. Solve the awkward pockets before the center fills up.',
      difficulty: 'HARD',
      scramble: 'all',
      par: 19,
      board: { cols: 7, rows: 7, name: 'rocket', mask: ['..###..','.#####.','#######','..###..','..###..','.#####.','##.#.##'] },
      pieces: [
        ['N Bend', [[0,1],[1,0],[1,1],[2,0],[3,0]], 1,0],
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 2,4],
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 0,1],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,1]], 4,1],
        ['U Cup', [[0,0],[0,1],[1,0],[2,0],[2,1]], 2,3],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 5,5],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 0,5]
      ]
    },
    {
      title: 'Hourglass Hustle',
      subtitle: 'The waist is the trap. Long pieces that look perfect can block the other half.',
      difficulty: 'HARD +',
      scramble: 'all',
      par: 20,
      board: { cols: 7, rows: 7, name: 'hourglass', mask: ['#######','.#####.','..###..','...#...','..###..','.#####.','#######'] },
      pieces: [
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 0,5],
        ['F Twist', [[0,1],[1,1],[1,2],[2,0],[2,1]], 2,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,0],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,1]], 4,5],
        ['N Bend', [[0,1],[1,0],[1,1],[2,0],[3,0]], 1,4],
        ['Mini Bar', [[0,0],[1,0],[2,0]], 1,1],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 5,0]
      ]
    },
    {
      title: 'Pixel Star',
      subtitle: 'Only six pieces, but almost every arm can accept the wrong shape first.',
      difficulty: 'EXPERT',
      scramble: 'all',
      par: 18,
      board: { cols: 7, rows: 7, name: 'star', mask: ['...#...','.#####.','..###..','#######','..###..','.#####.','...#...'] },
      pieces: [
        ['F Twist', [[0,1],[1,1],[1,2],[2,0],[2,1]], 1,0],
        ['Y Fork', [[0,0],[1,0],[2,0],[2,1],[3,0]], 0,3],
        ['Tall Tee', [[0,1],[1,1],[2,0],[2,1],[2,2]], 1,4],
        ['Zig', [[0,1],[1,0],[1,1],[2,0]], 3,1],
        ['Mini Bar', [[0,0],[1,0],[2,0]], 4,3],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 4,4]
      ]
    },
    {
      title: 'Snake Trail',
      subtitle: 'A twisting corridor puzzle. Think two moves ahead before dropping a long piece.',
      difficulty: 'EXPERT',
      scramble: 'all',
      par: 19,
      board: { cols: 8, rows: 8, name: 'snake', mask: ['####....','...###..','....###.','...###..','..###...','.###....','###.....','####....'] },
      pieces: [
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 2,3],
        ['Z Five', [[0,0],[1,0],[1,1],[1,2],[2,2]], 1,5],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 0,6],
        ['Tee', [[0,0],[1,0],[1,1],[2,0]], 3,1],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 0,0],
        ['Zig', [[0,1],[1,0],[1,1],[2,0]], 4,2]
      ]
    },
    {
      title: 'Butterfly Effect',
      subtitle: 'Two wings, tiny bridges, and lots of little corners competing for the same pockets.',
      difficulty: 'EXPERT',
      scramble: 'all',
      par: 24,
      board: { cols: 8, rows: 7, name: 'butterfly', mask: ['##....##','###..###','.######.','..####..','.######.','###..###','##....##'] },
      pieces: [
        ['Z Five', [[0,1],[0,2],[1,1],[2,0],[2,1]], 2,2],
        ['Big V', [[0,2],[1,2],[2,0],[2,1],[2,2]], 3,2],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,1]], 0,0],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 6,0],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 5,1],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 0,5],
        ['Mini Bar', [[0,0],[1,0],[2,0]], 1,2],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 1,4],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 5,4],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 6,5]
      ]
    },
    {
      title: 'Clover Trouble',
      subtitle: 'The missing center changes everything. Keep the bulky five-cell pieces flexible.',
      difficulty: 'EXPERT +',
      scramble: 'all',
      par: 24,
      board: { cols: 7, rows: 7, name: 'clover', mask: ['..###..','.#####.','#######','###.###','#######','.#####.','..###..'] },
      pieces: [
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 1,0],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 5,1],
        ['U Cup', [[0,0],[0,2],[1,0],[1,1],[1,2]], 3,4],
        ['Wiggle Five', [[0,1],[0,2],[1,0],[1,1],[2,0]], 1,2],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 3,0],
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 1,4],
        ['Mini Bar', [[0,0],[0,1],[0,2]], 0,2],
        ['Mini Bar', [[0,0],[0,1],[0,2]], 6,2]
      ]
    },
    {
      title: 'Moon Bite',
      subtitle: 'The crescent gets tight fast. The outer curve is easy; the inner bite is not.',
      difficulty: 'MASTER',
      scramble: 'all',
      par: 24,
      board: { cols: 8, rows: 8, name: 'moon', mask: ['..#####.','.####...','####....','###.....','###.....','####....','.####...','..#####.'] },
      pieces: [
        ['Y Fork', [[0,0],[1,0],[2,0],[2,1],[3,0]], 1,1],
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 2,5],
        ['Big V', [[0,0],[0,1],[0,2],[1,2],[2,2]], 0,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,0],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 1,2],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 3,7],
        ['Tee', [[0,0],[1,0],[1,1],[2,0]], 0,5]
      ]
    },
    {
      title: 'Cactus Jam',
      subtitle: 'Branches create fake-perfect fits. Protect the neck before filling the arms.',
      difficulty: 'MASTER',
      scramble: 'all',
      par: 26,
      board: { cols: 8, rows: 8, name: 'cactus', mask: ['..###...','..###.##','..######','##.###..','######..','..###...','..###...','.#####..'] },
      pieces: [
        ['Tall Tee', [[0,2],[1,0],[1,1],[1,2],[2,2]], 3,5],
        ['U Cup', [[0,0],[0,1],[1,0],[2,0],[2,1]], 2,0],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,1]], 0,3],
        ['Wiggle Five', [[0,2],[1,1],[1,2],[2,0],[2,1]], 2,3],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 6,1],
        ['Hook', [[0,0],[1,0],[1,1],[1,2]], 4,2],
        ['Zig', [[0,1],[1,0],[1,1],[2,0]], 1,6],
        ['Tee', [[0,1],[1,0],[1,1],[1,2]], 2,1]
      ]
    },
    {
      title: 'Spiral Trap',
      subtitle: 'Follow the corridor inward. One greedy placement can seal the spiral too early.',
      difficulty: 'MASTER',
      scramble: 'all',
      par: 27,
      board: { cols: 7, rows: 7, name: 'spiral', mask: ['#######','##.....','##.###.','##.#.#.','##.#.#.','##.###.','#######'] },
      pieces: [
        ['N Bend', [[0,0],[0,1],[1,1],[1,2],[1,3]], 0,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,0],
        ['F Twist', [[0,1],[1,0],[1,1],[1,2],[2,2]], 4,4],
        ['U Cup', [[0,0],[0,1],[1,0],[2,0],[2,1]], 3,2],
        ['Hook', [[0,0],[0,1],[0,2],[1,2]], 3,4],
        ['Tee', [[0,1],[1,0],[1,1],[2,1]], 0,5],
        ['Mini Bar', [[0,0],[0,1],[0,2]], 0,3],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 0,0]
      ]
    },
    {
      title: 'Picture Frame',
      subtitle: 'A hollow-center puzzle. The border looks roomy until the last three pieces arrive.',
      difficulty: 'MASTER +',
      scramble: 'all',
      par: 27,
      board: { cols: 7, rows: 7, name: 'frame', mask: ['#######','##...##','##...##','##...##','##...##','##...##','#######'] },
      pieces: [
        ['P Pocket', [[0,1],[0,2],[1,0],[1,1],[1,2]], 0,1],
        ['Long L Five', [[0,0],[0,1],[1,0],[2,0],[3,0]], 0,0],
        ['Tall Tee', [[0,0],[1,0],[1,1],[1,2],[2,0]], 4,0],
        ['Big V', [[0,0],[0,1],[0,2],[1,2],[2,2]], 1,4],
        ['Y Fork', [[0,2],[1,0],[1,1],[1,2],[1,3]], 5,1],
        ['Mini Bar', [[0,0],[1,0],[2,0]], 4,6],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 5,4],
        ['Mini Bar', [[0,0],[0,1],[0,2]], 0,4]
      ]
    },
    {
      title: 'Trophy Room',
      subtitle: 'Wide cup, narrow stem, broad base. Each zone wants a different kind of piece.',
      difficulty: 'MASTER +',
      scramble: 'all',
      par: 30,
      board: { cols: 7, rows: 8, name: 'trophy', mask: ['.#####.','#######','#######','.#####.','..###..','..###..','.#####.','#######'] },
      pieces: [
        ['Y Fork', [[0,0],[1,0],[2,0],[2,1],[3,0]], 1,0],
        ['Wiggle Five', [[0,2],[1,1],[1,2],[2,0],[2,1]], 0,5],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 1,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,7],
        ['Tall Tee', [[0,2],[1,0],[1,1],[1,2],[2,2]], 3,4],
        ['Big V', [[0,0],[0,1],[0,2],[1,0],[2,0]], 3,3],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 3,2],
        ['Zig', [[0,0],[0,1],[1,1],[1,2]], 0,1],
        ['Tee', [[0,1],[1,0],[1,1],[2,1]], 4,0]
      ]
    },
    {
      title: 'Castle Crunch',
      subtitle: 'Ten pieces and three crown notches. Solve the roof before packing the walls.',
      difficulty: 'NIGHTMARE',
      scramble: 'all',
      par: 34,
      board: { cols: 8, rows: 7, name: 'castle', mask: ['##.##.##','########','########','.######.','.######.','.######.','.######.'] },
      pieces: [
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 2,2],
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 4,1],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 1,2],
        ['Wiggle Five', [[0,1],[0,2],[1,0],[1,1],[2,0]], 2,0],
        ['P Pocket', [[0,0],[0,1],[0,2],[1,0],[1,1]], 0,0],
        ['Big V', [[0,2],[1,2],[2,0],[2,1],[2,2]], 4,4],
        ['N Bend', [[0,1],[1,1],[2,0],[2,1],[3,0]], 4,0],
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 3,4],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 5,3],
        ['Mini Bar', [[0,0],[0,1],[0,2]], 2,4]
      ]
    },
    {
      title: 'Robot Factory',
      subtitle: 'Big body, split legs, tiny gaps. This one rewards planning over trial and error.',
      difficulty: 'NIGHTMARE',
      scramble: 'all',
      par: 35,
      board: { cols: 8, rows: 8, name: 'robot', mask: ['.######.','########','##.##.##','########','.######.','..####..','.##..##.','##....##'] },
      pieces: [
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 4,3],
        ['U Cup', [[0,0],[0,1],[1,0],[2,0],[2,1]], 1,1],
        ['Z Five', [[0,1],[0,2],[1,1],[2,0],[2,1]], 4,0],
        ['N Bend', [[0,0],[0,1],[1,1],[1,2],[1,3]], 1,3],
        ['Tall Tee', [[0,0],[1,0],[1,1],[1,2],[2,0]], 2,3],
        ['Wiggle Five', [[0,0],[0,1],[1,1],[1,2],[2,2]], 5,5],
        ['P Pocket', [[0,1],[0,2],[1,0],[1,1],[1,2]], 6,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,0],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 0,6],
        ['Mini Bar', [[0,0],[0,1],[0,2]], 0,1]
      ]
    },
    {
      title: 'Monster Mash',
      subtitle: 'Final test: eyes, teeth, legs, and ten mixed pieces. Cute face, nasty packing problem.',
      difficulty: 'BOSS',
      scramble: 'all',
      par: 36,
      board: { cols: 8, rows: 8, name: 'monster', mask: ['.##..##.','########','########','##.##.##','########','.######.','..#..#..','.##..##.'] },
      pieces: [
        ['U Cup', [[0,0],[0,2],[1,0],[1,1],[1,2]], 1,5],
        ['F Twist', [[0,0],[1,0],[1,1],[1,2],[2,1]], 0,1],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 3,1],
        ['Y Fork', [[0,0],[1,0],[2,0],[2,1],[3,0]], 4,4],
        ['Big V', [[0,0],[0,1],[0,2],[1,2],[2,2]], 0,2],
        ['P Pocket', [[0,0],[0,1],[0,2],[1,0],[1,1]], 4,1],
        ['Z Five', [[0,0],[1,0],[1,1],[1,2],[2,2]], 4,5],
        ['Wiggle Five', [[0,0],[1,0],[1,1],[2,1],[2,2]], 5,0],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 6,2],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 1,0]
      ]
    },
    {
      title: 'Fin & Fit',
      subtitle: 'The tail looks generous, but the belly can trap long pieces.',
      difficulty: 'EXPERT',
      scramble: 'all',
      par: 33,
      board: { cols: 8, rows: 6, name: 'fin & fit', mask: ['..####..', '.######.', '########', '.######.', '..####..', '...##...'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,1],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 2,0],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,3],
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 5,1],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 2,4],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 4,4]
      ]
    },
    {
      title: 'Mushroom Grove',
      subtitle: 'A round cap and narrow stem make the center more important than it looks.',
      difficulty: 'EXPERT',
      scramble: 'all',
      par: 33,
      board: { cols: 8, rows: 6, name: 'mushroom grove', mask: ['..####..', '.######.', '########', '..####..', '..####..', '..####..'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,1],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 2,0],
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 5,1],
        ['Long L Five', [[0,0],[0,1],[1,1],[2,1],[3,1]], 2,4],
        ['Short Bar', [[0,0],[1,0],[2,0]], 2,3],
        ['Short Bar', [[0,0],[1,0],[2,0]], 3,4]
      ]
    },
    {
      title: 'Boo Blocks',
      subtitle: 'Wide head, split feet. Save flexible pieces for the lower gaps.',
      difficulty: 'EXPERT +',
      scramble: 'all',
      par: 39,
      board: { cols: 8, rows: 6, name: 'boo blocks', mask: ['.######.', '########', '########', '########', '##.##.##', '##.##.##'] },
      pieces: [
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 0,1],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 1,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,0],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 7,1],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 5,2],
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 3,0],
        ['P Pocket', [[0,0],[0,1],[0,2],[1,1],[1,2]], 2,1],
        ['Tee', [[0,0],[0,1],[0,2],[1,1]], 4,2],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 3,4]
      ]
    },
    {
      title: 'Anchor Drop',
      subtitle: 'The crossbar is roomy; the curved base is where plans sink.',
      difficulty: 'MASTER',
      scramble: 'all',
      par: 30,
      board: { cols: 8, rows: 7, name: 'anchor drop', mask: ['...##...', '...##...', '.######.', '...##...', '..####..', '.##..##.', '##....##'] },
      pieces: [
        ['Wiggle Five', [[0,0],[0,1],[1,1],[1,2],[2,2]], 5,4],
        ['Wiggle Five', [[0,2],[1,1],[1,2],[2,0],[2,1]], 0,4],
        ['Tall Tee', [[0,0],[0,1],[0,2],[1,1],[2,1]], 4,1],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 3,3],
        ['Short Bar', [[0,0],[1,0],[2,0]], 1,2],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 3,0]
      ]
    },
    {
      title: 'Pine Puzzle',
      subtitle: 'Work from the branches inward before the trunk becomes a bottleneck.',
      difficulty: 'MASTER',
      scramble: 'all',
      par: 37,
      board: { cols: 8, rows: 7, name: 'pine puzzle', mask: ['...##...', '..####..', '.######.', '########', '..####..', '..####..', '..####..'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,3],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,2],
        ['F Twist', [[0,1],[1,0],[1,1],[2,1],[2,2]], 0,2],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 2,0],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 4,0],
        ['Long L Five', [[0,0],[0,1],[1,0],[2,0],[3,0]], 2,5],
        ['Short Bar', [[0,0],[1,0],[2,0]], 3,4],
        ['Short Bar', [[0,0],[1,0],[2,0]], 3,6]
      ]
    },
    {
      title: 'Paw Prints',
      subtitle: 'Four pads, one big center, and several deceptively friendly pockets.',
      difficulty: 'MASTER',
      scramble: 'all',
      par: 34,
      board: { cols: 8, rows: 6, name: 'paw prints', mask: ['.##..##.', '.##..##.', '...##...', '.######.', '########', '.######.'] },
      pieces: [
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 1,0],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 5,0],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,4],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,5],
        ['N Bend', [[0,1],[1,1],[2,0],[2,1],[3,0]], 1,2],
        ['Tee', [[0,0],[1,0],[1,1],[2,0]], 4,3],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 6,4]
      ]
    },
    {
      title: 'Shell Game',
      subtitle: 'A broad shell with tiny feet. Edge pieces matter more than the center.',
      difficulty: 'MASTER +',
      scramble: 'all',
      par: 37,
      board: { cols: 8, rows: 6, name: 'shell game', mask: ['..####..', '.######.', '########', '########', '.######.', '..#..#..'] },
      pieces: [
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 2,1],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 0,1],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 0,3],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 2,0],
        ['Long L Five', [[0,3],[1,0],[1,1],[1,2],[1,3]], 3,1],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 4,0],
        ['Wiggle Five', [[0,1],[0,2],[1,0],[1,1],[2,0]], 5,3],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 6,1]
      ]
    },
    {
      title: 'Wing Balance',
      subtitle: 'Symmetric wings tempt symmetric mistakes. Keep the body corridor open.',
      difficulty: 'MASTER +',
      scramble: 'all',
      par: 31,
      board: { cols: 8, rows: 7, name: 'wing balance', mask: ['##....##', '.##..##.', '..####..', '...##...', '..####..', '.##..##.', '##....##'] },
      pieces: [
        ['Wiggle Five', [[0,1],[0,2],[1,0],[1,1],[2,0]], 5,0],
        ['Wiggle Five', [[0,0],[0,1],[1,1],[1,2],[2,2]], 5,4],
        ['Wiggle Five', [[0,0],[1,0],[1,1],[2,1],[2,2]], 0,0],
        ['Wiggle Five', [[0,2],[1,1],[1,2],[2,0],[2,1]], 0,4],
        ['Short Bar', [[0,0],[0,1],[0,2]], 4,2],
        ['Short Bar', [[0,0],[0,1],[0,2]], 3,2]
      ]
    },
    {
      title: 'Tea Time Tangle',
      subtitle: 'The handle creates a pocket that is easy to seal too early.',
      difficulty: 'MASTER +',
      scramble: 'all',
      par: 34,
      board: { cols: 8, rows: 6, name: 'tea time tangle', mask: ['######..', '######..', '######..', '.####.##', '.######.', '..####..'] },
      pieces: [
        ['Wiggle Five', [[0,1],[0,2],[1,0],[1,1],[2,0]], 5,3],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,0],
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 2,0],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[1,2]], 0,1],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,0]], 4,2],
        ['P Pocket', [[0,0],[1,0],[1,1],[2,0],[2,1]], 1,4],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 2,2]
      ]
    },
    {
      title: 'Melody Mix',
      subtitle: 'A tall stem and heavy note head turn simple bars into awkward choices.',
      difficulty: 'NIGHTMARE',
      scramble: 'all',
      par: 32,
      board: { cols: 8, rows: 7, name: 'melody mix', mask: ['....###.', '....###.', '....###.', '....###.', '..#####.', '.######.', '.####...'] },
      pieces: [
        ['Long L Five', [[0,0],[0,1],[1,0],[2,0],[3,0]], 1,5],
        ['Short Bar', [[0,0],[1,0],[2,0]], 2,6],
        ['Long L Five', [[0,0],[1,0],[2,0],[3,0],[3,1]], 2,4],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 6,1],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,0]], 5,0],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 4,0]
      ]
    },
    {
      title: 'Shield Wall',
      subtitle: 'A broad top narrows quickly. Solve the shoulders before the tip.',
      difficulty: 'NIGHTMARE',
      scramble: 'all',
      par: 38,
      board: { cols: 8, rows: 6, name: 'shield wall', mask: ['.######.', '########', '########', '.######.', '..####..', '...##...'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,0],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,3],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 2,4],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 4,4],
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 0,0],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 1,2]
      ]
    },
    {
      title: 'Blade Runner',
      subtitle: 'Long and skinny means every rotation can block half the board.',
      difficulty: 'NIGHTMARE',
      scramble: 'all',
      par: 32,
      board: { cols: 8, rows: 8, name: 'blade runner', mask: ['...##...', '...##...', '...##...', '...##...', '..####..', '...##...', '..####..', '.######.'] },
      pieces: [
        ['Long L Five', [[0,0],[0,1],[1,1],[2,1],[3,1]], 3,6],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 1,6],
        ['U Cup', [[0,0],[0,1],[0,2],[1,0],[1,2]], 4,4],
        ['Y Fork', [[0,2],[1,0],[1,1],[1,2],[1,3]], 2,2],
        ['Short Bar', [[0,0],[0,1],[0,2]], 4,1],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 3,0]
      ]
    },
    {
      title: 'Peak Pressure',
      subtitle: 'Wide foothills, narrow summit. Pack the slopes before the center.',
      difficulty: 'NIGHTMARE',
      scramble: 'all',
      par: 38,
      board: { cols: 8, rows: 6, name: 'peak pressure', mask: ['...##...', '..####..', '.######.', '########', '########', '##.##.##'] },
      pieces: [
        ['P Pocket', [[0,0],[0,1],[0,2],[1,1],[1,2]], 0,3],
        ['P Pocket', [[0,0],[1,0],[1,1],[2,0],[2,1]], 5,4],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,3],
        ['P Pocket', [[0,0],[1,0],[1,1],[2,0],[2,1]], 2,4],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,2],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 1,2],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 2,0],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 4,0]
      ]
    },
    {
      title: 'Snowflake Spin',
      subtitle: 'Six directions, lots of symmetry, and very few safe assumptions.',
      difficulty: 'NIGHTMARE +',
      scramble: 'all',
      par: 38,
      board: { cols: 8, rows: 7, name: 'snowflake spin', mask: ['...##...', '.######.', '..####..', '########', '..####..', '.######.', '...##...'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,3],
        ['Tall Tee', [[0,1],[1,1],[2,0],[2,1],[2,2]], 0,2],
        ['Tall Tee', [[0,1],[1,1],[2,0],[2,1],[2,2]], 1,4],
        ['Short Bar', [[0,0],[0,1],[0,2]], 4,4],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 5,4],
        ['Tall Tee', [[0,1],[1,1],[2,0],[2,1],[2,2]], 1,0],
        ['Short Bar', [[0,0],[0,1],[0,2]], 4,0],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 5,1]
      ]
    },
    {
      title: 'Temple Trial',
      subtitle: 'Columns create isolated pockets. Leave yourself routes between chambers.',
      difficulty: 'NIGHTMARE +',
      scramble: 'all',
      par: 42,
      board: { cols: 8, rows: 7, name: 'temple trial', mask: ['..####..', '.######.', '########', '.##..##.', '.##..##.', '.##..##.', '########'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,6],
        ['Long L Five', [[0,3],[1,0],[1,1],[1,2],[1,3]], 0,3],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 2,2],
        ['Wiggle Five', [[0,2],[1,1],[1,2],[2,0],[2,1]], 0,0],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 5,1],
        ['Short Bar', [[0,0],[0,1],[0,2]], 6,3],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 6,1],
        ['Hook', [[0,0],[0,1],[0,2],[1,0]], 4,0],
        ['Short Bar', [[0,0],[0,1],[0,2]], 3,0]
      ]
    },
    {
      title: 'UFO Landing',
      subtitle: 'The saucer is forgiving until the landing legs need space.',
      difficulty: 'COSMIC',
      scramble: 'all',
      par: 36,
      board: { cols: 8, rows: 6, name: 'ufo landing', mask: ['..####..', '.######.', '########', '.######.', '..####..', '.##..##.'] },
      pieces: [
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,3]], 5,2],
        ['F Twist', [[0,0],[1,0],[1,1],[1,2],[2,1]], 5,1],
        ['Long L Five', [[0,3],[1,0],[1,1],[1,2],[1,3]], 1,2],
        ['F Twist', [[0,1],[1,0],[1,1],[1,2],[2,0]], 0,1],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 2,0],
        ['Hook', [[0,0],[0,1],[0,2],[1,0]], 4,0],
        ['Corner Trio', [[0,1],[1,0],[1,1]], 3,3]
      ]
    },
    {
      title: 'Signal Jam',
      subtitle: 'Two panels and a narrow core make long pieces surprisingly dangerous.',
      difficulty: 'COSMIC',
      scramble: 'all',
      par: 39,
      board: { cols: 8, rows: 7, name: 'signal jam', mask: ['##....##', '###..###', '.######.', '...##...', '.######.', '###..###', '##....##'] },
      pieces: [
        ['P Pocket', [[0,0],[0,1],[0,2],[1,0],[1,1]], 6,0],
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 2,1],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 1,1],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 0,0],
        ['P Pocket', [[0,0],[0,1],[0,2],[1,1],[1,2]], 6,4],
        ['Wiggle Five', [[0,0],[1,0],[1,1],[2,1],[2,2]], 3,3],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,0]], 1,4],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 0,5]
      ]
    },
    {
      title: 'Ringed World',
      subtitle: 'The ring-like tail adds awkward edge cells around a dense planet.',
      difficulty: 'COSMIC +',
      scramble: 'all',
      par: 45,
      board: { cols: 8, rows: 8, name: 'ringed world', mask: ['..####..', '.######.', '########', '########', '.######.', '..####..', '##....##', '.##..##.'] },
      pieces: [
        ['Zig', [[0,1],[1,0],[1,1],[2,0]], 5,6],
        ['Zig', [[0,0],[1,0],[1,1],[2,1]], 0,6],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,1],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 2,0],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,3],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,4],
        ['Long Bar', [[0,0],[1,0],[2,0],[3,0]], 2,5],
        ['F Twist', [[0,1],[0,2],[1,0],[1,1],[2,1]], 5,1],
        ['Corner Trio', [[0,0],[0,1],[1,0]], 6,3]
      ]
    },
    {
      title: 'Comet Chase',
      subtitle: 'A diagonal silhouette rewards planning several moves ahead.',
      difficulty: 'COSMIC +',
      scramble: 'all',
      par: 33,
      board: { cols: 8, rows: 7, name: 'comet chase', mask: ['.....###', '....####', '...#####', '..######', '.####...', '###.....', '##......'] },
      pieces: [
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,0]], 0,5],
        ['Long L Five', [[0,1],[1,1],[2,1],[3,0],[3,1]], 1,3],
        ['Wiggle Five', [[0,2],[1,1],[1,2],[2,0],[2,1]], 2,1],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,0]], 6,0],
        ['Short Bar', [[0,0],[0,1],[0,2]], 7,1],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 5,0]
      ]
    },
    {
      title: 'Space Invader',
      subtitle: 'Classic pixel symmetry hides several one-way placements.',
      difficulty: 'COSMIC BOSS',
      scramble: 'all',
      par: 40,
      board: { cols: 8, rows: 7, name: 'space invader', mask: ['.##..##.', '..####..', '.######.', '########', '##.##.##', '##....##', '.##..##.'] },
      pieces: [
        ['Long L Five', [[0,3],[1,0],[1,1],[1,2],[1,3]], 5,3],
        ['Short Bar', [[0,0],[0,1],[0,2]], 7,3],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,3]], 1,3],
        ['Short Bar', [[0,0],[0,1],[0,2]], 0,3],
        ['U Cup', [[0,0],[0,2],[1,0],[1,1],[1,2]], 1,0],
        ['U Cup', [[0,0],[0,1],[0,2],[1,0],[1,2]], 5,0],
        ['Y Fork', [[0,2],[1,0],[1,1],[1,2],[1,3]], 2,1],
        ['Y Fork', [[0,0],[0,1],[0,2],[0,3],[1,2]], 4,1]
      ]
    },
    {
      title: 'Skull Lock',
      subtitle: 'Eyes and teeth break the board into small strategic zones.',
      difficulty: 'FINAL',
      scramble: 'all',
      par: 43,
      board: { cols: 8, rows: 7, name: 'skull lock', mask: ['.######.', '########', '########', '##.##.##', '########', '.######.', '..#..#..'] },
      pieces: [
        ['P Pocket', [[0,0],[0,1],[0,2],[1,0],[1,1]], 5,4],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 6,1],
        ['Long L Five', [[0,0],[1,0],[2,0],[3,0],[3,1]], 3,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,0],
        ['Long L Five', [[0,0],[0,1],[1,0],[2,0],[3,0]], 2,1],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 1,0],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 0,1],
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 1,4],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[1,2]], 3,3]
      ]
    },
    {
      title: "Dragon's Den",
      subtitle: 'The body is broad, the limbs are not, and false fits are everywhere.',
      difficulty: 'FINAL',
      scramble: 'all',
      par: 43,
      board: { cols: 8, rows: 7, name: "dragon's den", mask: ['..#####.', '.######.', '######..', '.######.', '..#####.', '###.###.', '##...##.'] },
      pieces: [
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,0]], 0,5],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,3],
        ['Y Fork', [[0,0],[1,0],[2,0],[2,1],[3,0]], 2,4],
        ['Short Bar', [[0,0],[0,1],[0,2]], 6,3],
        ['Corner Trio', [[0,0],[0,1],[1,1]], 5,5],
        ['P Pocket', [[0,1],[1,0],[1,1],[2,0],[2,1]], 1,0],
        ['Tee', [[0,0],[1,0],[1,1],[2,0]], 4,1],
        ['Short Bar', [[0,0],[1,0],[2,0]], 4,0]
      ]
    },
    {
      title: 'Maze Mind',
      subtitle: 'Corridors and chambers punish greedy center placements.',
      difficulty: 'FINAL +',
      scramble: 'all',
      par: 46,
      board: { cols: 8, rows: 8, name: 'maze mind', mask: ['########', '##....##', '##.##.##', '##.##.##', '##....##', '######.#', '##......', '########'] },
      pieces: [
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 3,7],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,5],
        ['Square', [[0,0],[0,1],[1,0],[1,1]], 3,2],
        ['P Pocket', [[0,0],[0,1],[1,0],[1,1],[2,1]], 0,6],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 0,1],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 1,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 0,0],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 7,1],
        ['Long Bar', [[0,0],[0,1],[0,2],[0,3]], 6,1],
        ['Short Bar', [[0,0],[1,0],[2,0]], 5,0]
      ]
    },
    {
      title: 'Cat Nap',
      subtitle: 'Ears, cheeks, paws—cute silhouette, very unfriendly packing.',
      difficulty: 'FINAL +',
      scramble: 'all',
      par: 40,
      board: { cols: 8, rows: 7, name: 'cat nap', mask: ['##....##', '###..###', '########', '########', '.######.', '..####..', '..#..#..'] },
      pieces: [
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 5,2],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 5,1],
        ['Long L Five', [[0,0],[1,0],[1,1],[1,2],[1,3]], 6,0],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 2,2],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,0]], 1,1],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,0]], 0,0],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,0]], 3,2],
        ['Short Bar', [[0,0],[0,1],[0,2]], 4,3]
      ]
    },
    {
      title: 'Cozy Colossus',
      subtitle: 'The 50th puzzle: twelve pieces, narrow pockets, and no easy first move.',
      difficulty: 'FINAL BOSS',
      scramble: 'all',
      par: 53,
      board: { cols: 9, rows: 9, name: 'cozy colossus', mask: ['..#####..', '.#######.', '#########', '##.###.##', '#########', '.#######.', '..#####..', '..##.##..', '.##...##.'] },
      pieces: [
        ['Long L Five', [[0,3],[1,0],[1,1],[1,2],[1,3]], 1,5],
        ['Long L Five', [[0,0],[0,1],[0,2],[0,3],[1,3]], 6,5],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 3,3],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 5,3],
        ['Five Bar', [[0,0],[0,1],[0,2],[0,3],[0,4]], 4,2],
        ['Cross Five', [[0,1],[1,0],[1,1],[1,2],[2,1]], 0,3],
        ['Long L Five', [[0,0],[0,1],[1,0],[2,0],[3,0]], 0,2],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 1,1],
        ['Five Bar', [[0,0],[1,0],[2,0],[3,0],[4,0]], 2,0],
        ['P Pocket', [[0,1],[1,0],[1,1],[2,0],[2,1]], 5,1],
        ['Tee', [[0,1],[1,0],[1,1],[1,2]], 7,2],
        ['Corner Trio', [[0,0],[1,0],[1,1]], 6,4]
      ]
    }
  ];

  const messages = {
    start: [
      'Pick a piece. I believe in tiny victories ✨',
      'The board is ready for some satisfying clicks.',
      'Tiny blocks. Big cozy energy.'
    ],
    place: [
      'Ohhh, that click was delicious.',
      'Perfect little landing! ✨',
      'Yes! The board likes that one.',
      'That piece looks very pleased with itself.'
    ],
    oops: [
      'Almost! It needs a little more breathing room.',
      'Boop. That spot is already occupied.',
      'Close! Give it a tiny wiggle and try again.'
    ],
    remove: [
      'Changed your mind? Back to the edge you go! ↗',
      'Out you pop. Try that piece somewhere else.',
      'Nice catch — you can always pull a piece back out.'
    ],
    help: [
      'I checked the board. Let us untangle one thing at a time.',
      'Tiny puzzle detective mode: on. ✦',
      'I will point out one useful move, not solve the whole thing.'
    ],
    rotate: [
      'Spinny! Sometimes sideways is the answer.',
      'A quarter-turn of genius.',
      'New angle, new possibilities.'
    ],
    win: [
      'LOOK AT THAT BOARD. Absolutely immaculate. 🎉',
      'Every square is cozy now!',
      'You made the pieces hold hands. Beautiful.'
    ]
  };

  let levelIndex = 0;
  let pieces = [];
  let occupancy = [];
  let selectedPiece = null;
  let activePiece = null;
  let activePointerId = null;
  let pressState = null;
  let moves = 0;
  let elapsed = 0;
  let timerId = null;
  let started = false;
  let completed = false;
  let ghostTimeout = null;
  let helpMarkTimer = null;
  let tutorialHand = null;
  let tutorialDismissed = false;
  let pseudoFullscreen = false;

  const ui = {
    homeScreen: document.getElementById('homeScreen'),
    gameScreen: document.getElementById('gameScreen'),
    home: document.getElementById('homeBtn'),
    brandHome: document.getElementById('brandHomeBtn'),
    continueBtn: document.getElementById('continueBtn'),
    continueLabel: document.getElementById('continueLabel'),
    mapProgressText: document.getElementById('mapProgressText'),
    levelMapScroll: document.getElementById('levelMapScroll'),
    levelMap: document.getElementById('levelMap'),
    mapRoad: document.getElementById('mapRoad'),
    mapNodes: document.getElementById('mapNodes'),
    mapDecor: document.getElementById('mapDecor'),
    winMap: document.getElementById('winMapBtn'),
    levelKicker: document.getElementById('levelKicker'),
    levelTitle: document.getElementById('levelTitle'),
    moveCount: document.getElementById('moveCount'),
    timer: document.getElementById('timer'),
    bestTime: document.getElementById('bestTime'),
    speech: document.getElementById('speechBubble'),
    mascot: document.getElementById('mascot'),
    rotate: document.getElementById('rotateBtn'),
    help: document.getElementById('helpBtn'),
    reset: document.getElementById('resetBtn'),
    sound: document.getElementById('soundBtn'),
    music: document.getElementById('musicBtn'),
    fullscreen: document.getElementById('fullscreenBtn'),
    settings: document.getElementById('settingsBtn'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsClose: document.getElementById('settingsCloseBtn'),
    settingsSoundToggle: document.getElementById('settingsSoundToggle'),
    settingsMusicToggle: document.getElementById('settingsMusicToggle'),
    settingsMotionToggle: document.getElementById('settingsMotionToggle'),
    settingsFullscreen: document.getElementById('settingsFullscreenBtn'),
    settingsFullscreenStatus: document.getElementById('settingsFullscreenStatus'),
    privacy: document.getElementById('privacyAdsBtn'),
    privacyHint: document.getElementById('privacyAdsHint'),
    privacyPolicyLink: document.getElementById('privacyPolicyLink'),
    privacyPolicyHint: document.getElementById('privacyPolicyHint'),
    termsLink: document.getElementById('termsLink'),
    supportLink: document.getElementById('supportLink'),
    supportHint: document.getElementById('supportHint'),
    settingsAdPlatform: document.getElementById('settingsAdPlatform'),
    settingsConsentStatus: document.getElementById('settingsConsentStatus'),
    settingsTestAdsBadge: document.getElementById('settingsTestAdsBadge'),
    settingsVersion: document.getElementById('settingsVersion'),
    levelDots: document.getElementById('levelDots'),
    winOverlay: document.getElementById('winOverlay'),
    winTime: document.getElementById('winTime'),
    winMoves: document.getElementById('winMoves'),
    winStars: document.getElementById('winStars'),
    winCopy: document.getElementById('winCopy'),
    replay: document.getElementById('replayBtn'),
    next: document.getElementById('nextBtn'),
    confetti: document.getElementById('confettiLayer')
  };

  // ---------- Audio ----------
  let audioCtx = null;
  let soundEnabled = true;
  let musicEnabled = true;
  let musicTimer = null;
  let musicStep = 0;

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    if (musicEnabled && !musicTimer) startMusic();
  }

  function tone(freq, duration = 0.08, type = 'sine', volume = 0.08, delay = 0) {
    if (!audioCtx || !soundEnabled) return;
    const now = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function musicTone(freq, duration = 0.45, volume = 0.014) {
    if (!audioCtx || !musicEnabled) return;
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function woodClick(volume = 0.045) {
    if (!audioCtx || !soundEnabled) return;
    const len = Math.max(1, Math.floor(audioCtx.sampleRate * 0.028));
    const buffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const src = audioCtx.createBufferSource();
    const filter = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    filter.type = 'bandpass';
    filter.frequency.value = 850;
    filter.Q.value = 0.8;
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(filter).connect(gain).connect(audioCtx.destination);
    src.start();
  }

  function sfx(kind) {
    if (!soundEnabled) return;
    ensureAudio();
    if (!audioCtx) return;
    if (kind === 'pick') {
      tone(360, .055, 'triangle', .035);
      woodClick(.02);
    } else if (kind === 'place') {
      woodClick(.055);
      tone(520, .08, 'sine', .045, .01);
      tone(760, .09, 'sine', .03, .06);
    } else if (kind === 'invalid') {
      tone(180, .11, 'triangle', .045);
      tone(145, .14, 'triangle', .03, .08);
    } else if (kind === 'remove') {
      woodClick(.032);
      tone(360, .07, 'triangle', .035);
      tone(260, .10, 'sine', .028, .045);
    } else if (kind === 'rotate') {
      tone(420, .06, 'sine', .03);
      tone(590, .07, 'sine', .026, .045);
    } else if (kind === 'help') {
      tone(720, .10, 'sine', .035);
      tone(960, .12, 'sine', .026, .08);
      tone(1220, .14, 'sine', .022, .16);
    } else if (kind === 'win') {
      [523.25,659.25,783.99,1046.5].forEach((f,i) => tone(f, .22, 'sine', .055, i*.11));
    }
  }

  function startMusic() {
    if (!musicEnabled || !audioCtx || musicTimer) return;
    const notes = [261.63, 329.63, 392.0, 329.63, 293.66, 392.0, 440.0, 392.0];
    musicTimer = setInterval(() => {
      if (!musicEnabled || !audioCtx || audioCtx.state !== 'running') return;
      musicTone(notes[musicStep % notes.length], .52, .012);
      if (musicStep % 4 === 0) musicTone(notes[(musicStep + 2) % notes.length] / 2, .62, .008);
      musicStep++;
    }, 680);
  }

  function stopMusic() {
    clearInterval(musicTimer);
    musicTimer = null;
  }

  // ---------- Helpers ----------
  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function copyCells(cells) { return cells.map(([x,y]) => [x,y]); }

  function normalizeCells(cells) {
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    return cells.map(([x,y]) => [x-minX, y-minY]).sort((a,b) => a[1]-b[1] || a[0]-b[0]);
  }

  function rotateCells(cells) {
    return normalizeCells(cells.map(([x,y]) => [-y, x]));
  }

  function boundsFor(cells) {
    return {
      cols: Math.max(...cells.map(c => c[0])) + 1,
      rows: Math.max(...cells.map(c => c[1])) + 1
    };
  }

  function configureBoard() {
    const spec = LEVELS[levelIndex].board || { cols: 6, rows: 8 };
    COLS = spec.cols || 6;
    ROWS = spec.rows || 8;
    const w = COLS * CELL;
    const h = ROWS * CELL;
    BOARD = {
      x: Math.round((VIEW.w - w) / 2),
      y: Math.round((VIEW.h - h) / 2),
      w, h
    };
    boardMask = Array.from({ length: ROWS }, (_, row) => {
      const maskRow = spec.mask?.[row];
      return Array.from({ length: COLS }, (_, col) => maskRow ? maskRow[col] === '#' : true);
    });
  }

  function isActiveCell(col, row) {
    return !!boardMask[row]?.[col];
  }

  function boardCellCount() {
    return boardMask.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function randomMessage(kind) {
    const list = messages[kind];
    return list[Math.floor(Math.random() * list.length)];
  }

  function speak(kind, custom) {
    ui.speech.textContent = custom || randomMessage(kind);
    ui.mascot.classList.remove('happy', 'oops', 'think');
    const cls = kind === 'place' || kind === 'win' ? 'happy' : kind === 'oops' ? 'oops' : kind === 'help' || kind === 'rotate' ? 'think' : '';
    if (cls) {
      void ui.mascot.offsetWidth;
      ui.mascot.classList.add(cls);
      setTimeout(() => ui.mascot.classList.remove(cls), 720);
    }
  }

  function pointFromEvent(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function perimeterCenters(count) {
    if (count <= 6) {
      return [
        [330, 102], [570, 102],
        [108, 476], [792, 476],
        [330, 878], [570, 878]
      ];
    }
    return [
      [175, 102], [450, 102], [725, 102],
      [108, 300], [108, 476], [108, 652],
      [792, 300], [792, 476], [792, 652],
      [175, 878], [450, 878], [725, 878]
    ];
  }

  function homeSlot(piece) {
    const centers = perimeterCenters(LEVELS[levelIndex].pieces.length);
    const [cx, cy] = centers[piece.index % centers.length];
    const b = boundsFor(piece.cells);
    // Long pentominoes still need to fit inside the little parking bubbles.
    const scale = Math.min(HOME_SCALE, 108 / (b.cols * CELL), 108 / (b.rows * CELL));
    const w = b.cols * CELL * scale;
    const h = b.rows * CELL * scale;
    return { x: cx - w / 2, y: cy - h / 2, scale };
  }

  function renderTransform(piece) {
    piece.group.setAttribute('transform', `translate(${piece.x} ${piece.y}) scale(${piece.scale})`);
  }

  function animatePieceTo(piece, x, y, scale = piece.scale, duration = 300, bounce = true) {
    piece.animToken = (piece.animToken || 0) + 1;
    const token = piece.animToken;
    const start = performance.now();
    const sx = piece.x, sy = piece.y, ss = piece.scale;

    function step(now) {
      if (token !== piece.animToken) return;
      let t = clamp((now - start) / duration, 0, 1);
      const eased = bounce
        ? (t === 1 ? 1 : 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2))
        : 1 - Math.pow(1 - t, 3);
      piece.x = sx + (x - sx) * eased;
      piece.y = sy + (y - sy) * eased;
      piece.scale = ss + (scale - ss) * eased;
      renderTransform(piece);
      if (t < 1) requestAnimationFrame(step);
      else {
        piece.x = x; piece.y = y; piece.scale = scale;
        renderTransform(piece);
      }
    }
    requestAnimationFrame(step);
  }

  function startTimer() {
    if (started || completed) return;
    started = true;
    timerId = setInterval(() => {
      elapsed++;
      ui.timer.textContent = formatTime(elapsed);
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  const PREF_KEYS = {
    sound: 'cozy-fit-sound-enabled',
    music: 'cozy-fit-music-enabled',
    reduceMotion: 'cozy-fit-reduce-motion',
  };
  let reducedMotionEnabled = false;
  let settingsOpener = null;

  function readBoolPref(key, fallback) {
    const raw = storageGet(key);
    if (raw === null) return !!fallback;
    return raw === 'true';
  }

  function syncSoundUi() {
    if (ui.sound) {
      ui.sound.classList.toggle('off', !soundEnabled);
      const icon = ui.sound.querySelector('.icon');
      if (icon) icon.textContent = soundEnabled ? '🔊' : '🔇';
      ui.sound.setAttribute('aria-pressed', String(soundEnabled));
    }
    if (ui.settingsSoundToggle) ui.settingsSoundToggle.checked = soundEnabled;
  }

  function syncMusicUi() {
    if (ui.music) {
      ui.music.classList.toggle('off', !musicEnabled);
      ui.music.setAttribute('aria-pressed', String(musicEnabled));
    }
    if (ui.settingsMusicToggle) ui.settingsMusicToggle.checked = musicEnabled;
  }

  function setSoundPreference(enabled, playFeedback = false) {
    soundEnabled = !!enabled;
    storageSet(PREF_KEYS.sound, String(soundEnabled));
    syncSoundUi();
    window.CozyAds?.setSoundEnabled?.(soundEnabled);
    if (soundEnabled && playFeedback) sfx('pick');
  }

  function setMusicPreference(enabled) {
    musicEnabled = !!enabled;
    storageSet(PREF_KEYS.music, String(musicEnabled));
    syncMusicUi();
    if (musicEnabled) { ensureAudio(); startMusic(); }
    else stopMusic();
  }

  function setReducedMotionPreference(enabled) {
    reducedMotionEnabled = !!enabled;
    storageSet(PREF_KEYS.reduceMotion, String(reducedMotionEnabled));
    document.body.classList.toggle('reduce-motion', reducedMotionEnabled);
    if (ui.settingsMotionToggle) ui.settingsMotionToggle.checked = reducedMotionEnabled;
  }

  function loadPlayerPreferences() {
    soundEnabled = readBoolPref(PREF_KEYS.sound, true);
    musicEnabled = readBoolPref(PREF_KEYS.music, true);
    const systemReduced = !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    reducedMotionEnabled = readBoolPref(PREF_KEYS.reduceMotion, systemReduced);
    document.body.classList.toggle('reduce-motion', reducedMotionEnabled);
    syncSoundUi();
    syncMusicUi();
    if (ui.settingsMotionToggle) ui.settingsMotionToggle.checked = reducedMotionEnabled;
    window.CozyAds?.setSoundEnabled?.(soundEnabled);
  }

  function validPublicUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value, location.href);
      if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
    } catch (_) {}
    return '';
  }

  function configureSettingsLinks() {
    const cfg = window.COZY_ADS_CONFIG || {};
    if (ui.settingsVersion) ui.settingsVersion.textContent = cfg.appVersion || '—';

    const privacyUrl = validPublicUrl(cfg.privacyPolicyUrl);
    if (ui.privacyPolicyLink) {
      if (privacyUrl) {
        ui.privacyPolicyLink.href = privacyUrl;
        ui.privacyPolicyLink.setAttribute('aria-disabled', 'false');
        if (ui.privacyPolicyHint) ui.privacyPolicyHint.textContent = 'Read how Cozy Fit and its ad services handle data.';
      } else {
        ui.privacyPolicyLink.removeAttribute('href');
        ui.privacyPolicyLink.setAttribute('aria-disabled', 'true');
        if (ui.privacyPolicyHint) ui.privacyPolicyHint.textContent = 'Add privacyPolicyUrl in ads-config.js before release.';
      }
    }

    const termsUrl = validPublicUrl(cfg.termsUrl);
    if (ui.termsLink) {
      ui.termsLink.classList.toggle('hidden', !termsUrl);
      if (termsUrl) ui.termsLink.href = termsUrl;
    }

    const email = typeof cfg.supportEmail === 'string' ? cfg.supportEmail.trim() : '';
    if (ui.supportLink) {
      const show = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
      ui.supportLink.classList.toggle('hidden', !show);
      if (show) {
        ui.supportLink.href = `mailto:${email}?subject=${encodeURIComponent('Cozy Fit support')}`;
        if (ui.supportHint) ui.supportHint.textContent = email;
      }
    }
  }

  function friendlyConsentStatus(status) {
    const s = String(status || '').toUpperCase();
    if (s === 'ADS_DISABLED') return 'Ads disabled';
    if (s === 'NOT_CONFIGURED') return 'Not configured yet';
    if (s === 'LOADING_GOOGLE_CMP' || s === 'CHECKING') return 'Checking Google consent…';
    if (s === 'MANAGED_BY_GOOGLE_CMP') return 'Managed by Google CMP';
    if (s === 'OBTAINED') return 'Consent choices saved';
    if (s === 'NOT_REQUIRED') return 'No consent message required';
    if (s === 'REQUIRED') return 'Choice required';
    if (s === 'READY') return 'Ads ready';
    if (s === 'ERROR') return 'Consent service unavailable';
    if (s === 'UNAVAILABLE') return 'Ad service unavailable';
    return 'Checking…';
  }

  function updateSettingsAdStatus() {
    const status = window.CozyAds?.getStatus?.() || {};
    if (ui.settingsAdPlatform) {
      if (status.adsEnabled === false) {
        ui.settingsAdPlatform.textContent = 'No ads in this game';
      } else if (status.mode === 'native') {
        const platform = status.platform === 'ios' ? 'iOS' : status.platform === 'android' ? 'Android' : 'App';
        ui.settingsAdPlatform.textContent = `Google AdMob · ${platform}`;
      } else if (status.mode === 'web') {
        ui.settingsAdPlatform.textContent = status.webConfigured ? 'Google AdSense · Web' : 'Google AdSense · setup pending';
      } else {
        ui.settingsAdPlatform.textContent = 'Google ads';
      }
    }
    if (ui.settingsConsentStatus) {
      let label = friendlyConsentStatus(status.consentStatus);
      if (status.privacyOptionsRequired) label = 'Privacy choices available';
      ui.settingsConsentStatus.textContent = label;
    }
    if (ui.privacy) {
      const ready = !!status.privacyOptionsAvailable;
      ui.privacy.disabled = !ready;
      ui.privacy.setAttribute('aria-disabled', String(!ready));
      if (ui.privacyHint) {
        ui.privacyHint.textContent = status.adsEnabled === false ? 'No advertising choices are needed while ads are disabled.' : ready
          ? 'Open Google’s consent and privacy controls.'
          : (status.mode === 'web' && !status.webConfigured
            ? 'Available after AdSense and its consent message are configured.'
            : 'Available when Google says privacy options are required.');
      }
    }
    if (ui.settingsTestAdsBadge) ui.settingsTestAdsBadge.classList.toggle('hidden', !status.testMode || !status.adsEnabled);
  }

  function openSettings() {
    if (!ui.settingsOverlay) return;
    settingsOpener = document.activeElement;
    configureSettingsLinks();
    updateSettingsAdStatus();
    updateFullscreenUi();
    ui.settingsOverlay.classList.remove('hidden');
    document.body.classList.add('settings-open');
    window.CozyAds?.setModalOpen?.(true);
    setTimeout(() => ui.settingsClose?.focus(), 0);
  }

  function closeSettings() {
    if (!ui.settingsOverlay || ui.settingsOverlay.classList.contains('hidden')) return;
    ui.settingsOverlay.classList.add('hidden');
    document.body.classList.remove('settings-open');
    window.CozyAds?.setModalOpen?.(false);
    if (settingsOpener && typeof settingsOpener.focus === 'function') settingsOpener.focus();
    settingsOpener = null;
  }

  function isLevelCompleted(index) {
    return Number(storageGet(`cozy-fit-best-${index}`) || 0) > 0;
  }

  function getHighestUnlocked() {
    const saved = Number(storageGet('cozy-fit-highest-level'));
    if (Number.isInteger(saved) && saved >= 0) {
      // v11 capped progression at the old final level (index 24). If that level
      // was already cleared, promote returning players into the new level pack.
      if (LEVELS.length > 25 && saved === 24 && isLevelCompleted(24)) {
        storageSet('cozy-fit-highest-level', '25');
        return 25;
      }
      return clamp(saved, 0, LEVELS.length - 1);
    }

    // Older builds only stored best times. Promote the player to the level after
    // their furthest completed puzzle so existing progress is not lost.
    let furthestCompleted = -1;
    LEVELS.forEach((_, index) => {
      if (isLevelCompleted(index)) furthestCompleted = Math.max(furthestCompleted, index);
    });
    const derived = clamp(furthestCompleted + 1, 0, LEVELS.length - 1);
    storageSet('cozy-fit-highest-level', String(derived));
    return derived;
  }

  function unlockAfterWin(index) {
    const currentHighest = getHighestUnlocked();
    const next = Math.min(index + 1, LEVELS.length - 1);
    if (index >= currentHighest && next > currentHighest) {
      storageSet('cozy-fit-highest-level', String(next));
    }
  }

  function startLevel(index) {
    const highest = getHighestUnlocked();
    levelIndex = clamp(index, 0, highest);
    ui.homeScreen.classList.add('screen-hidden');
    ui.gameScreen.classList.remove('screen-hidden');
    ui.home.classList.remove('hidden');
    document.body.classList.add('playing-game');
    window.CozyAds?.setScreen?.('game');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    initLevel();
  }

  function mapNodePosition(index) {
    const xPattern = [50, 28, 54, 76, 61, 34, 23, 47, 73, 78, 53, 29];
    const stepY = 146;
    return { x: xPattern[index % xPattern.length], y: 105 + index * stepY };
  }

  function renderLevelMap() {
    const highest = getHighestUnlocked();
    const mapHeight = 210 + (LEVELS.length - 1) * 146;
    ui.levelMap.style.height = `${mapHeight}px`;
    ui.mapNodes.innerHTML = '';
    ui.mapDecor.innerHTML = '';
    ui.mapRoad.setAttribute('viewBox', `0 0 100 ${mapHeight}`);
    ui.mapRoad.setAttribute('preserveAspectRatio', 'none');
    ui.mapRoad.innerHTML = '';

    const positions = LEVELS.map((_, index) => mapNodePosition(index));
    let d = `M ${positions[0].x} ${positions[0].y}`;
    for (let i = 1; i < positions.length; i++) {
      const a = positions[i - 1];
      const b = positions[i];
      const midY = (a.y + b.y) / 2;
      d += ` C ${a.x} ${midY}, ${b.x} ${midY}, ${b.x} ${b.y}`;
    }
    const roadShadow = svgEl('path', {
      d, class: 'map-road-shadow', fill: 'none', 'vector-effect': 'non-scaling-stroke'
    });
    const road = svgEl('path', {
      d, class: 'map-road-line', fill: 'none', 'vector-effect': 'non-scaling-stroke'
    });
    const roadDots = svgEl('path', {
      d, class: 'map-road-dots', fill: 'none', 'vector-effect': 'non-scaling-stroke'
    });
    ui.mapRoad.append(roadShadow, road, roadDots);

    const zoneStarts = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];
    const zoneMeta = [
      ['Sunny Meadow', '🌱'], ['Twisty Woods', '🌿'], ['Puzzle Peaks', '⛰️'],
      ['Moon Garden', '🌙'], ['Cozy Castle', '🏰'], ['Wonder Woods', '🍄'],
      ['Critter Cove', '🐾'], ['Hero Hills', '🛡️'], ['Star Station', '🪐'],
      ['Final Realm', '✨']
    ];
    zoneStarts.forEach((start, zone) => {
      if (start >= LEVELS.length) return;
      const pos = positions[start];
      const tag = document.createElement('div');
      tag.className = 'map-zone-tag';
      tag.style.top = `${Math.max(18, pos.y - 82)}px`;
      tag.innerHTML = `<span aria-hidden="true">${zoneMeta[zone][1]}</span><strong>${zoneMeta[zone][0]}</strong>`;
      ui.mapDecor.appendChild(tag);
    });

    LEVELS.forEach((level, index) => {
      const pos = positions[index];
      const completedLevel = isLevelCompleted(index);
      const locked = index > highest;
      const current = index === highest;
      const stop = document.createElement('div');
      stop.className = `map-stop${completedLevel ? ' complete' : ''}${current ? ' current' : ''}${locked ? ' locked' : ''}`;
      stop.style.left = `${pos.x}%`;
      stop.style.top = `${pos.y}px`;
      stop.dataset.level = String(index);

      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'map-level-node';
      node.disabled = locked;
      node.setAttribute('aria-label', locked
        ? `Level ${index + 1} locked. Complete level ${index} first.`
        : `Play level ${index + 1}: ${level.title}`);
      node.innerHTML = `<span class="map-level-number">${completedLevel ? '✓' : index + 1}</span>${locked ? '<span class="map-lock" aria-hidden="true">🔒</span>' : ''}`;
      if (!locked) node.addEventListener('click', () => {
        ensureAudio();
        sfx('pick');
        startLevel(index);
      });

      const label = document.createElement('div');
      label.className = 'map-stop-label';
      label.innerHTML = `<strong>${level.title}</strong><small>${level.difficulty || 'PUZZLE'}${completedLevel ? ' · cleared' : current ? ' · next stop' : ''}</small>`;
      stop.append(node, label);

      if (current) {
        const pointer = document.createElement('div');
        pointer.className = 'you-are-here';
        pointer.innerHTML = '<span>YOU ARE HERE</span><b aria-hidden="true">↓</b>';
        stop.appendChild(pointer);
      }

      ui.mapNodes.appendChild(stop);
    });

    ui.continueLabel.textContent = `Level ${highest + 1}`;
    ui.mapProgressText.textContent = `${highest + 1} / ${LEVELS.length} open`;
  }

  function scrollMapToHighest(instant = false) {
    const highest = getHighestUnlocked();
    const node = ui.mapNodes.querySelector(`.map-stop[data-level="${highest}"]`);
    if (!node || !ui.levelMapScroll) return;
    const target = Math.max(0, node.offsetTop - ui.levelMapScroll.clientHeight * 0.44);
    ui.levelMapScroll.scrollTo({ top: target, behavior: instant ? 'auto' : 'smooth' });
    node.classList.remove('arrival-pop');
    requestAnimationFrame(() => node.classList.add('arrival-pop'));
  }

  function showHome(options = {}) {
    stopTimer();
    activePiece = null;
    activePointerId = null;
    pressState = null;
    ui.winOverlay.classList.add('hidden');
    ui.gameScreen.classList.add('screen-hidden');
    ui.homeScreen.classList.remove('screen-hidden');
    ui.home.classList.add('hidden');
    document.body.classList.remove('playing-game');
    window.CozyAds?.setScreen?.('home');
    renderLevelMap();
    window.scrollTo({ top: 0, behavior: options.instant ? 'auto' : 'smooth' });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollMapToHighest(!!options.instant));
    });
  }

  function updateHud() {
    ui.moveCount.textContent = moves;
    ui.timer.textContent = formatTime(elapsed);
    const level = LEVELS[levelIndex];
    ui.levelKicker.textContent = level.tutorial
      ? `TUTORIAL · LEVEL 1 OF ${LEVELS.length}`
      : `LEVEL ${levelIndex + 1} OF ${LEVELS.length} · ${level.difficulty || 'PUZZLE'}`;
    ui.levelTitle.textContent = LEVELS[levelIndex].title;
    const key = `cozy-fit-best-${levelIndex}`;
    const best = Number(storageGet(key) || 0);
    ui.bestTime.textContent = best ? formatTime(best) : '—';

    const locked = !!level.rotationLocked;
    ui.rotate.disabled = locked;
    ui.rotate.classList.toggle('locked', locked);
    const rotateHint = ui.rotate.querySelector('small');
    if (rotateHint) rotateHint.textContent = locked ? 'unlocks on level 3' : 'selected piece · R';
  }

  // ---------- Board drawing ----------
  function drawBoard() {
    boardLayer.innerHTML = '';

    const centers = perimeterCenters(LEVELS[levelIndex].pieces.length);
    centers.forEach(([cx, cy], i) => {
      const bubble = svgEl('g', { class: 'parking-bubble' });
      bubble.appendChild(svgEl('circle', {
        cx, cy, r: 61, fill: '#fffaf1', 'fill-opacity': '.62',
        stroke: i % 2 ? '#efb5c8' : '#cbb9ef', 'stroke-opacity': '.23',
        'stroke-width': '2.5', 'stroke-dasharray': '6 9'
      }));
      bubble.appendChild(svgEl('circle', {
        cx: cx - 30, cy: cy - 31, r: 3.5, fill: '#ffffff', 'fill-opacity': '.86'
      }));
      boardLayer.appendChild(bubble);
    });

    const boardName = LEVELS[levelIndex].board?.name || 'shape';
    const helper = svgEl('text', {
      x: VIEW.w / 2, y: BOARD.y - 54, fill: '#8f776f', 'font-size': '18', 'font-weight': '900',
      'letter-spacing': '2.1', 'text-anchor': 'middle'
    });
    helper.textContent = LEVELS[levelIndex].tutorial
      ? 'DRAG A PIECE INTO THE SHAPE'
      : `FIT THE PIECES INTO THE ${boardName.toUpperCase()}`;
    boardLayer.appendChild(helper);

    // Clean continuous board silhouette. Instead of drawing every exposed cell
    // edge as a separate rounded line (which creates the "piped" border look),
    // trace the grid boundary into closed SVG loops and stroke each loop once.
    const exposed = (col, row) => col < 0 || col >= COLS || row < 0 || row >= ROWS || !isActiveCell(col, row);

    function boundaryPathData() {
      const edges = [];
      const add = (x1, y1, x2, y2) => edges.push({ a: [x1, y1], b: [x2, y2], used: false });

      // Orient edges clockwise around filled cells. Inner holes naturally run
      // the opposite direction and work with even-odd filling.
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          if (!isActiveCell(col, row)) continue;
          if (exposed(col, row - 1)) add(col, row, col + 1, row);
          if (exposed(col + 1, row)) add(col + 1, row, col + 1, row + 1);
          if (exposed(col, row + 1)) add(col + 1, row + 1, col, row + 1);
          if (exposed(col - 1, row)) add(col, row + 1, col, row);
        }
      }

      const key = ([x, y]) => `${x},${y}`;
      const byStart = new Map();
      edges.forEach((edge, index) => {
        const k = key(edge.a);
        if (!byStart.has(k)) byStart.set(k, []);
        byStart.get(k).push(index);
      });

      const loops = [];
      for (let seed = 0; seed < edges.length; seed++) {
        if (edges[seed].used) continue;
        const points = [];
        let current = seed;
        const startKey = key(edges[seed].a);
        let guard = 0;

        while (current != null && guard++ < edges.length + 8) {
          const edge = edges[current];
          if (edge.used) break;
          edge.used = true;
          if (!points.length) points.push(edge.a);
          points.push(edge.b);
          if (key(edge.b) === startKey) break;
          const next = (byStart.get(key(edge.b)) || []).find(i => !edges[i].used);
          current = next == null ? null : next;
        }
        if (points.length >= 4) loops.push(points);
      }

      return loops.map(points => {
        const px = ([gx, gy]) => [BOARD.x + gx * CELL, BOARD.y + gy * CELL];
        const converted = points.map(px);
        let d = `M ${converted[0][0]} ${converted[0][1]}`;
        for (let i = 1; i < converted.length; i++) d += ` L ${converted[i][0]} ${converted[i][1]}`;
        return d + ' Z';
      }).join(' ');
    }

    const boardPath = boundaryPathData();
    const silhouette = svgEl('g', { class: 'shape-board', filter: 'url(#boardShadow)', 'pointer-events': 'none' });
    silhouette.appendChild(svgEl('path', {
      d: boardPath,
      fill: 'url(#slotGradient)',
      'fill-rule': 'evenodd',
      stroke: '#e6b574',
      'stroke-width': '11',
      'stroke-linejoin': 'round'
    }));
    // One quiet satin line gives the board a finished toy-like edge without
    // creating another bulky rim.
    silhouette.appendChild(svgEl('path', {
      d: boardPath,
      fill: 'none',
      stroke: '#fff4df',
      'stroke-opacity': '.72',
      'stroke-width': '1.8',
      'stroke-linejoin': 'round'
    }));
    boardLayer.appendChild(silhouette);

    // Very faint alignment guides preserve puzzle readability without making
    // the board look tiled. They disappear visually once pieces are placed.
    const guides = svgEl('g', { class: 'board-guides', opacity: '.18', 'pointer-events': 'none' });
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!isActiveCell(col, row)) continue;
        const x = BOARD.x + col * CELL;
        const y = BOARD.y + row * CELL;
        if (isActiveCell(col + 1, row)) {
          guides.appendChild(svgEl('line', {
            x1: x + CELL, y1: y + 15, x2: x + CELL, y2: y + CELL - 15,
            stroke: '#bfa994', 'stroke-width': '1', 'stroke-linecap': 'round'
          }));
        }
        if (isActiveCell(col, row + 1)) {
          guides.appendChild(svgEl('line', {
            x1: x + 15, y1: y + CELL, x2: x + CELL - 15, y2: y + CELL,
            stroke: '#bfa994', 'stroke-width': '1', 'stroke-linecap': 'round'
          }));
        }
      }
    }
    boardLayer.appendChild(guides);

    const count = svgEl('text', {
      x: VIEW.w / 2, y: BOARD.y + BOARD.h + 48, fill: '#a5877e', 'font-size': '14', 'font-weight': '800',
      'letter-spacing': '1.2', 'text-anchor': 'middle', opacity: '.82'
    });
    count.textContent = `${boardCellCount()} cozy spaces`;
    boardLayer.appendChild(count);
  }

  function drawLevelDots() {
    ui.levelDots.innerHTML = '';
    ui.levelDots.classList.toggle('many-levels', LEVELS.length > 16);
    const highest = getHighestUnlocked();
    LEVELS.forEach((level, i) => {
      const button = document.createElement('button');
      const locked = i > highest;
      button.className = 'level-dot' + (i === levelIndex ? ' active' : '') + (isLevelCompleted(i) ? ' complete' : '') + (locked ? ' locked' : '');
      button.type = 'button';
      button.disabled = locked;
      button.setAttribute('aria-label', locked ? `Level ${i + 1} locked` : `Play level ${i + 1}: ${level.title}`);
      if (!locked) button.addEventListener('click', () => {
        ensureAudio();
        sfx('pick');
        levelIndex = i;
        initLevel();
      });
      ui.levelDots.appendChild(button);
    });
  }

  function pieceOutlineLoops(cells) {
    const set = new Set(cells.map(([x, y]) => `${x},${y}`));
    const edges = [];
    const add = (x1, y1, x2, y2, dir) => edges.push({ a: [x1, y1], b: [x2, y2], dir, used: false });

    cells.forEach(([x, y]) => {
      // Clockwise around each occupied square; shared edges are omitted.
      if (!set.has(`${x},${y - 1}`)) add(x, y, x + 1, y, 0);       // east
      if (!set.has(`${x + 1},${y}`)) add(x + 1, y, x + 1, y + 1, 1); // south
      if (!set.has(`${x},${y + 1}`)) add(x + 1, y + 1, x, y + 1, 2); // west
      if (!set.has(`${x - 1},${y}`)) add(x, y + 1, x, y, 3);       // north
    });

    const key = ([x, y]) => `${x},${y}`;
    const starts = new Map();
    edges.forEach((edge, i) => {
      const k = key(edge.a);
      if (!starts.has(k)) starts.set(k, []);
      starts.get(k).push(i);
    });

    const loops = [];
    const turnRank = (from, to) => {
      const delta = (to - from + 4) % 4;
      // Prefer a clockwise turn, then straight, then counter-clockwise.
      if (delta === 1) return 0;
      if (delta === 0) return 1;
      if (delta === 3) return 2;
      return 3;
    };

    edges.forEach((seed, seedIndex) => {
      if (seed.used) return;
      const points = [seed.a];
      let idx = seedIndex;
      let guard = 0;
      while (guard++ < edges.length + 8) {
        const edge = edges[idx];
        if (edge.used) break;
        edge.used = true;
        points.push(edge.b);
        if (key(edge.b) === key(points[0])) break;
        const candidates = (starts.get(key(edge.b)) || []).filter(i => !edges[i].used);
        if (!candidates.length) break;
        candidates.sort((ia, ib) => turnRank(edge.dir, edges[ia].dir) - turnRank(edge.dir, edges[ib].dir));
        idx = candidates[0];
      }

      if (points.length >= 4 && key(points[0]) === key(points[points.length - 1])) {
        points.pop();
        // Remove collinear grid vertices so the contour is calm and smooth.
        let changed = true;
        while (changed && points.length > 3) {
          changed = false;
          for (let i = 0; i < points.length; i++) {
            const a = points[(i - 1 + points.length) % points.length];
            const b = points[i];
            const c = points[(i + 1) % points.length];
            if ((a[0] === b[0] && b[0] === c[0]) || (a[1] === b[1] && b[1] === c[1])) {
              points.splice(i, 1);
              changed = true;
              break;
            }
          }
        }
        loops.push(points);
      }
    });
    return loops;
  }

  function roundedLoopPath(points, radius = 11) {
    if (!points.length) return '';
    const px = points.map(([x, y]) => [x * CELL, y * CELL]);
    const before = [];
    const after = [];

    for (let i = 0; i < px.length; i++) {
      const prev = px[(i - 1 + px.length) % px.length];
      const cur = px[i];
      const next = px[(i + 1) % px.length];
      const inDx = Math.sign(cur[0] - prev[0]);
      const inDy = Math.sign(cur[1] - prev[1]);
      const outDx = Math.sign(next[0] - cur[0]);
      const outDy = Math.sign(next[1] - cur[1]);
      const inLen = Math.abs(cur[0] - prev[0]) + Math.abs(cur[1] - prev[1]);
      const outLen = Math.abs(next[0] - cur[0]) + Math.abs(next[1] - cur[1]);
      const r = Math.min(radius, inLen / 2 - 1, outLen / 2 - 1);
      before.push([cur[0] - inDx * r, cur[1] - inDy * r]);
      after.push([cur[0] + outDx * r, cur[1] + outDy * r]);
    }

    let d = `M ${after[0][0]} ${after[0][1]}`;
    for (let i = 1; i < px.length; i++) {
      d += ` L ${before[i][0]} ${before[i][1]} Q ${px[i][0]} ${px[i][1]} ${after[i][0]} ${after[i][1]}`;
    }
    d += ` L ${before[0][0]} ${before[0][1]} Q ${px[0][0]} ${px[0][1]} ${after[0][0]} ${after[0][1]} Z`;
    return d;
  }

  function pieceSilhouettePath(cells) {
    return pieceOutlineLoops(cells).map(loop => roundedLoopPath(loop, 11)).join(' ');
  }

  function renderPieceCells(piece) {
    piece.group.innerHTML = '';
    const color = piece.color;
    const silhouette = pieceSilhouettePath(piece.cells);

    // One continuous contour: no tile seams, no stacked-cell ridges.
    piece.group.appendChild(svgEl('path', {
      class: 'selection-ring',
      d: silhouette,
      fill: 'none'
    }));

    const body = svgEl('g', { class: 'piece-body', filter: 'url(#pieceShadow)' });
    body.appendChild(svgEl('path', {
      class: 'piece-silhouette',
      d: silhouette,
      fill: color,
      stroke: color,
      'stroke-width': '7',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));
    piece.group.appendChild(body);

    // A single restrained highlight around the whole toy keeps the colour soft
    // without re-introducing cell-by-cell bumps.
    piece.group.appendChild(svgEl('path', {
      class: 'piece-soft-highlight',
      d: silhouette,
      fill: 'none',
      stroke: '#ffffff',
      'stroke-opacity': '.18',
      'stroke-width': '2.2',
      'stroke-linejoin': 'round',
      'pointer-events': 'none'
    }));

    // Give only some pieces a face so faces stay delightful instead of noisy.
    if (piece.index % 3 === 1 || (piece.index + levelIndex) % 7 === 0) {
      const faceCell = piece.cells[Math.min(1, piece.cells.length - 1)];
      const gx = faceCell[0] * CELL + CELL / 2;
      const gy = faceCell[1] * CELL + CELL / 2 + 3;
      const face = svgEl('g', { class: 'piece-face', transform: `translate(${gx} ${gy})` });
      const wink = (piece.index + levelIndex) % 4 === 0;
      if (wink) {
        face.appendChild(svgEl('path', { class: 'face-mouth face-wink', d: 'M -12 -5 Q -8 -9 -4 -5' }));
      } else {
        face.appendChild(svgEl('circle', { class: 'face-eye', cx: -8.5, cy: -5, r: 3.2 }));
      }
      face.appendChild(svgEl('circle', { class: 'face-eye', cx: 8.5, cy: -5, r: 3.2 }));
      face.appendChild(svgEl('path', { class: 'face-mouth', d: 'M -7 5 Q 0 12 7 5' }));
      face.appendChild(svgEl('ellipse', { cx: -15, cy: 5, rx: 4.5, ry: 2.5, fill: '#ff8ca5', 'fill-opacity': '.50' }));
      face.appendChild(svgEl('ellipse', { cx: 15, cy: 5, rx: 4.5, ry: 2.5, fill: '#ff8ca5', 'fill-opacity': '.50' }));
      piece.group.appendChild(face);
    }
  }

  function createPiece(config, index) {
    const [name, cells, targetCol, targetRow] = config;
    const piece = {
      id: `piece-${index}`,
      index,
      name,
      color: COLORS[index % COLORS.length],
      targetCells: copyCells(cells),
      targetCol,
      targetRow,
      cells: copyCells(cells),
      col: null,
      row: null,
      placed: false,
      scale: HOME_SCALE,
      x: 0,
      y: 0,
      animToken: 0,
      lastPlacedMove: 0,
      group: svgEl('g', { class: 'piece', 'data-id': `piece-${index}`, tabindex: '0', role: 'button', 'aria-label': `${name} puzzle piece`, 'aria-pressed': 'false' })
    };

    const mode = LEVELS[levelIndex].scramble;
    let turns = 0;
    if (mode === 'half' && index % 2 === 0) turns = (index % 3) + 1;
    if (mode === 'all') turns = ((index * 2 + 1) % 3) + 1;
    for (let i = 0; i < turns; i++) piece.cells = rotateCells(piece.cells);

    renderPieceCells(piece);
    const slot = homeSlot(piece);
    piece.x = slot.x; piece.y = slot.y; piece.scale = slot.scale;
    renderTransform(piece);

    piece.group.addEventListener('pointerdown', evt => beginPress(evt, piece));
    piece.group.addEventListener('keydown', evt => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        togglePieceSelection(piece);
      }
    });

    pieceLayer.appendChild(piece.group);
    return piece;
  }

  function initOccupancy() {
    occupancy = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) => isActiveCell(col, row) ? null : '#blocked')
    );
  }

  function hideTutorialGuide(permanent = true) {
    if (tutorialHand?.parentNode) tutorialHand.remove();
    tutorialHand = null;
    if (permanent) tutorialDismissed = true;
  }

  function showTutorialGuide() {
    if (!LEVELS[levelIndex].tutorial || tutorialDismissed || !pieces.length) return;
    hideTutorialGuide(false);

    const piece = pieces[0];
    const slot = homeSlot(piece);
    const b = boundsFor(piece.cells);
    const startX = slot.x + (b.cols * CELL * slot.scale) / 2;
    const startY = slot.y + (b.rows * CELL * slot.scale) / 2;
    const endX = BOARD.x + (piece.targetCol + b.cols / 2) * CELL;
    const endY = BOARD.y + (piece.targetRow + b.rows / 2) * CELL;
    const dx = endX - startX;
    const dy = endY - startY;

    const guide = svgEl('g', { class: 'tutorial-guide', 'pointer-events': 'none' });

    const target = svgEl('g', { class: 'tutorial-target' });
    piece.targetCells.forEach(([cx, cy]) => {
      const r = svgEl('rect', {
        x: BOARD.x + (piece.targetCol + cx) * CELL + 7,
        y: BOARD.y + (piece.targetRow + cy) * CELL + 7,
        width: CELL - 14, height: CELL - 14, rx: 10,
        fill: piece.color, 'fill-opacity': '.11', stroke: piece.color,
        'stroke-opacity': '.7', 'stroke-width': '4', 'stroke-dasharray': '9 7'
      });
      r.appendChild(svgEl('animate', {
        attributeName: 'opacity', values: '.3;1;.3', dur: '1.25s', repeatCount: 'indefinite'
      }));
      target.appendChild(r);
    });
    guide.appendChild(target);

    const label = svgEl('g', { transform: `translate(${startX} ${startY - 82})` });
    label.appendChild(svgEl('rect', { x: -61, y: -22, width: 122, height: 42, rx: 21, fill: '#2c2740', opacity: '.92' }));
    const labelText = svgEl('text', { x: 0, y: 6, fill: '#ffffff', 'font-size': '18', 'font-weight': '900', 'text-anchor': 'middle', 'letter-spacing': '.8' });
    labelText.textContent = 'DRAG ME';
    label.appendChild(labelText);
    label.appendChild(svgEl('animate', { attributeName: 'opacity', values: '.35;1;.35', dur: '1.4s', repeatCount: 'indefinite' }));
    guide.appendChild(label);

    const handOrigin = svgEl('g', { transform: `translate(${startX} ${startY})` });
    const moving = svgEl('g');
    const halo = svgEl('circle', { cx: 0, cy: 2, r: 38, fill: '#ffffff', opacity: '.94', filter: 'url(#pieceShadow)' });
    moving.appendChild(halo);
    const handText = svgEl('text', { x: 0, y: 18, 'font-size': '52', 'text-anchor': 'middle' });
    handText.textContent = '☝️';
    moving.appendChild(handText);
    moving.appendChild(svgEl('animateTransform', {
      attributeName: 'transform', type: 'translate',
      values: `0 0;0 0;${dx} ${dy};${dx} ${dy};0 0`,
      keyTimes: '0;.14;.68;.84;1', dur: '2.7s', repeatCount: 'indefinite'
    }));
    moving.appendChild(svgEl('animate', {
      attributeName: 'opacity', values: '0;1;1;1;0', keyTimes: '0;.08;.72;.9;1', dur: '2.7s', repeatCount: 'indefinite'
    }));
    handOrigin.appendChild(moving);
    guide.appendChild(handOrigin);

    effectsLayer.appendChild(guide);
    tutorialHand = guide;
  }

  function initLevel() {
    stopTimer();
    clearTimeout(ghostTimeout);
    clearTimeout(helpMarkTimer);
    ghostTimeout = null;
    helpMarkTimer = null;
    started = false;
    completed = false;
    elapsed = 0;
    moves = 0;
    selectedPiece = null;
    activePiece = null;
    activePointerId = null;
    pressState = null;
    tutorialDismissed = false;
    tutorialHand = null;
    ghostLayer.innerHTML = '';
    effectsLayer.innerHTML = '';
    pieceLayer.innerHTML = '';
    ui.winOverlay.classList.add('hidden');
    configureBoard();
    initOccupancy();
    drawBoard();
    pieces = LEVELS[levelIndex].pieces.map(createPiece);
    updateHud();
    drawLevelDots();
    if (LEVELS[levelIndex].tutorial) {
      speak('start', 'Follow the little hand: drag the first piece into the glowing space. No rotation needed! ✨');
      setTimeout(showTutorialGuide, 280);
    } else {
      speak('start', LEVELS[levelIndex].subtitle + ' ' + randomMessage('start'));
    }
  }

  // ---------- Interaction ----------
  function setPieceSelected(piece, selected) {
    if (!piece?.group) return;
    piece.group.classList.toggle('selected', selected);
    piece.group.setAttribute('aria-pressed', String(selected));
  }

  function selectPiece(piece) {
    if (selectedPiece === piece) {
      setPieceSelected(piece, true);
      pieceLayer.appendChild(piece.group);
      return;
    }
    if (selectedPiece) setPieceSelected(selectedPiece, false);
    selectedPiece = piece;
    setPieceSelected(piece, true);
    pieceLayer.appendChild(piece.group);
  }

  function deselectPiece(piece = selectedPiece) {
    if (!piece) return;
    setPieceSelected(piece, false);
    if (selectedPiece === piece) selectedPiece = null;
  }

  function togglePieceSelection(piece) {
    if (selectedPiece === piece) {
      deselectPiece(piece);
      speak('start', `${piece.name} deselected. Tap another piece whenever you are ready.`);
    } else {
      selectPiece(piece);
      speak('start', `${piece.name} selected. Tap it again to deselect, or drag it to move.`);
    }
    sfx('pick');
  }

  function clearPieceFromBoard(piece) {
    if (!piece.placed) return;
    piece.cells.forEach(([cx,cy]) => {
      const x = piece.col + cx;
      const y = piece.row + cy;
      if (occupancy[y]?.[x] === piece.id) occupancy[y][x] = null;
    });
  }

  function fillPieceOnBoard(piece) {
    piece.cells.forEach(([cx,cy]) => {
      occupancy[piece.row + cy][piece.col + cx] = piece.id;
    });
  }

  function beginPress(evt, piece) {
    if (completed || activePiece || pressState) return;
    if (evt.button !== undefined && evt.button !== 0) return;
    clearHelpMarks();
    evt.preventDefault();
    if (LEVELS[levelIndex].tutorial && !tutorialDismissed) hideTutorialGuide(true);
    ensureAudio();

    const startSvg = pointFromEvent(evt);
    pressState = {
      piece,
      pointerId: evt.pointerId,
      pointerType: evt.pointerType || 'mouse',
      startClientX: evt.clientX,
      startClientY: evt.clientY,
      startSvg,
      dragging: false
    };
    activePointerId = evt.pointerId;
    try { svg.setPointerCapture(evt.pointerId); } catch (_) {}
  }

  function startDragFromPress(evt) {
    if (!pressState || pressState.dragging) return;
    const piece = pressState.piece;
    pressState.dragging = true;
    startTimer();
    selectPiece(piece);
    sfx('pick');

    piece.animToken++;
    const pt = pointFromEvent(evt);
    const localX = (pressState.startSvg.x - piece.x) / piece.scale;
    const localY = (pressState.startSvg.y - piece.y) / piece.scale;

    piece.origin = {
      placed: piece.placed,
      col: piece.col,
      row: piece.row,
      x: piece.x,
      y: piece.y,
      scale: piece.scale,
      cells: copyCells(piece.cells)
    };

    if (piece.placed) clearPieceFromBoard(piece);
    piece.placed = false;
    piece.col = null;
    piece.row = null;

    piece.scale = 1;
    piece.x = pt.x - localX;
    piece.y = pt.y - localY;
    piece.dragOffset = { x: localX, y: localY };
    renderTransform(piece);
    piece.group.classList.add('dragging');
    pieceLayer.appendChild(piece.group);
    activePiece = piece;
    updateSnapGhost(piece);
  }

  function moveDrag(evt) {
    if (!pressState || evt.pointerId !== pressState.pointerId) return;
    evt.preventDefault();

    if (!pressState.dragging) {
      const dx = evt.clientX - pressState.startClientX;
      const dy = evt.clientY - pressState.startClientY;
      const threshold = pressState.pointerType === 'touch' ? 10 : 6;
      if (Math.hypot(dx, dy) < threshold) return;
      startDragFromPress(evt);
    }

    if (!activePiece) return;
    const pt = pointFromEvent(evt);
    activePiece.x = pt.x - activePiece.dragOffset.x;
    activePiece.y = pt.y - activePiece.dragOffset.y;
    renderTransform(activePiece);
    updateSnapGhost(activePiece);
  }

  function endDrag(evt, cancelled = false) {
    if (!pressState || evt.pointerId !== pressState.pointerId) return;
    const pressed = pressState;
    pressState = null;
    activePointerId = null;
    try { svg.releasePointerCapture(evt.pointerId); } catch (_) {}

    // A true tap/click only changes selection. Dragging starts after a small
    // movement threshold, which keeps mobile taps reliable and prevents pieces
    // from jumping under the finger.
    if (!pressed.dragging) {
      if (!cancelled) togglePieceSelection(pressed.piece);
      return;
    }

    if (!activePiece) return;
    const piece = activePiece;
    activePiece = null;
    piece.group.classList.remove('dragging');
    hideGhost();

    if (cancelled) {
      returnPiece(piece);
      return;
    }

    const snap = snapCandidate(piece);
    if (snap && snap.close && canPlace(piece, snap.col, snap.row)) {
      placePiece(piece, snap.col, snap.row, true);
      return;
    }

    const cameFromBoard = !!piece.origin?.placed;
    const intentionallyOutside = cameFromBoard && (!snap || !snap.insideBounds);

    if (intentionallyOutside) {
      ejectPiece(piece, true);
      return;
    }

    const nearBoard = snap && snap.close;
    if (nearBoard) {
      sfx('invalid');
      speak('oops');
      nudgeBoard();
    }
    returnPiece(piece);
  }

  function snapCandidate(piece) {
    const col = Math.round((piece.x - BOARD.x) / CELL);
    const row = Math.round((piece.y - BOARD.y) / CELL);
    const sx = BOARD.x + col * CELL;
    const sy = BOARD.y + row * CELL;
    const dist = Math.hypot(piece.x - sx, piece.y - sy);
    const b = boundsFor(piece.cells);
    const centerX = piece.x + b.cols * CELL / 2;
    const centerY = piece.y + b.rows * CELL / 2;
    const insideBounds = centerX >= BOARD.x && centerX <= BOARD.x + BOARD.w && centerY >= BOARD.y && centerY <= BOARD.y + BOARD.h;
    const overlapsBoard = centerX > BOARD.x - CELL && centerX < BOARD.x + BOARD.w + CELL && centerY > BOARD.y - CELL && centerY < BOARD.y + BOARD.h + CELL;
    return { col, row, close: overlapsBoard && dist < CELL * 1.08, insideBounds, x: sx, y: sy };
  }

  function canPlace(piece, col, row) {
    return piece.cells.every(([cx,cy]) => {
      const x = col + cx;
      const y = row + cy;
      return x >= 0 && x < COLS && y >= 0 && y < ROWS && occupancy[y][x] === null;
    });
  }

  function placePiece(piece, col, row, countMove) {
    piece.placed = true;
    piece.col = col;
    piece.row = row;
    fillPieceOnBoard(piece);
    if (countMove) moves++;
    piece.lastPlacedMove = moves;
    updateHud();
    animatePieceTo(piece, BOARD.x + col * CELL, BOARD.y + row * CELL, 1, 250, true);
    sparkleAt(piece, col, row);
    sfx('place');
    speak('place');
    if (navigator.vibrate) navigator.vibrate(12);
    checkWin();
  }

  function returnPiece(piece) {
    if (piece.origin?.placed) {
      piece.cells = copyCells(piece.origin.cells);
      renderPieceCells(piece);
      piece.placed = true;
      piece.col = piece.origin.col;
      piece.row = piece.origin.row;
      fillPieceOnBoard(piece);
      animatePieceTo(piece, piece.origin.x, piece.origin.y, 1, 300, true);
    } else {
      const slot = homeSlot(piece);
      animatePieceTo(piece, slot.x, slot.y, slot.scale, 320, true);
      piece.placed = false;
      piece.col = null;
      piece.row = null;
    }
  }

  function ejectPiece(piece, countMove = true) {
    piece.placed = false;
    piece.col = null;
    piece.row = null;
    piece.lastPlacedMove = 0;
    const slot = homeSlot(piece);
    if (countMove) moves++;
    updateHud();
    animatePieceTo(piece, slot.x, slot.y, slot.scale, 360, true);
    piece.group.classList.add('ejected');
    setTimeout(() => piece.group.classList.remove('ejected'), 420);
    sfx('remove');
    speak('remove');
    if (navigator.vibrate) navigator.vibrate([8, 24, 8]);
  }

  function updateSnapGhost(piece) {
    const snap = snapCandidate(piece);

    if (piece.origin?.placed && snap && !snap.insideBounds) {
      ghostLayer.innerHTML = '';
      const b = boundsFor(piece.cells);
      const cx = piece.x + b.cols * CELL / 2;
      const cy = piece.y - 22;
      const g = svgEl('g', { transform: `translate(${cx} ${cy})`, class: 'remove-ghost' });
      g.appendChild(svgEl('rect', { x: -76, y: -23, width: 152, height: 42, rx: 21, fill: '#2c2740', opacity: '.92' }));
      const t = svgEl('text', { x: 0, y: 5, fill: '#fff', 'font-size': '15', 'font-weight': '900', 'text-anchor': 'middle', 'letter-spacing': '1' });
      t.textContent = 'DROP TO REMOVE';
      g.appendChild(t);
      ghostLayer.appendChild(g);
      return;
    }

    if (!snap || !snap.close) {
      hideGhost();
      return;
    }
    ghostLayer.innerHTML = '';
    const valid = canPlace(piece, snap.col, snap.row);
    const g = svgEl('g', { transform: `translate(${snap.x} ${snap.y})`, opacity: valid ? '.28' : '.18' });
    piece.cells.forEach(([cx,cy]) => {
      g.appendChild(svgEl('rect', {
        x: cx*CELL + 4, y: cy*CELL + 4, width: CELL-8, height: CELL-8, rx: 10,
        fill: valid ? piece.color : '#e45c6c', stroke: valid ? '#ffffff' : '#a52d43', 'stroke-width': '3', 'stroke-dasharray': valid ? '0' : '7 5'
      }));
    });
    ghostLayer.appendChild(g);
  }

  function hideGhost() {
    ghostLayer.innerHTML = '';
  }

  function rotateSelected() {
    clearHelpMarks();
    if (LEVELS[levelIndex].rotationLocked) {
      speak('rotate', 'Rotation unlocks on level 3. Levels 1 and 2 are pure drag-and-drop training!');
      return;
    }
    if (!selectedPiece || activePiece || completed) {
      speak('rotate', selectedPiece ? 'Finish the drag first, then we can spin it.' : 'Tap a puzzle piece first, then I can spin it.');
      return;
    }
    ensureAudio();
    startTimer();
    const piece = selectedPiece;
    const oldCells = copyCells(piece.cells);
    const oldCol = piece.col;
    const oldRow = piece.row;
    if (piece.placed) clearPieceFromBoard(piece);
    piece.cells = rotateCells(piece.cells);

    if (piece.placed) {
      const offsets = [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]];
      let spot = null;
      for (const [dx,dy] of offsets) {
        if (canPlace(piece, oldCol + dx, oldRow + dy)) { spot = [oldCol + dx, oldRow + dy]; break; }
      }
      if (!spot) {
        piece.cells = oldCells;
        piece.col = oldCol;
        piece.row = oldRow;
        fillPieceOnBoard(piece);
        renderPieceCells(piece);
        piece.group.classList.add('selected');
        sfx('invalid');
        speak('oops', 'That spin bumps into a neighbor. Try moving it first.');
        return;
      }
      piece.col = spot[0]; piece.row = spot[1];
      fillPieceOnBoard(piece);
      renderPieceCells(piece);
      piece.group.classList.add('selected', 'twinkle');
      animatePieceTo(piece, BOARD.x + piece.col*CELL, BOARD.y + piece.row*CELL, 1, 180, false);
    } else {
      renderPieceCells(piece);
      piece.group.classList.add('selected', 'twinkle');
      const slot = homeSlot(piece);
      animatePieceTo(piece, slot.x, slot.y, slot.scale, 220, false);
    }
    setTimeout(() => piece.group.classList.remove('twinkle'), 250);
    sfx('rotate');
    speak('rotate');
  }

  function clearHelpMarks() {
    clearTimeout(helpMarkTimer);
    helpMarkTimer = null;
    pieces.forEach(piece => piece.group?.classList.remove('help-wrong', 'help-next'));
  }

  function orientationVariants(cells) {
    const seen = new Set();
    const variants = [];
    let current = normalizeCells(copyCells(cells));
    for (let i = 0; i < 4; i++) {
      const key = current.map(([x,y]) => `${x},${y}`).join('|');
      if (!seen.has(key)) {
        seen.add(key);
        variants.push(copyCells(current));
      }
      current = rotateCells(current);
    }
    return variants;
  }

  function cellsKey(cells) {
    return normalizeCells(copyCells(cells)).map(([x,y]) => `${x},${y}`).join('|');
  }

  // Small exact-cover solver used only by the Help button. It treats already
  // placed pieces as fixed and asks whether every remaining piece can still
  // complete the silhouette. This means Help can detect a real dead end rather
  // than simply comparing the player with one hard-coded solution.
  function solveCurrentBoard(ignorePieceId = null) {
    const activeCells = [];
    const activeIndex = new Map();
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        if (!isActiveCell(col, row)) continue;
        const idx = activeCells.length;
        activeCells.push([col, row]);
        activeIndex.set(`${col},${row}`, idx);
      }
    }

    let fixedMask = 0n;
    const remaining = [];
    for (const piece of pieces) {
      if (piece.placed && piece.id !== ignorePieceId) {
        for (const [cx,cy] of piece.cells) {
          const idx = activeIndex.get(`${piece.col + cx},${piece.row + cy}`);
          if (idx === undefined) return { solvable: false, solution: [], aborted: false };
          const bit = 1n << BigInt(idx);
          if ((fixedMask & bit) !== 0n) return { solvable: false, solution: [], aborted: false };
          fixedMask |= bit;
        }
      } else {
        remaining.push(piece);
      }
    }

    const fullMask = (1n << BigInt(activeCells.length)) - 1n;
    const remainingArea = remaining.reduce((sum, piece) => sum + piece.targetCells.length, 0);
    // The expression above for emptyCount is intentionally avoided for logic;
    // compare area through bit counting below to keep the solver honest.
    let filledCount = 0;
    let tempMask = fixedMask;
    while (tempMask) { filledCount += Number(tempMask & 1n); tempMask >>= 1n; }
    if (remainingArea !== activeCells.length - filledCount) {
      return { solvable: false, solution: [], aborted: false };
    }

    const placementsById = new Map();
    for (const piece of remaining) {
      const byMask = new Map();
      const targetKey = cellsKey(piece.targetCells);
      const variants = LEVELS[levelIndex].rotationLocked
        ? [normalizeCells(copyCells(piece.cells))]
        : orientationVariants(piece.targetCells);
      for (const cells of variants) {
        const b = boundsFor(cells);
        for (let row = 0; row <= ROWS - b.rows; row++) {
          for (let col = 0; col <= COLS - b.cols; col++) {
            let mask = 0n;
            let valid = true;
            for (const [cx,cy] of cells) {
              const idx = activeIndex.get(`${col + cx},${row + cy}`);
              if (idx === undefined) { valid = false; break; }
              mask |= 1n << BigInt(idx);
            }
            if (!valid || (mask & fixedMask) !== 0n) continue;
            const key = mask.toString();
            const score = col === piece.targetCol && row === piece.targetRow && cellsKey(cells) === targetKey ? 0 : 1;
            const candidate = { mask, col, row, cells: copyCells(cells), score };
            const previous = byMask.get(key);
            if (!previous || candidate.score < previous.score) byMask.set(key, candidate);
          }
        }
      }
      const placements = [...byMask.values()].sort((a,b) => a.score - b.score);
      if (!placements.length) return { solvable: false, solution: [], aborted: false };
      placementsById.set(piece.id, placements);
    }

    const ids = remaining.map(piece => piece.id);
    const memo = new Set();
    let nodes = 0;
    let aborted = false;
    const NODE_LIMIT = 180000;

    function dfs(filled, left) {
      nodes++;
      if (nodes > NODE_LIMIT) { aborted = true; return null; }
      if (!left.length) return filled === fullMask ? [] : null;

      const memoKey = `${filled.toString(36)}|${left.join(',')}`;
      if (memo.has(memoKey)) return null;

      let bestOptions = null;
      for (let idx = 0; idx < activeCells.length; idx++) {
        const bit = 1n << BigInt(idx);
        if ((filled & bit) !== 0n) continue;
        const options = [];
        for (const id of left) {
          for (const placement of placementsById.get(id) || []) {
            if ((placement.mask & bit) !== 0n && (placement.mask & filled) === 0n) {
              options.push({ id, placement });
            }
          }
        }
        if (!options.length) { memo.add(memoKey); return null; }
        if (!bestOptions || options.length < bestOptions.length) {
          bestOptions = options;
          if (options.length === 1) break;
        }
      }

      if (!bestOptions) { memo.add(memoKey); return null; }
      bestOptions.sort((a,b) => a.placement.score - b.placement.score);
      for (const option of bestOptions) {
        const rest = left.filter(id => id !== option.id);
        const tail = dfs(filled | option.placement.mask, rest);
        if (tail) return [{ pieceId: option.id, ...option.placement }, ...tail];
        if (aborted) return null;
      }
      memo.add(memoKey);
      return null;
    }

    const solution = dfs(fixedMask, ids);
    return { solvable: !!solution, solution: solution || [], aborted };
  }

  function drawHelpPlacement(piece, placement, labelText = 'TRY HERE') {
    ghostLayer.innerHTML = '';
    const g = svgEl('g', {
      transform: `translate(${BOARD.x + placement.col*CELL} ${BOARD.y + placement.row*CELL})`,
      class: 'help-ghost'
    });
    placement.cells.forEach(([cx,cy]) => {
      const r = svgEl('rect', {
        x: cx*CELL + 6, y: cy*CELL + 6, width: CELL-12, height: CELL-12, rx: 10,
        fill: piece.color, opacity: '.22', stroke: '#ffffff', 'stroke-width': '4',
        'stroke-dasharray': '8 6', filter: 'url(#softGlow)'
      });
      r.appendChild(svgEl('animate', { attributeName: 'opacity', values: '.12;.5;.12', dur: '1.05s', repeatCount: 'indefinite' }));
      g.appendChild(r);
    });
    const b = boundsFor(placement.cells);
    const badge = svgEl('g', { transform: `translate(${b.cols*CELL/2} -18)` });
    badge.appendChild(svgEl('rect', { x: -54, y: -18, width: 108, height: 34, rx: 17, fill: '#2c2740', opacity: '.92' }));
    const text = svgEl('text', { x: 0, y: 5, fill: '#fff', 'font-size': '13', 'font-weight': '900', 'text-anchor': 'middle', 'letter-spacing': '1' });
    text.textContent = labelText;
    badge.appendChild(text);
    g.appendChild(badge);
    ghostLayer.appendChild(g);
  }

  function drawWrongBadge(piece) {
    ghostLayer.innerHTML = '';
    const b = boundsFor(piece.cells);
    const cx = piece.x + b.cols * CELL * piece.scale / 2;
    const cy = piece.y - 22;
    const g = svgEl('g', { transform: `translate(${cx} ${cy})`, class: 'wrong-badge' });
    g.appendChild(svgEl('rect', { x: -61, y: -20, width: 122, height: 36, rx: 18, fill: '#d44d65', opacity: '.96' }));
    const text = svgEl('text', { x: 0, y: 4, fill: '#fff', 'font-size': '13', 'font-weight': '900', 'text-anchor': 'middle', 'letter-spacing': '1' });
    text.textContent = 'MOVE THIS';
    g.appendChild(text);
    ghostLayer.appendChild(g);
  }

  function showHelp() {
    if (completed || activePiece) return;
    if (LEVELS[levelIndex].tutorial && !tutorialDismissed) hideTutorialGuide(true);
    ensureAudio();
    startTimer();
    clearHelpMarks();
    hideGhost();

    const analysis = solveCurrentBoard();
    if (analysis.solvable) {
      const unplaced = pieces.filter(piece => !piece.placed);
      if (!unplaced.length) {
        speak('help', 'Everything is placed. One tiny nudge should finish it.');
        sfx('help');
        return;
      }
      const preferred = selectedPiece && !selectedPiece.placed ? selectedPiece : unplaced[0];
      const move = analysis.solution.find(item => item.pieceId === preferred.id) || analysis.solution[0];
      const piece = pieces.find(item => item.id === move?.pieceId) || preferred;
      if (move && piece) {
        selectPiece(piece);
        piece.group.classList.add('help-next');
        drawHelpPlacement(piece, move, 'TRY HERE');
        speak('help', pieces.some(p => p.placed)
          ? 'Good news: the board is still solvable. Nothing is definitely wrong yet — try the glowing move.'
          : 'Start with this anchor piece. I marked one safe landing.');
      }
      sfx('help');
    } else {
      const candidates = pieces
        .filter(piece => piece.placed)
        .sort((a,b) => (b.lastPlacedMove || 0) - (a.lastPlacedMove || 0));

      let culprit = null;
      let recovery = null;
      if (!analysis.aborted) {
        for (const candidate of candidates) {
          const trial = solveCurrentBoard(candidate.id);
          if (trial.solvable) { culprit = candidate; recovery = trial; break; }
          if (trial.aborted) break;
        }
      }

      if (!culprit) {
        culprit = candidates.find(piece =>
          piece.col !== piece.targetCol || piece.row !== piece.targetRow || cellsKey(piece.cells) !== cellsKey(piece.targetCells)
        ) || candidates[0];
      }

      if (culprit) {
        selectPiece(culprit);
        culprit.group.classList.add('help-wrong');
        drawWrongBadge(culprit);
        const safeMove = recovery?.solution.find(item => item.pieceId === culprit.id);
        speak('help', safeMove
          ? 'This piece is creating a dead end. Pull it out or move it; then the puzzle becomes solvable again.'
          : 'The board is tangled. Start by moving the highlighted piece and reopen some space.');
      } else {
        speak('help', 'I cannot find a safe completion from here. Try pulling one recent piece back out.');
      }
      sfx('help');
    }

    clearTimeout(ghostTimeout);
    ghostTimeout = setTimeout(() => hideGhost(), 3200);
    helpMarkTimer = setTimeout(() => clearHelpMarks(), 3400);
  }

  // ---------- Effects ----------
  function sparkleAt(piece, col, row) {
    const b = boundsFor(piece.cells);
    const cx = BOARD.x + (col + b.cols/2) * CELL;
    const cy = BOARD.y + (row + b.rows/2) * CELL;
    for (let i = 0; i < 7; i++) {
      const dot = svgEl('circle', {
        cx, cy, r: 5 + Math.random()*4, fill: i % 2 ? '#ffffff' : piece.color, opacity: '.95'
      });
      effectsLayer.appendChild(dot);
      const angle = (Math.PI*2*i/7) + Math.random()*.35;
      const dist = 42 + Math.random()*42;
      const dx = Math.cos(angle)*dist;
      const dy = Math.sin(angle)*dist;
      dot.animate([
        { transform: 'translate(0px,0px) scale(.4)', opacity: .95 },
        { transform: `translate(${dx}px,${dy}px) scale(1.05)`, opacity: 0 }
      ], { duration: 430 + Math.random()*180, easing: 'cubic-bezier(.2,.75,.35,1)' });
      setTimeout(() => dot.remove(), 700);
    }
  }

  function nudgeBoard() {
    const el = boardLayer;
    el.animate([
      { transform: 'translateX(0)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(5px)' },
      { transform: 'translateX(-3px)' },
      { transform: 'translateX(0)' }
    ], { duration: 240, easing: 'ease-out' });
  }

  function makeConfetti() {
    ui.confetti.innerHTML = '';
    const colors = ['#ff6d83','#ffd34e','#64c985','#6caeef','#8c6bdd','#f08b55'];
    for (let i = 0; i < 72; i++) {
      const bit = document.createElement('i');
      bit.className = 'confetti';
      bit.style.setProperty('--left', `${Math.random()*100}%`);
      bit.style.setProperty('--size', `${6 + Math.random()*8}px`);
      bit.style.setProperty('--color', colors[i % colors.length]);
      bit.style.setProperty('--rotate', `${Math.random()*180}deg`);
      bit.style.setProperty('--drift', `${-90 + Math.random()*180}px`);
      bit.style.setProperty('--duration', `${1.8 + Math.random()*1.5}s`);
      bit.style.animationDelay = `${Math.random()*.45}s`;
      ui.confetti.appendChild(bit);
    }
    setTimeout(() => { ui.confetti.innerHTML = ''; }, 3600);
  }

  // ---------- Win ----------
  function checkWin() {
    if (completed) return;
    const full = boardMask.every((row, y) => row.every((active, x) => !active || !!occupancy[y][x]));
    if (!full) return;
    completed = true;
    stopTimer();
    sfx('win');
    speak('win');
    makeConfetti();

    const key = `cozy-fit-best-${levelIndex}`;
    const best = Number(storageGet(key) || 0);
    if (!best || elapsed < best) storageSet(key, String(elapsed));
    unlockAfterWin(levelIndex);
    window.CozyAds?.noteLevelComplete?.(levelIndex);
    updateHud();
    drawLevelDots();

    const par = LEVELS[levelIndex].par || (LEVELS[levelIndex].pieces.length + 6);
    const stars = moves <= par ? 3 : moves <= par + 6 ? 2 : 1;
    ui.winStars.textContent = '★ '.repeat(stars).trim() + (stars < 3 ? ' ' + '☆ '.repeat(3-stars).trim() : '');
    ui.winStars.setAttribute('aria-label', `${stars} star${stars === 1 ? '' : 's'}`);
    ui.winTime.textContent = formatTime(elapsed);
    ui.winMoves.textContent = moves;
    ui.winCopy.textContent = randomMessage('win');
    ui.next.textContent = levelIndex === LEVELS.length - 1 ? 'Back to map →' : 'Next puzzle →';
    setTimeout(() => ui.winOverlay.classList.remove('hidden'), 550);
  }

  // ---------- Full screen ----------
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || pseudoFullscreen);
  }

  function updateFullscreenUi() {
    const on = isFullscreen();
    document.body.classList.toggle('fullscreen-mode', on);
    if (ui.fullscreen) {
      const icon = ui.fullscreen.querySelector('.icon');
      if (icon) icon.textContent = on ? '⤢' : '⛶';
      ui.fullscreen.setAttribute('aria-label', on ? 'Exit full screen' : 'Enter full screen');
      ui.fullscreen.setAttribute('title', on ? 'Exit full screen · F' : 'Full screen · F');
      ui.fullscreen.setAttribute('aria-pressed', String(on));
    }
    if (ui.settingsFullscreenStatus) {
      ui.settingsFullscreenStatus.textContent = on ? 'Full screen is on. Tap to exit.' : 'Use the whole screen while playing.';
    }
    if (ui.settingsFullscreen) {
      const arrow = ui.settingsFullscreen.querySelector('.setting-row-arrow');
      if (arrow) arrow.textContent = on ? '⤢' : '⛶';
    }
  }

  async function toggleFullscreen() {
    ensureAudio();
    const root = document.documentElement;
    const request = root.requestFullscreen || root.webkitRequestFullscreen;
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    const nativeOn = !!(document.fullscreenElement || document.webkitFullscreenElement);

    try {
      if (nativeOn && exit) {
        await exit.call(document);
      } else if (!nativeOn && request) {
        pseudoFullscreen = false;
        await request.call(root);
      } else {
        pseudoFullscreen = !pseudoFullscreen;
        document.body.classList.toggle('pseudo-fullscreen', pseudoFullscreen);
        updateFullscreenUi();
      }
    } catch (_) {
      pseudoFullscreen = !pseudoFullscreen;
      document.body.classList.toggle('pseudo-fullscreen', pseudoFullscreen);
      updateFullscreenUi();
    }
  }

  async function runWinTransition(action, reason = 'next') {
    const buttons = [ui.next, ui.winMap].filter(Boolean);
    buttons.forEach(button => { button.disabled = true; });
    try {
      if (window.CozyAds?.beforeLevelTransition) {
        await window.CozyAds.beforeLevelTransition({ completedLevelIndex: levelIndex, reason });
      }
    } catch (_) {
      // Ad failures must never block progression.
    } finally {
      buttons.forEach(button => { button.disabled = false; });
    }
    action();
  }

  // ---------- Controls ----------
  svg.addEventListener('pointermove', moveDrag, { passive: false });
  svg.addEventListener('pointerup', evt => endDrag(evt, false), { passive: false });
  svg.addEventListener('pointercancel', evt => endDrag(evt, true), { passive: false });
  svg.addEventListener('contextmenu', evt => evt.preventDefault());

  ui.rotate.addEventListener('click', () => { ensureAudio(); rotateSelected(); });
  ui.help.addEventListener('click', () => { ensureAudio(); showHelp(); });
  ui.reset.addEventListener('click', () => { ensureAudio(); sfx('pick'); initLevel(); });
  ui.replay.addEventListener('click', () => { ensureAudio(); sfx('pick'); initLevel(); });
  ui.next.addEventListener('click', async () => {
    ensureAudio();
    sfx('pick');
    await runWinTransition(() => {
      if (levelIndex >= LEVELS.length - 1) showHome();
      else startLevel(levelIndex + 1);
    }, 'next');
  });
  ui.winMap.addEventListener('click', async () => {
    ensureAudio();
    sfx('pick');
    await runWinTransition(() => showHome(), 'map');
  });
  ui.home.addEventListener('click', () => { ensureAudio(); sfx('pick'); showHome(); });
  ui.brandHome.addEventListener('click', () => {
    ensureAudio();
    if (!ui.homeScreen.classList.contains('screen-hidden')) scrollMapToHighest();
    else { sfx('pick'); showHome(); }
  });
  ui.continueBtn.addEventListener('click', () => {
    ensureAudio();
    sfx('pick');
    startLevel(getHighestUnlocked());
  });

  ui.sound.addEventListener('click', () => {
    ensureAudio();
    setSoundPreference(!soundEnabled, true);
  });

  ui.music.addEventListener('click', () => {
    ensureAudio();
    setMusicPreference(!musicEnabled);
  });

  if (ui.settings) ui.settings.addEventListener('click', () => { ensureAudio(); sfx('pick'); openSettings(); });
  if (ui.settingsClose) ui.settingsClose.addEventListener('click', () => { sfx('pick'); closeSettings(); });
  if (ui.settingsOverlay) ui.settingsOverlay.addEventListener('pointerdown', evt => {
    if (evt.target === ui.settingsOverlay) closeSettings();
  });
  if (ui.settingsSoundToggle) ui.settingsSoundToggle.addEventListener('change', evt => {
    ensureAudio();
    setSoundPreference(evt.currentTarget.checked, evt.currentTarget.checked);
  });
  if (ui.settingsMusicToggle) ui.settingsMusicToggle.addEventListener('change', evt => {
    ensureAudio();
    setMusicPreference(evt.currentTarget.checked);
  });
  if (ui.settingsMotionToggle) ui.settingsMotionToggle.addEventListener('change', evt => {
    setReducedMotionPreference(evt.currentTarget.checked);
  });
  if (ui.settingsFullscreen) ui.settingsFullscreen.addEventListener('click', toggleFullscreen);

  if (ui.fullscreen) ui.fullscreen.addEventListener('click', toggleFullscreen);
  if (ui.privacy) ui.privacy.addEventListener('click', async () => {
    const opened = await window.CozyAds?.openPrivacyOptions?.();
    if (!opened && ui.privacyHint) ui.privacyHint.textContent = 'Google privacy controls are not available yet.';
    updateSettingsAdStatus();
  });
  document.addEventListener('fullscreenchange', updateFullscreenUi);
  document.addEventListener('webkitfullscreenchange', updateFullscreenUi);
  document.addEventListener('cozy-ad-status', updateSettingsAdStatus);

  document.addEventListener('keydown', evt => {
    const settingsOpen = !!ui.settingsOverlay && !ui.settingsOverlay.classList.contains('hidden');
    if (evt.key === 'Escape' && settingsOpen) {
      evt.preventDefault();
      closeSettings();
      return;
    }

    const inGame = !ui.gameScreen.classList.contains('screen-hidden');
    if (inGame && evt.key.toLowerCase() === 'r' && !evt.ctrlKey && !evt.metaKey && !evt.altKey) { evt.preventDefault(); rotateSelected(); }
    if (inGame && evt.key.toLowerCase() === 'h' && !evt.ctrlKey && !evt.metaKey && !evt.altKey) { evt.preventDefault(); showHelp(); }
    if (evt.key.toLowerCase() === 'f' && !evt.ctrlKey && !evt.metaKey && !evt.altKey) { evt.preventDefault(); toggleFullscreen(); }
    if (evt.key === 'Escape' && !ui.winOverlay.classList.contains('hidden')) {
      ui.winOverlay.classList.add('hidden');
      return;
    }
    if (evt.key === 'Escape' && pseudoFullscreen) {
      pseudoFullscreen = false;
      document.body.classList.remove('pseudo-fullscreen');
      updateFullscreenUi();
    }
  });

  document.addEventListener('cozy-ad-start', () => stopMusic());
  document.addEventListener('cozy-ad-end', () => { if (musicEnabled) startMusic(); });

  document.addEventListener('pointerdown', ensureAudio, { once: true });

  loadPlayerPreferences();
  configureSettingsLinks();
  updateSettingsAdStatus();
  updateFullscreenUi();
  showHome({ instant: true });
})();
