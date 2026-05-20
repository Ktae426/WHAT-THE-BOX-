import { handleAuthSignIn, handleAuthSignUp, createGameRoom, submitJoinRoomCode, leaveRoomLobby, requestStartGame, supabaseClient } from './network.js';
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
        const { data: profile, error } = await supabaseClient.from('user_profiles').select('*').eq('id', gameState.loggedInUser.id).single();
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

// UI 전환 로직 (회원가입 <-> 로그인)
function toggleAuthMode(isSignUpMode) {
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
        toggleContainer.innerHTML = `이미 계정이 있으신가요?<span class="auth-toggle-link" id="link-to-signin">로그인하기</span>`;
        document.getElementById('link-to-signin').addEventListener('click', () => toggleAuthMode(false));
    } else {
        title.innerText = "WHAT THE BOX!"; nickInput.style.display = "none"; signinBtn.style.display = "block"; signupBtn.style.display = "none";
        toggleContainer.innerHTML = `계정이 없으신가요?<span class="auth-toggle-link" id="link-to-signup">회원가입하기</span>`;
        document.getElementById('link-to-signup').addEventListener('click', () => toggleAuthMode(true));
    }
}

// 💡 이벤트 리스너 등록 (onclick 대체 완료)
document.addEventListener('DOMContentLoaded', () => {
    // 인증 관련 이벤트
    document.getElementById('btn-signin-submit').addEventListener('click', handleAuthSignIn);
    document.getElementById('btn-signup-submit').addEventListener('click', handleAuthSignUp);
    
    const initialSignupLink = document.getElementById('link-to-signup');
    if (initialSignupLink) {
        initialSignupLink.addEventListener('click', () => toggleAuthMode(true));
    }

    // 로비 메인 메뉴 관련 이벤트
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('lobby-main-menu').style.display = "none";
        document.getElementById('lobby-mode-panel').style.display = "flex";
    });

    document.getElementById('btn-create-panel').addEventListener('click', createGameRoom);
    
    document.getElementById('btn-join-panel').addEventListener('click', () => {
        document.getElementById('lobby-mode-panel').style.display = "none";
        document.getElementById('join-code-popup').style.display = "block";
        const codeInput = document.getElementById('input-room-code');
        codeInput.value = "";
        document.getElementById('input-code-mirror').innerText = "____";
        codeInput.focus();
    });

    document.getElementById('btn-code-cancel').addEventListener('click', () => {
        document.getElementById('join-code-popup').style.display = "none";
        document.getElementById('lobby-mode-panel').style.display = "flex";
    });

    document.getElementById('btn-code-confirm').addEventListener('click', submitJoinRoomCode);
    document.getElementById('btn-leave-room').addEventListener('click', leaveRoomLobby);
    document.getElementById('btn-match-start').addEventListener('click', requestStartGame);

    // 상점 및 기타 팝업 이벤트
    document.getElementById('shop-open-btn').addEventListener('click', () => {
        document.getElementById("skin-shop-popup").style.display = "block";
    });
    document.getElementById('shop-close-btn').addEventListener('click', () => {
        document.getElementById("skin-shop-popup").style.display = "none";
    });

    // 스킨 구매 버튼 이벤트 예시 등록
    ['safari', 'chef', 'hero'].forEach(skinId => {
        const btn = document.getElementById(`btn-skin-${skinId}`);
        if (btn) {
            btn.addEventListener('click', () => alert(skinId + " 스킨 기능 개발 중입니다!"));
        }
    });

    // 인게임 HUD 및 아이템 상점 이벤트
    document.getElementById('btn-banana').addEventListener('click', () => buyItem('banana', 10));
    document.getElementById('btn-powerup').addEventListener('click', () => buyItem('powerup', 30));
    document.getElementById('btn-magnet').addEventListener('click', () => buyItem('magnet', 50));
    document.getElementById('btn-ice').addEventListener('click', () => buyItem('ice', 70));
    document.getElementById('btn-thanos').addEventListener('click', openThanosPopup);
    document.getElementById('btn-thanos-cancel').addEventListener('click', closeThanosPopup);
    document.getElementById('btn-end-exit').addEventListener('click', exitGameOverToLobby);
});

// 키보드 엔터 인증 인터럽트 리스너
const triggerAuthOnEnter = (e) => {
    if (e.key === 'Enter') {
        const isSignUpMode = document.getElementById('btn-signup-submit').style.display === "block";
        if (isSignUpMode) handleAuthSignUp();
        else handleAuthSignIn();
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

// 글로벌 스코프 노출 제거 처리 완료
