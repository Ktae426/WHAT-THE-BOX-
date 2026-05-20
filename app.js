import { handleAuthSignIn, handleAuthSignUp, createGameRoom, submitJoinRoomCode, leaveRoomLobby, requestStartGame } from './network.js';
import { buyItem, openThanosPopup, closeThanosPopup, executeThanosSnap, exitGameOverToLobby } from './game-engine.js';

// 글로벌 상태 객체 (단 한 번만 선언)
export const gameState = {
    loggedInUser: null,
    playerNickname: "플레이어",
    currentRoomId: null,
    currentRoomCode: null,
    roomChannel: null,
    isHost: false,
    mySlotIndex: -1,
    totalRoomPlayers: [],
    gameStarted: false,
    gameTime: 120,
    timerInterval: null,
    userCredits: 0,
    ownedSkins: { basic: true, safari: false, chef: false, hero: false },
    equippedSkin: "basic"
};

// 유저 데이터 캐싱 로드
export async function loadUserData() {
    if (!gameState.loggedInUser) return;
    try {
        const { data: profile, error } = await window.supabaseClient.from('user_profiles').select('*').eq('id', gameState.loggedInUser.id).single();
        if (error || !profile) {
            gameState.playerNickname = "플레이어";
            gameState.userCredits = 0;
            gameState.ownedSkins = { basic: true };
        } else {
            gameState.userCredits = profile.credits ?? 0;
            gameState.ownedSkins = profile.owned_skins ?? { basic: true };
            gameState.playerNickname = profile.nickname || "플레이어";
        }
        document.getElementById('popup-credit-txt').innerText = gameState.userCredits;
    } catch (e) {
        console.error(e);
    }
}

// DOM 콘텐츠가 전부 준비된 직후 window 객체에 이벤트 매핑 강제 주입
window.handleSignUp = handleAuthSignUp;
window.handleSignIn = handleAuthSignIn;

window.toggleAuthMode = function(isSignUpMode) {
    const title = document.getElementById('auth-title');
    const nickInput = document.getElementById('auth-nickname');
    const signinBtn = document.getElementById('btn-signin-submit');
    const signupBtn = document.getElementById('btn-signup-submit');
    const toggleContainer = document.getElementById('auth-toggle-container');
    const errorMsg = document.getElementById('auth-error-msg');
    
    errorMsg.innerText = "";
    errorMsg.style.display = "none";

    if (isSignUpMode) {
        title.innerText = "회원가입"; nickInput.style.display = "block"; signinBtn.style.display = "none"; signupBtn.style.display = "block";
        toggleContainer.innerHTML = `이미 계정이 있으신가요?<span class="auth-toggle-link" onclick="window.toggleAuthMode(false)">로그인하기</span>`;
    } else {
        title.innerText = "WHAT THE BOX!"; nickInput.style.display = "none"; signinBtn.style.display = "block"; signupBtn.style.display = "none";
        toggleContainer.innerHTML = `계정이 없으신가요?<span class="auth-toggle-link" onclick="window.toggleAuthMode(true)">회원가입하기</span>`;
    }
};

window.showLobbyOptions = function() {
    document.getElementById('lobby-main-menu').style.display = "none";
    document.getElementById('lobby-mode-panel').style.display = "flex";
};

window.openJoinCodePopup = function() {
    document.getElementById('lobby-mode-panel').style.display = "none";
    document.getElementById('join-code-popup').style.display = "block";
    const codeInput = document.getElementById('input-room-code');
    codeInput.value = "";
    document.getElementById('input-code-mirror').innerText = "____";
    codeInput.focus();
};

window.closeJoinCodePopup = function() {
    document.getElementById('join-code-popup').style.display = "none";
    document.getElementById('lobby-mode-panel').style.display = "flex";
};

window.openSkinShop = function() { document.getElementById("skin-shop-popup").style.display = "block"; };
window.closeSkinShop = function() { document.getElementById("skin-shop-popup").style.display = "none"; };
window.purchaseSkin = function(skinId) { alert(skinId + " 스킨 기능 개발 중입니다!"); };

window.createRoom = createGameRoom;
window.submitJoinRoomCode = submitJoinRoomCode;
window.leaveRoom = leaveRoomLobby;
window.requestStartGame = requestStartGame;

window.buyItem = buyItem;
window.executeThanosSnap = executeThanosSnap;
window.closeThanosPopup = closeThanosPopup;
window.exitGameOverToLobby = exitGameOverToLobby;

// 키보드 엔터 인증 인터럽트 리스너
const triggerAuthOnEnter = (e) => {
    if (e.key === 'Enter') {
        const isSignUpMode = document.getElementById('btn-signup-submit').style.display === "block";
        if (isSignUpMode) window.handleSignUp();
        else window.handleSignIn();
    }
};
document.getElementById('auth-email').addEventListener('keydown', triggerAuthOnEnter);
document.getElementById('auth-password').addEventListener('keydown', triggerAuthOnEnter);
document.getElementById('auth-nickname').addEventListener('keydown', triggerAuthOnEnter);

// 자릿수 미러링 렌더러
document.getElementById('input-room-code').addEventListener('input', function(e) {
    let val = e.target.value.replace(/[^0-9]/g, '');
    e.target.value = val;
    let displayStr = "";
    for (let i = 0; i < 4; i++) {
        displayStr += (i < val.length) ? val[i] : "_";
    }
    document.getElementById('input-code-mirror').innerText = displayStr;
});