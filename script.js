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
const soundBtn = document.getElementById('sound-btn');
const whiteCapturedEl = document.getElementById('white-captured');
const blackCapturedEl = document.getElementById('black-captured');
const evalBarFillEl = document.getElementById('eval-bar-fill');

let moveTimer = null;
let moveDelay = 800; // ms
let isGameActive = false;
let autoRestartTimer = null;
let isSoundOn = true;

// Audio Context
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const PIECE_VALUES = {
    p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
};

const PIECE_SYMBOLS = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
};

function initGame() {
    game.reset();
    isGameActive = true;
    clearTimeout(autoRestartTimer);
    historyListEl.innerHTML = '';
    whiteCapturedEl.innerHTML = '';
    blackCapturedEl.innerHTML = '';
    evalBarFillEl.style.width = '50%';
    renderBoard();
    updateStatus();
    startAutoPlay();
}

function playSound(type) {
    if (!isSoundOn) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'move') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'capture') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.15);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'check') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'gameover') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.2);
        osc.frequency.linearRampToValueAtTime(600, now + 0.4);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now);
        osc.stop(now + 1.0);
    }
}

function renderBoard() {
    boardEl.innerHTML = '';
    const board = game.board();

    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const squareEl = document.createElement('div');
            squareEl.classList.add('square');
            const isLight = (row + col) % 2 === 0;
            squareEl.classList.add(isLight ? 'light' : 'dark');
            const squareName = String.fromCharCode(97 + col) + (8 - row);
            squareEl.dataset.square = squareName;

            const piece = board[row][col];
            if (piece) {
                const pieceEl = document.createElement('div');
                pieceEl.classList.add('piece');
                pieceEl.classList.add(piece.color === 'w' ? 'white' : 'black');
                pieceEl.innerText = PIECE_SYMBOLS[piece.color][piece.type];
                squareEl.appendChild(pieceEl);
            }

            const history = game.history({ verbose: true });
            if (history.length > 0) {
                const lastMove = history[history.length - 1];
                if (lastMove.from === squareName || lastMove.to === squareName) {
                    squareEl.classList.add('highlight');
                }
            }

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
        playSound('gameover');

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
        statusEl.innerText += " - Restarting in 3s...";
        autoRestartTimer = setTimeout(initGame, 3000);
        return;
    }

    const eval = calculateMaterial();
    whiteEvalEl.innerText = eval.w.toFixed(1);
    blackEvalEl.innerText = eval.b.toFixed(1);
    
    // Update Eval Bar
    const diff = eval.w - eval.b;
    // Clamp between -10 and 10 for visual bar
    const clampedDiff = Math.max(-10, Math.min(10, diff));
    // Map -10..10 to 0..100% (0 = 50%, 10 = 100%, -10 = 0%)
    const percentage = 50 + (clampedDiff * 5); 
    evalBarFillEl.style.width = `${percentage}%`;

    updateCapturedPieces();
}

function updateCapturedPieces() {
    // Calculate captured pieces by comparing current board with initial set
    const initialCounts = { p: 8, n: 2, b: 2, r: 2, q: 1, k: 1 };
    const currentCounts = {
        w: { ...initialCounts },
        b: { ...initialCounts }
    };

    const board = game.board();
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) {
                currentCounts[p.color][p.type]--;
            }
        }
    }

    // Render captured pieces (what's missing from board)
    // White captured pieces are Black pieces that are missing
    renderCaptured(whiteCapturedEl, currentCounts.b, 'black');
    // Black captured pieces are White pieces that are missing
    renderCaptured(blackCapturedEl, currentCounts.w, 'white');
}

function renderCaptured(container, counts, colorClass) {
    container.innerHTML = '';
    const pieceOrder = ['q', 'r', 'b', 'n', 'p']; // High value first
    
    pieceOrder.forEach(type => {
        const count = counts[type];
        for (let i = 0; i < count; i++) {
            const span = document.createElement('span');
            span.classList.add('captured-piece', colorClass);
            // Use the symbol of the captured piece's color
            // If white captured a black pawn, we show a black pawn symbol
            const symbolColor = colorClass === 'white' ? 'w' : 'b';
            span.innerText = PIECE_SYMBOLS[symbolColor][type];
            container.appendChild(span);
        }
    });
}

function updateHistory(move) {
    const moveSpan = document.createElement('span');
    moveSpan.classList.add('history-move');
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

        const move = getBestMove(moves);
        game.move(move);
        
        // Sound effects
        if (game.in_check()) {
            playSound('check');
        } else if (move.captured) {
            playSound('capture');
        } else {
            playSound('move');
        }

        updateHistory(move);
        renderBoard();
        updateStatus();
        makeMove();
    }, moveDelay);
}

function getBestMove(moves) {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (const move of moves) {
        let score = 0;
        if (move.captured) {
            score += PIECE_VALUES[move.captured] * 10;
            score -= PIECE_VALUES[move.piece];
        }
        if (move.promotion) {
            score += PIECE_VALUES[move.promotion] * 5;
        }
        const centerSquares = ['e4', 'd4', 'e5', 'd5'];
        if (centerSquares.includes(move.to)) {
            score += 0.5;
        }
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

soundBtn.addEventListener('click', () => {
    isSoundOn = !isSoundOn;
    soundBtn.innerText = `Sound: ${isSoundOn ? 'On' : 'Off'}`;
    if (isSoundOn && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
});

initGame();
