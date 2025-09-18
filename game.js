/* game.js
   Implements the game flow described by the user.
*/

'use strict';

// --- Data: item cards available ---
const ITEM_CARDS = [
  { id: 'p10', label: '+10', type: 'add', value: 10 },
  { id: 'p20', label: '+20', type: 'add', value: 20 },
  { id: 'p30', label: '+30', type: 'add', value: 30 },
  { id: 'm10', label: '-10', type: 'add', value: -10 },
  { id: 'm30', label: '-30', type: 'add', value: -30 },
  { id: 'm50', label: '-50', type: 'add', value: -50 },
  { id: 'rev', label: 'リバース', type: 'reverse' },
  { id: 'skip', label: 'スキップ', type: 'skip' },
  { id: 'poison', label: 'ポイズン', type: 'poison' }
];

// --- DOM ---
const menu = document.getElementById('menu');
const normalModeBtn = document.getElementById('normalModeBtn');
const itemModeBtn = document.getElementById('itemModeBtn');

const setup = document.getElementById('setup');
const modeLabel = document.getElementById('modeLabel');
const playerNameInput = document.getElementById('playerNameInput');
const addPlayerBtn = document.getElementById('addPlayerBtn');
const playerList = document.getElementById('playerList');
const shuffleBtn = document.getElementById('shuffleBtn');
const shufflePreview = document.getElementById('shufflePreview');
const startBtn = document.getElementById('startBtn');
const nextBtn = document.getElementById('nextBtn');
const backToMenuFromSetup = document.getElementById('backToMenuFromSetup');

const draw = document.getElementById('draw');
const drawPlayerName = document.getElementById('drawPlayerName');
const cardSlots = document.getElementById('cardSlots');
const drawBtn = document.getElementById('drawBtn');
const drawNextBtn = document.getElementById('drawNextBtn');
const backToMenuFromDraw = document.getElementById('backToMenuFromDraw');

const game = document.getElementById('game');
const currentPlayerName = document.getElementById('currentPlayerName');
const totalValue = document.getElementById('totalValue');
const controls = document.getElementById('controls');
const numButtons = document.querySelectorAll('.num-btn');
const dropPanel = document.getElementById('dropPanel');
const handCards = document.getElementById('handCards');
const playerCardCounts = document.getElementById('playerCardCounts');
const toMenuBtn = document.getElementById('toMenuBtn');

const result = document.getElementById('result');
const resultText = document.getElementById('resultText');
const resultToMenu = document.getElementById('resultToMenu');

let mode = 'normal'; // or 'item'
let players = []; // {name, hand: [cardObj], id}
let order = []; // array of player indices referencing players
let currentIndex = 0;
let total = 0;
let direction = 1; // 1 or -1
let skipNext = false;
let activePoison = []; // array of {turnsLeft, value}
let cardDeck = []; // for drawing (we will sample with replacement)
let distributingIndex = 0; // during item distribution

// utilities
function $(id){ return document.getElementById(id) }
function showScreen(el){
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
}
function randInt(max){ return Math.floor(Math.random()*max) }
function shuffleArray(a){
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
}

// reset game state
function resetState(){
  players = [];
  order = [];
  currentIndex = 0;
  total = 0;
  direction = 1;
  skipNext = false;
  activePoison = [];
  cardDeck = [...ITEM_CARDS]; // not strictly limited
  distributingIndex = 0;
  updateUI();
}

// update UI elements that are global
function updateUI(){
  totalValue.textContent = total;
  // player list
  playerList.innerHTML = '';
  players.forEach((p,i)=>{
    const div = document.createElement('div');
    div.className = 'player-card';
    div.innerHTML = `<div class="pname">${i+1}. ${escapeHtml(p.name)}</div>
                     <button class="delete" data-i="${i}">✕</button>`;
    playerList.appendChild(div);
  });
  // shuffle preview
  shufflePreview.textContent = order.length ? ('順番: ' + order.map(i => players[i].name).join(' → ')) : '';
  // counts
  playerCardCounts.innerHTML = '';
  if(players.length){
    players.forEach((p,i)=>{
      const span = document.createElement('span');
      span.className = 'count';
      span.textContent = `${p.name}: ${p.hand.length}枚`;
      playerCardCounts.appendChild(span);
    });
  }
}

