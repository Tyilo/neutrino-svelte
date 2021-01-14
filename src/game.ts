import type { Ctx } from "boardgame.io";
import { INVALID_MOVE } from "boardgame.io/core";
import { immerable } from "immer";

export enum PIECE {
  White,
  Black,
  Neutrino,
  None,
}

const OPPOSITE_PIECE = new Map<PIECE, PIECE>();
OPPOSITE_PIECE.set(PIECE.White, PIECE.Black);
OPPOSITE_PIECE.set(PIECE.Black, PIECE.White);

const PLAYER_PIECE = new Map<number, PIECE>();
PLAYER_PIECE.set(0, PIECE.White);
PLAYER_PIECE.set(1, PIECE.Black);

const REVERSE_PLAYER_PIECE = new Map<PIECE, number>();
for (const [k, v] of PLAYER_PIECE.entries()) {
  REVERSE_PLAYER_PIECE.set(v, k);
}

const HOME_ROW = new Map<number, PIECE>();
HOME_ROW.set(0, PIECE.Black);
HOME_ROW.set(4, PIECE.White);

type Row = [PIECE, PIECE, PIECE, PIECE, PIECE];
export type Grid = [Row, Row, Row, Row, Row];

export type Position = [number, number];

export class State {
  [immerable] = true;

  cells: Grid;
  movedNeutrino = false;

  constructor() {
    const cells = [];
    for (let y = 0; y < 5; y++) {
      cells.push(Array(5).fill(HOME_ROW.has(y) ? HOME_ROW.get(y) : PIECE.None));
    }
    cells[2][2] = PIECE.Neutrino;
    this.cells = cells as Grid;
  }
}

export const Neutrino = {
  setup: () => {
    return new State();
  },

  turn: {
    moveLimit: 2,
  },

  moves: {
    move: (G: State, ctx: Ctx, [x1, y1]: Position, [x2, y2]: Position) => {
      const expectedPiece = getPieceToMove(G, ctx.currentPlayer);

      if (G.cells[y1][x1] != expectedPiece) {
        console.error(`Expected: ${expectedPiece}`);
        return INVALID_MOVE;
      }

      if (
        !getValidMovesFrom(G.cells, [x1, y1]).some(
          (p) => p[0] == x2 && p[1] == y2
        )
      ) {
        return INVALID_MOVE;
      }

      G.cells[y2][x2] = G.cells[y1][x1];
      G.cells[y1][x1] = PIECE.None;

      G.movedNeutrino = !G.movedNeutrino;
    },
  },

  endIf: (G: State, ctx: Ctx) => {
    const playerPiece = PLAYER_PIECE.get(parseInt(ctx.currentPlayer));
    const winnerPiece = getWinner(G, playerPiece);
    if (winnerPiece !== null) {
      return { winner: REVERSE_PLAYER_PIECE.get(winnerPiece).toString() };
    }
  },

  ai: {
    enumerate: (G: State, ctx: Ctx) => {
      const piece = getPieceToMove(G, ctx.currentPlayer);
      const moves = [];
      for (const posFrom of getPiecePositions(G.cells, piece)) {
        for (const posTo of getValidMovesFrom(G.cells, posFrom)) {
          moves.push({ move: "move", args: [posFrom, posTo] });
        }
      }
      return moves;
    },
  },
};

export function getPieceToMove(state: State, currentPlayer: string): PIECE {
  if (state.movedNeutrino) {
    return PLAYER_PIECE.get(parseInt(currentPlayer));
  } else {
    return PIECE.Neutrino;
  }
}

function getValidMovesFrom(cells: Grid, [x, y]: Position): Position[] {
  const res = [];
  for (let dx = -1; dx < 2; dx++) {
    for (let dy = -1; dy < 2; dy++) {
      if (dx == 0 && dy == 0) continue;

      let nx = x;
      let ny = y;
      do {
        nx += dx;
        ny += dy;
      } while (
        0 <= nx &&
        nx < 5 &&
        0 <= ny &&
        ny < 5 &&
        cells[ny][nx] == PIECE.None
      );
      nx -= dx;
      ny -= dy;

      if (nx == x && ny == y) {
        continue;
      }

      let allHome = false;
      for (const [yHome, piece] of HOME_ROW.entries()) {
        if (ny == yHome && cells[y][x] == piece) {
          allHome = true;
          for (let xHome = 0; xHome < 5; xHome++) {
            allHome = allHome && (cells[yHome][xHome] == piece || xHome == nx);
          }
        }
      }

      if (allHome) continue;

      res.push([nx, ny]);
    }
  }
  return res;
}

function getPiecePositions(cells: Grid, piece: PIECE): Position[] {
  const res = [];
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 5; x++) {
      if (cells[y][x] == piece) {
        res.push([x, y]);
      }
    }
  }
  return res;
}

function getNeutrinoPosition(cells: Grid): Position {
  const pos = getPiecePositions(cells, PIECE.Neutrino);
  console.assert(pos.length == 1);
  return pos[0];
}

function getWinner(state: State, playerPiece: PIECE): PIECE {
  const neutrinoPos = getNeutrinoPosition(state.cells);

  for (const [yHome, piece] of HOME_ROW.entries()) {
    if (neutrinoPos[1] == yHome) {
      return OPPOSITE_PIECE.get(piece);
    }
  }

  if (!state.movedNeutrino) {
    const neutrinoMoves = getValidMovesFrom(state.cells, neutrinoPos);
    if (neutrinoMoves.length === 0) {
      return OPPOSITE_PIECE.get(playerPiece);
    }
  }

  return null;
}
