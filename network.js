import { gameState, loadUserData } from './app.js';
import { initActiveMatchEntities, playersEntities, pileBoxMat, handleGameEndSequence, renderTimerText, handleRemoteItemTrigger } from './game-engine.js';
import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';

const SUPABASE_URL = "https://djcxkcuylpfvpsclxlma.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqY3hrY3V5bHBmdnBzY2x4bG1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTM0MzgsImV4cCI6MjA5NDY4OTQzOH0.PVhhYl5kKP38DIPqk3LUI3dtcXLqmvykJPgkga5GrKw";

// Supabase 클라이언트 초기화 및 전역 등록
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.supabaseClient = supabaseClient;

// 회원 가입 API 로직
export async function handleAuthSignUp() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const nickname = document.getElementById('auth-nickname').value;
    const errorMsg = document.getElementById('auth-error-msg');
    
    errorMsg.innerText = ""; errorMsg.style.display = "none";
    if (!email || !password || !nickname) { errorMsg.innerText = "모든 항목을 입력해 주세요."; errorMsg.style.display = "block"; return; }
    if (password.length < 6) { errorMsg.innerText = "비밀번호는 6자리 이상이어야 합니다."; errorMsg.style.display = "block"; return; }

    try {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) { errorMsg.innerText = "회원가입 실패: " + error.message; errorMsg.style.display = "block"; return; }
        if (data.user) {
            await supabaseClient.from('user_profiles').insert([{ id: data.user.id, nickname: nickname, credits: 0, owned_skins: { basic: true } }]);
        }
        errorMsg.innerText = "회원가입 완료! 로그인을 진행해 주세요."; errorMsg.style.color = "#22c55e"; errorMsg.style.display = "block";
        setTimeout(() => { errorMsg.style.color = "#ef4444"; window.toggleAuthMode(false); }, 1500);
    } catch(e) {
        errorMsg.innerText = "오류 발생: " + e.message; errorMsg.style.display = "block";
    }
}

// 로그인 세션 체결 엔진
export async function handleAuthSignIn() {
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const errorMsg = document.getElementById('auth-error-msg');
    
    errorMsg.innerText = ""; errorMsg.style.display = "none";
    if (!email || !password) { errorMsg.innerText = "이메일과 비밀번호를 입력해 주세요."; errorMsg.style.display = "block"; return; }
    
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { errorMsg.innerText = "로그인 실패: 이메일 또는 비밀번호가 일치하지 않습니다."; errorMsg.style.display = "block"; return; }
        
        gameState.loggedInUser = data.user;
        await loadUserData();

        document.getElementById('auth-screen').style.opacity = "0";
        setTimeout(() => {
            document.getElementById('auth-screen').style.display = "none";
            document.getElementById('start-screen').style.display = "flex";
        }, 400);
    } catch(e) {
        errorMsg.innerText = "네트워크 오류: " + e.message; errorMsg.style.display = "block";
    }
}

// 매치 메이킹: 방 개설 프로시저
export async function createGameRoom() {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const { data, error } = await supabaseClient.from('game_rooms').insert([
        { room_code: code, players: [], is_started: false, created_at: new Date() }
    ]).select().single();
    if (error) { alert("방 생성 실패"); return; }
    gameState.currentRoomId = data.id; gameState.currentRoomCode = code; gameState.isHost = true;
    setupRoomLobbyUI(code, []); subscribeRoomPresence();
}

// 매치 메이킹: 방 참가 프로시저
export async function submitJoinRoomCode() {
    const code = document.getElementById('input-room-code').value.trim();
    if (code.length !== 4) { alert("4자리 숫자를 입력해주세요."); return; }
    const { data: room, error } = await supabaseClient.from('game_rooms').select('*').eq('room_code', code).eq('is_started', false).single();
    if (error || !room) { alert("존재하지 않거나 이미 시작된 방입니다."); return; }
    gameState.currentRoomId = room.id; gameState.currentRoomCode = code; gameState.isHost = false;
    document.getElementById('join-code-popup').style.display = "none";
    setupRoomLobbyUI(code, []); subscribeRoomPresence();
}

// 대기실 퇴장 메커니즘
export async function leaveRoomLobby() {
    if (gameState.roomChannel) { gameState.roomChannel.unsubscribe(); gameState.roomChannel = null; }
    if (gameState.isHost && gameState.currentRoomId) { await supabaseClient.from('game_rooms').delete().eq('id', gameState.currentRoomId); }
    gameState.currentRoomId = null; gameState.currentRoomCode = null; gameState.isHost = false;
    document.getElementById('lobby-room-view').style.display = "none";
    document.getElementById('lobby-mode-panel').style.display = "flex";
}

// 방 코드 대기실 UI 동기화 모듈
export function setupRoomLobbyUI(code, syncedPlayers) {
    document.getElementById('lobby-mode-panel').style.display = "none";
    document.getElementById('lobby-room-view').style.display = "flex";
    document.getElementById('txt-room-code').innerText = code;
    document.getElementById('txt-player-count-header').innerText = `대기 중인 플레이어 (${syncedPlayers.length}/4)`;

    const container = document.getElementById('ui-player-list'); container.innerHTML = "";
    const teamNames = ["Red", "Blue", "Yellow", "Green"];
    syncedPlayers.forEach((p, idx) => {
        container.innerHTML += `<div class="player-slot-ui rank-${idx}"><span>● ${p.nickname}</span><span>[${teamNames[idx]} 팀]</span></div>`;
    });

    const startBtn = document.getElementById('btn-match-start');
    if (gameState.isHost) {
        if (syncedPlayers.length === 4) { startBtn.className = "ready"; startBtn.disabled = false; }
        else { startBtn.className = ""; startBtn.disabled = true; }
    } else { startBtn.className = ""; startBtn.disabled = true; }
}

