'use strict';

/* ============================================================================
   NEON GRID — Cyber Tic-Tac-Toe
   Arquitetura MVC em um único arquivo:

     GameModel      -> estado e regras (não toca no DOM)
     GameView       -> apresentação e acessibilidade (não contém regras)
     GameController -> coordena eventos, Model e View

   Fluxo: clique (DOM) -> Controller -> Model.makeMove() -> Controller -> View.render()
   ========================================================================== */

/**
 * As oito combinações de vitória (RF05 / RN03), por índice de célula:
 *   0 1 2
 *   3 4 5
 *   6 7 8
 */
const WIN_LINES = Object.freeze([
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // três linhas
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // três colunas
  [0, 4, 8], [2, 4, 6],            // duas diagonais
]);

const FIRST_PLAYER = 'X'; // RN01

/* ============================================================================
   MODEL — estado e regras de negócio
   ========================================================================== */
class GameModel {
  constructor() {
    this.scores = { X: 0, O: 0, draw: 0 };
    this.resetRound();
  }

  /** RF06 / RN01 / RN06: limpa apenas a rodada; o placar é preservado. */
  resetRound() {
    this.board = Array(9).fill(null);
    this.currentPlayer = FIRST_PLAYER;
    this.status = 'playing'; // 'playing' | 'won' | 'draw'
    this.winner = null;
    this.winningLine = null;
    this.movesCount = 0;
  }

  /** RF08 / RN07: zera o placar e reinicia a rodada (a confirmação é feita pelo Controller). */
  resetScores() {
    this.scores = { X: 0, O: 0, draw: 0 };
    this.resetRound();
  }

  isValidIndex(index) {
    return Number.isInteger(index) && index >= 0 && index < 9;
  }

  /**
   * Tenta registrar uma jogada para o jogador atual.
   * Retorna { ok: true, player, status, winner, winningLine }
   *      ou { ok: false, reason: 'finished' | 'occupied' | 'invalid' }.
   */
  makeMove(index) {
    // RN04: após vitória ou empate, nenhuma jogada é aceita.
    // Também impede atualização duplicada do placar por cliques repetidos.
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    if (!this.isValidIndex(index)) return { ok: false, reason: 'invalid' };
    // RN02 / RF04: célula ocupada não muda e o turno é preservado.
    if (this.board[index] !== null) return { ok: false, reason: 'occupied' };

    const player = this.currentPlayer;
    this.board[index] = player; // RF02
    this.movesCount += 1;

    const line = this.findWinningLine();
    if (line) {
      // RN03: vitória imediata. Vem ANTES do empate: vencer na 9ª jogada é vitória.
      this.status = 'won';
      this.winner = player;
      this.winningLine = line;
      this.scores[player] += 1; // RF07 (ocorre uma única vez, pois status deixou de ser 'playing')
    } else if (this.isBoardFull()) {
      // RN05: nove células preenchidas sem trinca = empate.
      this.status = 'draw';
      this.scores.draw += 1;
    } else {
      // RF03: alterna o turno somente se a partida continua.
      this.currentPlayer = player === 'X' ? 'O' : 'X';
    }

    return {
      ok: true,
      player,
      status: this.status,
      winner: this.winner,
      winningLine: this.winningLine,
    };
  }

  /** RF05: percorre as 8 combinações; retorna a trinca vencedora ou null. */
  findWinningLine() {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return line.slice();
      }
    }
    return null;
  }

  isBoardFull() {
    return this.board.every((cell) => cell !== null);
  }

  /** Cópia somente-leitura do estado, para a View renderizar. */
  getState() {
    return {
      board: this.board.slice(),
      currentPlayer: this.currentPlayer,
      status: this.status,
      winner: this.winner,
      winningLine: this.winningLine ? this.winningLine.slice() : null,
      movesCount: this.movesCount,
      scores: { ...this.scores },
    };
  }
}

/* ============================================================================
   VIEW — somente apresentação (DOM, textos, acessibilidade, animações)
   ========================================================================== */