// escape html
function escapeHtml(s){ return s.replace(/[&<>"']/g, function(m){return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])}) }

// --- menu actions ---
normalModeBtn.addEventListener('click', ()=>{
  mode = 'normal';
  modeLabel.textContent = 'ノーマル';
  showScreen(setup);
  resetState();
});

itemModeBtn.addEventListener('click', ()=>{
  mode = 'item';
  modeLabel.textContent = 'アイテム';
  showScreen(setup);
  resetState();
});

// add player
addPlayerBtn.addEventListener('click', ()=>{
  const name = playerNameInput.value.trim() || `Player${players.length+1}`;
  players.push({ name, hand: [], id: Date.now()+Math.random() });
  playerNameInput.value = '';
  updateUI();
});
playerNameInput.addEventListener('keydown', (e)=>{ if(e.key === 'Enter') addPlayerBtn.click(); });

// delete player
playerList.addEventListener('click', (e)=>{
  if(e.target.matches('.delete')){
    const i = Number(e.target.dataset.i);
    players.splice(i,1);
    updateUI();
  }
});

// back to menu
backToMenuFromSetup.addEventListener('click', ()=>{
  showScreen(menu);
});

// shuffle / decide order
shuffleBtn.addEventListener('click', ()=>{
  if(players.length < 2){
    alert('プレイヤーは2人以上推奨ですが、続行する場合はOKを押してください。');
    // allow proceed
  }
  order = players.map((_,i)=>i);
  // show shuffle animation: do several shuffles with timeout
  shufflePreview.textContent = '順番をシャッフル中...';
  let steps = 10;
  let step = 0;
  const iv = setInterval(()=>{
    shuffleArray(order);
    shufflePreview.textContent = '順番: ' + order.map(i => players[i].name).join(' → ');
    step++;
    if(step>=steps){
      clearInterval(iv);
      startBtn.classList.remove('hidden');
      if(mode==='item'){
        nextBtn.classList.remove('hidden');
        startBtn.classList.add('hidden');
      } else {
        nextBtn.classList.add('hidden');
      }
    }
  }, 120);
});

// start button for normal mode
startBtn.addEventListener('click', ()=>{
  // prepare state
  currentIndex = 0;
  total = 0;
  direction = 1;
  skipNext = false;
  activePoison = [];
  showScreen(game);
  updateGameUI();
});

// next button for item mode (go to distribution sequence)
nextBtn.addEventListener('click', ()=>{
  // begin distribution flow
  distributingIndex = 0;
  showDrawForCurrentDistributor();
});

// go back to menu from draw
backToMenuFromDraw.addEventListener('click', ()=>{
  showScreen(menu);
});

// draw screen controls
drawBtn.addEventListener('click', ()=>{
  // produce 3 random cards (with replacement)
  cardSlots.innerHTML = '';
  for(let i=0;i<3;i++){
    const card = randomCard();
    const el = renderGachaCard(card);
    cardSlots.appendChild(el);
    // animate
    setTimeout(()=>el.classList.add('show'), 80*i);
  }
  drawBtn.classList.add('hidden');
  drawNextBtn.classList.remove('hidden');
});

drawNextBtn.addEventListener('click', ()=>{
  // give these displayed cards to the distributing player, but store face-down
  const cards = Array.from(cardSlots.children).map(c => c.dataset.cardId).map(id => {
    // find template CARD
    const template = ITEM_CARDS.find(x => x.id === id);
    return Object.assign({}, template); // copy
  });
  const playerIdx = order[distributingIndex];
  players[playerIdx].hand.push(...cards);
  // clear display
  cardSlots.innerHTML = '';
  drawBtn.classList.remove('hidden');
  drawNextBtn.classList.add('hidden');
  distributingIndex++;
  if(distributingIndex < order.length){
    showDrawForCurrentDistributor();
  } else {
    // all done -> show start
    showScreen(setup);
    startBtn.classList.remove('hidden');
    nextBtn.classList.add('hidden');
    shufflePreview.textContent = 'カード配布が完了しました。スタートしてください。';
    updateUI();
  }
});

// --- helper: show draw screen for current distributing player ---
function showDrawForCurrentDistributor(){
  const playerIdx = order[distributingIndex];
  const player = players[playerIdx];
  drawPlayerName.textContent = player.name;
  cardSlots.innerHTML = '';
  drawBtn.classList.remove('hidden');
  drawNextBtn.classList.add('hidden');
  showScreen(draw);
}

// --- game screen logic ---
function updateGameUI(){
  // set current player
  if(order.length === 0){
    currentPlayerName.textContent = '-';
  } else {
    currentPlayerName.textContent = players[order[currentIndex]].name;
  }
  totalValue.textContent = total;
  // update hand area: show only current player's hand (others hidden)
  handCards.innerHTML = '';
  if(order.length){
    const p = players[order[currentIndex]];
    p.hand.forEach((card, idx)=>{
      const el = document.createElement('div');
      el.className = 'card small face-down';
      el.draggable = true;
      el.dataset.playerId = p.id;
      el.dataset.cardIndex = idx;
      el.dataset.cardId = card.id;
      el.textContent = card.label;
      // face-down by default
      el.addEventListener('click', (ev)=>{
        // toggle face
        if(el.classList.contains('face-down')){
          el.classList.remove('face-down');
        } else {
          el.classList.add('face-down');
        }
      });
      // drag start
      el.addEventListener('dragstart', (ev)=>{
        // only allow dragging if face-up
        if(el.classList.contains('face-down')){
          ev.preventDefault();
          return;
        }
        ev.dataTransfer.setData('text/plain', JSON.stringify({
          ownerId: p.id,
          cardIndex: idx,
          cardId: card.id
        }));
      });
      handCards.appendChild(el);
    });
  }
  // player card counts
  updateUI();
}

// drop panel events
dropPanel.addEventListener('dragover', (e)=>{
  e.preventDefault();
  dropPanel.style.borderColor = '#6ee7b7';
});
dropPanel.addEventListener('dragleave', (e)=>{
  dropPanel.style.borderColor = 'rgba(255,255,255,0.06)';
});
dropPanel.addEventListener('drop', (e)=>{
  e.preventDefault();
  dropPanel.style.borderColor = 'rgba(255,255,255,0.06)';
  const data = e.dataTransfer.getData('text/plain');
  if(!data) return;
  let parsed;
  try { parsed = JSON.parse(data); } catch(err){ return; }
  // validate owner is current player
  const currentPlayer = players[order[currentIndex]];
  if(parsed.ownerId !== currentPlayer.id){
    alert('これはあなたのカードではありません。あなたのカードだけ使えます。');
    return;
  }
  // use card
  const idx = Number(parsed.cardIndex);
  const card = currentPlayer.hand[idx];
  if(!card){ alert('カードが見つかりません'); return; }
  applyCardEffect(card, currentPlayer, idx);
  // update UI & advance turn
  updateGameUI();
  checkEndConditionAfterMove();
});

// numeric buttons
numButtons.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const v = Number(btn.dataset.val);
    takeNumericTurn(v);
  });
});