// 실시간 Presence 및 Broadcast 이벤트 바인딩 드라이버
export function subscribeRoomPresence() {
    if (gameState.roomChannel) { supabaseClient.removeChannel(gameState.roomChannel); }
    gameState.roomChannel = supabaseClient.channel(`room_${gameState.currentRoomId}`, { config: { presence: { key: gameState.loggedInUser.id } } });

    gameState.roomChannel
    .on('presence', { event: 'sync' }, () => {
        const presenceState = gameState.roomChannel.presenceState(); const syncedPlayers = [];
        Object.keys(presenceState).forEach((key) => {
            const userPresence = presenceState[key][0];
            if (userPresence) syncedPlayers.push({ id: key, nickname: userPresence.nickname, joinedAt: userPresence.joinedAt });
        });
        syncedPlayers.sort((a, b) => a.joinedAt - b.joinedAt);
        gameState.totalRoomPlayers = syncedPlayers;
        const myIndex = syncedPlayers.findIndex(p => p.id === gameState.loggedInUser.id);
        if (myIndex !== -1) gameState.mySlotIndex = myIndex;
        if (!gameState.gameStarted) setupRoomLobbyUI(gameState.currentRoomCode, syncedPlayers);
    })
    .on('broadcast', { event: 'game_start' }, (payload) => { initActiveMatchEntities(payload.payload.players); })
    .on('broadcast', { event: 'player_move' }, (payload) => {
        if (!gameState.gameStarted) return; const data = payload.payload;
        const targetPlayer = playersEntities.find(p => p.id === data.id);
        if (targetPlayer && data.id !== gameState.loggedInUser.id) {
            targetPlayer.model.root.position.set(data.x, data.y, data.z); targetPlayer.model.root.rotation.y = data.rotY;
            if (data.isCarrying && !targetPlayer.isCarrying) {
                targetPlayer.isCarrying = true; targetPlayer.boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), pileBoxMat);
                targetPlayer.boxMesh.position.set(0, 2.1, 0); targetPlayer.model.root.add(targetPlayer.boxMesh); targetPlayer.model.torso.scale.set(1.2, 0.7, 1.2);
            } else if (!data.isCarrying && targetPlayer.isCarrying) {
                targetPlayer.isCarrying = false; if (targetPlayer.boxMesh) targetPlayer.model.root.remove(targetPlayer.boxMesh); targetPlayer.model.torso.scale.set(1, 1, 1);
            }
        }
    })
    .on('broadcast', { event: 'score_update' }, (payload) => {
        const data = payload.payload; const targetPlayer = playersEntities.find(p => p.slot === data.slot);
        if (targetPlayer) { targetPlayer.score = data.score; const el = document.getElementById(`score-slot-${data.slot}`); if (el) el.innerText = data.score; }
    })
    .on('broadcast', { event: 'time_sync' }, (payload) => { if (gameState.gameStarted && !gameState.isHost) { gameState.gameTime = payload.payload.time; renderTimerText(); } })
    .on('broadcast', { event: 'trigger_item_effect' }, (payload) => { handleRemoteItemTrigger(payload.payload); })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'game_rooms', filter: `id=eq.${gameState.currentRoomId}` }, () => {
        if (gameState.gameStarted) handleGameEndSequence(true);
        else { alert("방장이 퇴장하여 방이 해체되었습니다."); window.leaveRoom(); }
    })
    .subscribe(async (status) => { if (status === 'SUBSCRIBED') { await gameState.roomChannel.track({ nickname: gameState.playerNickname, joinedAt: Date.now() }); } });
}

export async function requestStartGame() {
    if (!gameState.isHost || !gameState.roomChannel) return;
    if (gameState.totalRoomPlayers.length !== 4) { alert("플레이어 4명이 모두 모여야 시작할 수 있습니다!"); return; }
    await supabaseClient.from('game_rooms').update({ is_started: true }).eq('id', gameState.currentRoomId);
    gameState.roomChannel.send({ type: 'broadcast', event: 'game_start', payload: { players: gameState.totalRoomPlayers } });
    initActiveMatchEntities(gameState.totalRoomPlayers);
}

export function broadcastMyLocation() {
    const myEnt = playersEntities[gameState.mySlotIndex]; if (!myEnt || !gameState.roomChannel) return;
    gameState.roomChannel.send({
        type: 'broadcast', event: 'player_move',
        payload: { id: gameState.loggedInUser.id, slot: gameState.mySlotIndex, x: myEnt.model.root.position.x, y: myEnt.model.root.position.y, z: myEnt.model.root.position.z, rotY: myEnt.model.root.rotation.y, isCarrying: myEnt.isCarrying }
    });
}

export function sendScoreUpdate(slotIndex, currentScore) {
    if (gameState.roomChannel) gameState.roomChannel.send({ type: 'broadcast', event: 'score_update', payload: { slot: slotIndex, score: currentScore } });
}

export function sendItemTrigger(payloadData) {
    if (gameState.roomChannel) gameState.roomChannel.send({ type: 'broadcast', event: 'trigger_item_effect', payload: payloadData });
}