class GameView {
  constructor(doc) {
    this.boardEl = doc.getElementById('board');
    this.bannerEl = doc.getElementById('turn-banner');
    this.bannerBadgeEl = doc.getElementById('banner-badge');
    this.bannerTextEl = doc.getElementById('banner-text');
    this.feedbackEl = doc.getElementById('feedback');
    this.scoreEls = {
      X: doc.getElementById('score-x'),
      draw: doc.getElementById('score-draw'),
      O: doc.getElementById('score-o'),
    };
    this.newGameBtn = doc.getElementById('btn-new-game');
    this.resetScoresBtn = doc.getElementById('btn-reset-scores');
    this.cells = []; // [{ button, mark }]
    this.lastBannerText = '';
  }

  /** RF01: cria as nove células como <button> (RNF05), sem innerHTML. */
  buildBoard() {
    for (let index = 0; index < 9; index += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.index = String(index);

      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.setAttribute('aria-hidden', 'true'); // o aria-label do botão já descreve a célula

      button.appendChild(mark);
      this.boardEl.appendChild(button);
      this.cells.push({ button, mark });
    }
  }

  /* ----- Ligação de eventos (a View só repassa; quem decide é o Controller) ----- */

  // Delegação de eventos: Enter e Espaço já disparam "click" em <button> (CT09).
  bindCellClick(handler) {
    this.boardEl.addEventListener('click', (event) => {
      const button = event.target.closest('.cell');
      if (!button || !this.boardEl.contains(button)) return;
      handler(Number(button.dataset.index));
    });
  }

  bindNewGame(handler) {
    this.newGameBtn.addEventListener('click', handler);
  }

  bindResetScores(handler) {
    this.resetScoresBtn.addEventListener('click', handler);
  }

  /** RF08: diálogo nativo de confirmação. */
  confirmResetScores() {
    return window.confirm('Zerar o placar? Todas as vitórias e empates serão perdidos.');
  }

  /* ----- Renderização ----- */

  /**
   * Atualiza toda a interface a partir do estado do Model.
   * options: { lastMove, scoreKey, clearFeedback }
   */
  render(state, options = {}) {
    const { lastMove = null, scoreKey = null, clearFeedback = false } = options;
    const finished = state.status !== 'playing';

    this.boardEl.dataset.turn = state.currentPlayer;
    this.boardEl.dataset.status = state.status;

    this.cells.forEach(({ button, mark }, index) => {
      const value = state.board[index];
      const isWin = Boolean(state.winningLine && state.winningLine.includes(index));

      mark.textContent = value ?? '';
      mark.classList.toggle('is-x', value === 'X');
      mark.classList.toggle('is-o', value === 'O');

      button.classList.toggle('is-filled', value !== null);
      button.classList.toggle('is-x', value === 'X');
      button.classList.toggle('is-o', value === 'O');
      button.classList.toggle('is-win', isWin);

      // RN04: células vazias ficam bloqueadas após o fim; as marcadas seguem
      // focáveis para que leitores de tela possam percorrer o resultado.
      button.disabled = finished && value === null;
      button.setAttribute('aria-label', this.describeCell(index, value, isWin));

      // Animação de entrada apenas na célula recém-marcada
      if (index === lastMove && value !== null) this.restartAnimation(mark, 'is-pop');
    });

    this.renderBanner(state);
    this.renderScores(state.scores, scoreKey);
    if (clearFeedback) this.clearFeedback();
  }

  /** aria-label descritivo e dinâmico (RNF05). */
  describeCell(index, value, isWin) {
    const row = Math.floor(index / 3) + 1;
    const col = (index % 3) + 1;
    const content = value ? `marcada com ${value}` : 'vazia';
    const winNote = isWin ? ', faz parte da trinca vencedora' : '';
    return `Linha ${row}, coluna ${col}: ${content}${winNote}`;
  }