// take numeric turn (1/2/3)
function takeNumericTurn(val){
  const player = players[order[currentIndex]];
  // compute poison addition
  const poisonAdd = activePoison.reduce((s,p)=>s + (p.value||0), 0);
  total += val + poisonAdd;
  // after applying, decrement poison durations
  activePoison.forEach(p=>p.turnsLeft--);
  activePoison = activePoison.filter(p=>p.turnsLeft > 0);
  // advance turn normally (or handle skip)
  if(checkLose(player)) return;
  advanceTurnAfterAction();
  updateGameUI();
}

// apply card effect when used
function applyCardEffect(card, playerObj, cardIndex){
  // remove card from player's hand
  playerObj.hand.splice(cardIndex,1);
  switch(card.type){
    case 'add':
      total += card.value;
      break;
    case 'reverse':
      direction *= -1;
      break;
    case 'skip':
      skipNext = true;
      break;
    case 'poison':
      // add poison that will affect the next 5 turns with +5
      activePoison.push({ turnsLeft: 5, value: 5 });
      break;
    default:
      console.warn('unknown card', card);
  }
  // using an item consumes the turn -> advance
  // after applying, decrement poison? The poison should start affecting following turns; not decrement now.
  checkEndConditionAfterMove();
  advanceTurnAfterAction();
}

// check losing
function checkLose(player){
  if(total > 100){
    // the player who caused total exceed loses
    showResult(`${player.name} が合計を ${total} にしてしまった。負け！`);
    return true;
  }
  return false;
}

// after move: check and advance
function checkEndConditionAfterMove(){
  if(total > 100){
    // someone lost already handled above; ensure UI updated
    updateGameUI();
  }
}

// advance turn logic
function advanceTurnAfterAction(){
  if(order.length <= 1) return;
  // handle skip flag
  let step = direction;
  if(skipNext){
    // skip one player
    step = direction * 2;
    skipNext = false;
  }
  currentIndex = (currentIndex + step + order.length) % order.length;
}

// show result
function showResult(text){
  resultText.textContent = text;
  showScreen(result);
}

// menu from game
toMenuBtn.addEventListener('click', ()=>{
  showScreen(menu);
});

// result to menu
resultToMenu.addEventListener('click', ()=>{
  showScreen(menu);
});

// start button used after card distribution as well
startBtn.addEventListener('click', ()=>{
  currentIndex = 0;
  total = 0;
  direction = 1;
  skipNext = false;
  activePoison = [];
  showScreen(game);
  updateGameUI();
});

// utility: random card pick
function randomCard(){
  const idx = Math.floor(Math.random()*ITEM_CARDS.length);
  return Object.assign({}, ITEM_CARDS[idx]);
}

// render gacha card element
function renderGachaCard(card){
  const el = document.createElement('div');
  el.className = 'gacha-card';
  el.textContent = card.label;
  el.dataset.cardId = card.id;
  return el;
}

// initial setup
resetState();
showScreen(menu);

/* --- Notes & UX details implemented:
 - Players' hands are private: hand area displays only the current player's cards.
 - Cards are added face-down; clicking toggles face-up/face-down.
 - Drag & drop: only face-up cards can be dragged (enforced by preventing drag when face-down).
 - Drop panel accepts card and immediately applies effect; consumed cards are removed.
 - Poison: when used, it creates entries in activePoison; on next numeric moves the poison effects apply (added to chosen number).
 - Reverse toggles play direction variable.
 - Skip sets skipNext and causes next player's turn to be skipped.
 - Player order is an array of indices referencing players; shuffle randomizes it and shows preview.
 - Distribution flow: for each player in order, draw 3 cards visible only to that player (gacha animation). After clicking "引けた → 次へ", cards become part of that player's hand (kept face-down).
*/
