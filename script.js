const game = new Chess();
const boardEl = document.getElementById('board');
const statusEl = document.getElementById('status');
const whiteEvalEl = document.getElementById('white-eval');
const blackEvalEl = document.getElementById('black-eval');
const whitePlayerEl = document.querySelector('.white-player');
const blackPlayerEl = document.querySelector('.black-player');
const historyListEl = document.getElementById('history-list');
const resetBtn = document.getElementById('reset-btn');
const speedBtn = document.getElementById('speed-btn');

let moveTimer = null;
let moveDelay = 800; // ms
let isGameActive = false;
let autoRestartTimer = null;

const PIECE_VALUES = {
    p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
};

// Unicode pieces
const PIECE_SYMBOLS = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

function initGame() {
    game.reset();
    isGameActive = true;
    clearTimeout(autoRestartTimer);
    historyListEl.innerHTML = '';
    renderBoard();
    updateStatus();
    startAutoPlay();
}

function renderBoard() {
    boardEl.innerHTML = '';
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareIndex = row * 8 + col;
            const squareEl = document.createElement('div');
            squareEl.classList.add('square');

            // Color
            const isLight = (row + col) % 2 === 0;
            squareEl.classList.add(isLight ? 'light' : 'dark');

            // Set ID for easy access (e.g., "e4")
            const squareName = String.fromCharCode(97 + col) + (8 - row);
            squareEl.dataset.square = squareName;

            // Piece
            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                pieceEl.classList.add(piece.color === 'w' ? 'white' : 'black');
                pieceEl.innerText = PIECE_SYMBOLS[piece.color][piece.type];
                squareEl.appendChild(pieceEl);
            }

            // Highlight last move
            const history = game.history({ verbose: true });
            if (history.length > 0) {
                const lastMove = history[history.length - 1];
                if (lastMove.from === squareName || lastMove.to === squareName) {
                    squareEl.classList.add('highlight');
                }
            }

            // Highlight check
            if (game.in_check()) {
                const turn = game.turn();
                if (piece && piece.type === 'k' && piece.color === turn) {
                    squareEl.classList.add('check');
                }
            }

            boardEl.appendChild(squareEl);
        }
    }
}

function updateStatus() {
    const turn = game.turn();

    if (turn === 'w') {
        whitePlayerEl.classList.add('active');
        blackPlayerEl.classList.remove('active');
        statusEl.innerText = "White's Turn";
    } else {
        whitePlayerEl.classList.remove('active');
        blackPlayerEl.classList.add('active');
        statusEl.innerText = "Black's Turn";
    }

    if (game.game_over()) {
        isGameActive = false;
        clearTimeout(moveTimer);

        let resultText = '';
        if (game.in_checkmate()) {
            resultText = `Checkmate! ${turn === 'w' ? 'Black' : 'White'} Wins`;
        } else if (game.in_draw()) {
            resultText = 'Draw';
        } else if (game.in_stalemate()) {
            resultText = 'Stalemate';
        } else {
            resultText = 'Game Over';
        }
        statusEl.innerText = resultText;

        // Auto restart after 3 seconds
        statusEl.innerText += " - Restarting in 3s...";
        autoRestartTimer = setTimeout(initGame, 3000);
        return;
    }

    // Update Eval (Simple material count)
    const eval = calculateMaterial();
    whiteEvalEl.innerText = eval.w.toFixed(1);
    blackEvalEl.innerText = eval.b.toFixed(1);
}

function updateHistory(move) {
    const moveSpan = document.createElement('span');
    moveSpan.classList.add('history-move');
    // Format: "1. e4" or just "e4"
    // Let's do just the SAN
    moveSpan.innerText = move.san;
    historyListEl.appendChild(moveSpan);
    historyListEl.scrollTop = historyListEl.scrollHeight;
}

function calculateMaterial() {
    let w = 0;
    let b = 0;
    const board = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) {
                if (p.color === 'w') w += PIECE_VALUES[p.type];
                else b += PIECE_VALUES[p.type];
            }
        }
    }
    return { w, b };
}

function startAutoPlay() {
    if (!isGameActive) return;
    makeMove();
}

function makeMove() {
    if (game.game_over()) {
        updateStatus();
        return;
    }

    moveTimer = setTimeout(() => {
        if (!isGameActive) return;

        const moves = game.moves({ verbose: true });
        if (moves.length === 0) return;

        // AI Logic: Pick best move
        const move = getBestMove(moves);

        game.move(move);
        updateHistory(move); // Use the move object which has SAN from chess.js if we used .move(string), but here we used object. 
        // Wait, game.move(object) returns the move object with SAN.
        // Actually game.move(move) returns the move object.

        renderBoard();
        updateStatus();

        // Continue loop
        makeMove();
    }, moveDelay);
}

function getBestMove(moves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
        let score = 0;

        // Capture value
        if (move.captured) {
            score += PIECE_VALUES[move.captured] * 10;
            score -= PIECE_VALUES[move.piece];
        }

        // Promotion
        if (move.promotion) {
            score += PIECE_VALUES[move.promotion] * 5;
        }

        // Center control bias
        const centerSquares = ['e4', 'd4', 'e5', 'd5'];
        if (centerSquares.includes(move.to)) {
            score += 0.5;
        }

        // Random noise to make it interesting
        score += Math.random() * 0.5;

        if (score > bestScore) {
            bestScore = score;
            bestMoves = [move];
        } else if (score === bestScore) {
            bestMoves.push(move);
        }
    }

    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

resetBtn.addEventListener('click', () => {
    clearTimeout(moveTimer);
    clearTimeout(autoRestartTimer);
    initGame();
});

speedBtn.addEventListener('click', () => {
    if (moveDelay === 800) {
        moveDelay = 200;
        speedBtn.innerText = 'Speed: Fast';
    } else if (moveDelay === 200) {
        moveDelay = 2000;
        speedBtn.innerText = 'Speed: Slow';
    } else {
        moveDelay = 800;
        speedBtn.innerText = 'Speed: Normal';
    }
});

// Start
initGame();