  renderBanner(state) {
    let text;
    let badge;
    let player = state.currentPlayer;

    if (state.status === 'won') {
      text = `VITÓRIA // JOGADOR ${state.winner}`;
      badge = state.winner;
      player = state.winner;
    } else if (state.status === 'draw') {
      text = 'EMPATE // SISTEMA BLOQUEADO';
      badge = '=';
      player = '-';
    } else if (state.movesCount === 0) {
      text = `AGUARDANDO JOGADOR ${state.currentPlayer}`;
      badge = state.currentPlayer;
    } else {
      text = `TURNO DO JOGADOR ${state.currentPlayer}`;
      badge = state.currentPlayer;
    }

    this.bannerEl.dataset.player = player;
    this.bannerEl.dataset.status = state.status;
    this.bannerBadgeEl.textContent = badge;
    this.bannerTextEl.textContent = text;

    // Transição visual na alternância de jogadores / mudança de resultado
    if (text !== this.lastBannerText) {
      this.restartAnimation(this.bannerTextEl, 'is-swap');
      this.lastBannerText = text;
    }
  }

  renderScores(scores, scoreKey) {
    Object.keys(this.scoreEls).forEach((key) => {
      this.scoreEls[key].textContent = String(scores[key]);
    });
    // Destaque no placar somente quando ele foi atualizado
    if (scoreKey && this.scoreEls[scoreKey]) {
      this.restartAnimation(this.scoreEls[scoreKey].parentElement, 'is-bump');
    }
  }

  /** RF04: aviso de jogada inválida (texto + tremor, sem depender só de cor). */
  showInvalidMove(index, reason) {
    const messages = {
      occupied: '⚠ JOGADA INVÁLIDA // CASA JÁ OCUPADA',
      finished: '⚠ PARTIDA ENCERRADA // INICIE UMA NOVA PARTIDA',
      invalid: '⚠ JOGADA INVÁLIDA',
    };
    this.feedbackEl.textContent = messages[reason] || messages.invalid;
    const cell = this.cells[index];
    if (cell) this.restartAnimation(cell.button, 'is-invalid');
  }

  clearFeedback() {
    this.feedbackEl.textContent = '';
  }

  /** Reinicia uma animação CSS: remove a classe, força reflow e adiciona de novo. */
  restartAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth; // força reflow para a animação recomeçar
    element.classList.add(className);
    element.addEventListener('animationend', () => element.classList.remove(className), { once: true });
  }
}

/* ============================================================================
   CONTROLLER — coordena Model e View
   ========================================================================== */
class GameController {
  constructor(model, view) {
    this.model = model;
    this.view = view;
  }

  init() {
    this.view.buildBoard();
    this.view.bindCellClick((index) => this.handleCellClick(index));
    this.view.bindNewGame(() => this.handleNewGame());
    this.view.bindResetScores(() => this.handleResetScores());
    this.view.render(this.model.getState());
  }

  /** RF02–RF05, RF07: pede ao Model para validar/registrar e à View para atualizar. */
  handleCellClick(index) {
    const result = this.model.makeMove(index);

    if (!result.ok) {
      this.view.showInvalidMove(index, result.reason); // turno preservado
      return;
    }

    const scoreKey = result.status === 'won' ? result.winner
      : result.status === 'draw' ? 'draw'
      : null;

    this.view.render(this.model.getState(), {
      lastMove: index,
      scoreKey,
      clearFeedback: true,
    });
  }

  /** RF06: limpa o tabuleiro, X começa, placar intacto. */
  handleNewGame() {
    this.model.resetRound();
    this.view.render(this.model.getState(), { clearFeedback: true });
  }

  /** RF08: confirmação explícita; se cancelar, nada muda. */
  handleResetScores() {
    if (!this.view.confirmResetScores()) return;
    this.model.resetScores();
    this.view.render(this.model.getState(), { clearFeedback: true });
  }
}

/* ============================================================================
   Inicialização
   ========================================================================== */
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const controller = new GameController(new GameModel(), new GameView(document));
    controller.init();
  });
}
