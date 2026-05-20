import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { gameState } from './app.js';
import { supabaseClient, broadcastMyLocation, sendScoreUpdate, sendItemTrigger, subscribeRoomPresence } from './network.js';

// 엔진 코어 인스턴스 전역 정의
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 39, 32); camera.lookAt(0, -3.5, 0);

export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// 조명 리소스 빌드
const ambientLight = new THREE.AmbientLight(0xffffff, 0.85); scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.8); dirLight.position.set(18, 40, 18); dirLight.castShadow = true; scene.add(dirLight);

// 경기장 맵 파라미터 세팅
export const mapSize = 40;
export const zoneSize = 6;
export const offset = mapSize / 2 - zoneSize / 2;
const floorGeo = new THREE.BoxGeometry(mapSize, 0.2, mapSize);
const floorMat = new THREE.MeshStandardMaterial({ color: 0xba967d, roughness: 0.45 });
const floor = new THREE.Mesh(floorGeo, floorMat); floor.receiveShadow = true; scene.add(floor);

export const zoneFrames = [];
export const zonePositions = [
    { x: -offset, z: -offset, color: 0xef4444 },
    { x: offset, z: -offset, color: 0x1e4ed8 },
    { x: -offset, z: offset, color: 0xf59e0b },
    { x: offset, z: offset, color: 0x056517 }
];

export const teamColors = [0xef4444, 0x1e4ed8, 0xf59e0b, 0x056517];
export const teamNames = ["Red", "Blue", "Yellow", "Green"];

function createNeonZone(colorHex, posX, posZ) {
    const zoneGeo = new THREE.BoxGeometry(zoneSize, 0.21, zoneSize);
    const zoneMat = new THREE.MeshStandardMaterial({ color: colorHex, transparent: true, opacity: 0.25, emissive: colorHex, emissiveIntensity: 0.6 });
    const zone = new THREE.Mesh(zoneGeo, zoneMat); zone.position.set(posX, 0, posZ); scene.add(zone);
    const frameGroup = new THREE.Group(); frameGroup.position.set(posX, 0.15, posZ);
    const barMat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 2.2 });
    const barH = new THREE.Mesh(new THREE.BoxGeometry(zoneSize, 0.22, 0.22), barMat); barH.position.set(0, 0, zoneSize/2); frameGroup.add(barH);
    scene.add(frameGroup); zoneFrames.push(frameGroup);
}
zonePositions.forEach(z => createNeonZone(z.color, z.x, z.z));

export const pileBoxMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.5 });
function createCenterBoxPile() {
    const boxPositions = [];
    for (let i = 0; i < 24; i++) { let ang = (Math.PI * 2 / 24) * i; let rad = 0.5 + Math.random() * 2.2; boxPositions.push({ x: Math.cos(ang) * rad, y: 0.5, z: Math.sin(ang) * rad }); }
    for (let i = 0; i < 16; i++) { let ang = (Math.PI * 2 / 16) * i; let rad = 0.3 + Math.random() * 1.4; boxPositions.push({ x: Math.cos(ang) * rad, y: 1.4, z: Math.sin(ang) * rad }); }
    for (let i = 0; i < 9; i++) { let ang = (Math.PI * 2 / 9) * i; let rad = 0.2 + Math.random() * 0.7; boxPositions.push({ x: Math.cos(ang) * rad, y: 2.3, z: Math.sin(ang) * rad }); }
    boxPositions.push({ x: 0, y: 3.2, z: 0 }, { x: -0.2, y: 3.2, z: 0.3 }, { x: 0.3, y: 4.1, z: -0.1 });
    boxPositions.forEach(pos => {
        const s = 1.0 + Math.random() * 0.4;
        const pileMesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), pileBoxMat);
        pileMesh.rotation.set(Math.random() * 0.4 - 0.2, Math.random() * 3.14, Math.random() * 0.4 - 0.2);
        pileMesh.position.set(pos.x, pos.y * (s * 0.9), pos.z); pileMesh.castShadow = true; pileMesh.receiveShadow = true; scene.add(pileMesh);
    });
}
createCenterBoxPile();

// 엔티티 모델 생성을 위한 팩토리 메서드 집합
export function createHumanModel(colorHex) {
    const group = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.5), new THREE.MeshStandardMaterial({ color: colorHex })); torso.position.y = 0.8; group.add(torso);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.65, 0.65), new THREE.MeshStandardMaterial({ color: 0xffdbac })); head.position.y = 1.5; group.add(head);
    const accessoryGroup = new THREE.Group(); group.add(accessoryGroup);
    const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.2), new THREE.MeshStandardMaterial({ color: colorHex })); rArm.position.set(-0.45, 0.8, 0); group.add(rArm);
    const lArm = rArm.clone(); lArm.position.x = 0.45; group.add(lArm);
    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.25), new THREE.MeshStandardMaterial({ color: colorHex })); rLeg.position.set(-0.2, 0.2, 0); group.add(rLeg);
    const lLeg = rLeg.clone(); lLeg.position.x = 0.2; group.add(lLeg);
    return { root: group, rArm, lArm, rLeg, lLeg, torso, head, accessoryGroup };
}

export function createFancyBananaShellMesh() {
    const bananaGroup = new THREE.Group(); const yellowMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.2, side: THREE.DoubleSide });
    bananaGroup.scale.set(1.8, 1.8, 1.8);
    const coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 6), yellowMat); coreMesh.position.y = 0.15; coreMesh.rotation.x = Math.PI / 2; bananaGroup.add(coreMesh);
    for (let i = 0; i < 4; i++) {
        const peelGroup = new THREE.Group(); peelGroup.rotation.y = (Math.PI / 2) * i;
        const peelBase = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.4), yellowMat); peelBase.position.set(0, 0.02, 0.2); peelGroup.add(peelBase);
        const peelTip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.3), yellowMat); peelTip.position.set(0, 0.01, 0.3); peelTip.rotation.x = -0.2; peelBase.add(peelTip);
        bananaGroup.add(peelGroup);
    }
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.6 });
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 4), stemMat); stem.position.set(0, 0.05, -0.15); stem.rotation.x = 0.4; bananaGroup.add(stem);
    return bananaGroup;
}

// 인게임 전용 내부 상태 변수
export let playersEntities = [];
export const activeBananasInWorld = [];
export let gold = 50;
export let currentItem = null;
export const baseSpeed = 0.11;
export let punchCooldown = false;

// 게임 시작시 인게임 리소스 매핑 처리 함수
export function initActiveMatchEntities(roomPlayers) {
    const myIndex = roomPlayers.findIndex(p => p.id === gameState.loggedInUser.id);
    if (myIndex !== -1) gameState.mySlotIndex = myIndex;

    document.getElementById("start-screen").style.opacity = "0";
    setTimeout(() => {
        document.getElementById("start-screen").style.display = "none";
        document.querySelectorAll(".hud").forEach(el => {
            el.style.display = (el.id === "inventory-hud") ? "flex" : "block";
        });
        
        const scoresUI = document.getElementById("ui-scores-list"); scoresUI.innerHTML = "";
        const spawnPositions = [ new THREE.Vector3(-offset, 0, -offset), new THREE.Vector3(offset, 0, -offset), new THREE.Vector3(-offset, 0, offset), new THREE.Vector3(offset, 0, offset) ];

        playersEntities = roomPlayers.map((p, idx) => {
            const model = createHumanModel(teamColors[idx]); model.root.position.copy(spawnPositions[idx]); scene.add(model.root);
            scoresUI.innerHTML += `<div class="rank-slot rank-${idx}"><span>${p.nickname} (${teamNames[idx]})</span><span id="score-slot-${idx}">0</span></div>`;
            return {
                id: p.id, nickname: p.nickname, slot: idx, model: model, score: 0, isCarrying: false, boxMesh: null, targetZone: spawnPositions[idx],
                isSlipped: false, isFrozen: false, hasPowerup: false, iceMesh: null
            };
        });

        gold = 50; currentItem = null;
        document.getElementById("gold-txt").innerText = gold;
        document.getElementById("inv-slot").innerText = "비어있음";
        gameState.gameStarted = true;
        updateItemShopButtons();
        startTimer();
    }, 400);
}

// 타이머 비즈니스 로직
export function startTimer() {
    gameState.gameTime = 120;
    if (gameState.timerInterval) clearInterval(gameState.timerInterval);
    gameState.timerInterval = setInterval(() => {
        if (!gameState.gameStarted) return;
        if (gameState.isHost) {
            if (gameState.gameTime > 0) {
                gameState.gameTime--;
                if (gameState.roomChannel) {
                    gameState.roomChannel.send({ type: 'broadcast', event: 'time_sync', payload: { time: gameState.gameTime } });
                }
                renderTimerText();
            } else { handleGameEndSequence(); }
        } else {
            if (gameState.gameTime > 0) renderTimerText();
            else handleGameEndSequence();
        }
    }, 1000);
}

export function renderTimerText() {
    const min = String(Math.floor(gameState.gameTime / 60)).padStart(2, '0');
    const sec = String(gameState.gameTime % 60).padStart(2, '0');
    document.getElementById("time-txt").innerText = `${min}:${sec}`;
}

export function handleGameEndSequence(wasAborted = false) {
    clearInterval(gameState.timerInterval);
    gameState.gameStarted = false;
    showGameEnding(wasAborted);
}

function showGameEnding(wasAborted) {
    const container = document.getElementById("result-container"); container.innerHTML = "";
    if (wasAborted) {
        container.innerHTML = `<p style="color:#ef4444; font-weight:bold; font-size:18px;">방장이 도망갔습니다.<br>보상이 지급되지 않습니다.</p>`;
    } else {
        const sorted = [...playersEntities].sort((a, b) => b.score - a.score);
        const ranks = new Array(sorted.length); let currentRank = 1;
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i].score < sorted[i - 1].score) currentRank = i + 1;
            ranks[i] = currentRank;
        }

        const baseRewards = [300, 200, 150, 50]; const finalCredits = new Array(sorted.length).fill(0);
        let i = 0;
        while (i < sorted.length) {
            let j = i; while (j < sorted.length && sorted[j].score === sorted[i].score) { j++; }
            let totalPool = 0; for (let k = i; k < j; k++) { totalPool += baseRewards[k]; }
            const splitCredit = Math.floor(totalPool / (j - i));
            for (let k = i; k < j; k++) { finalCredits[k] = splitCredit; }
            i = j;
        }

        sorted.forEach((p, idx) => {
            const assignedRank = ranks[idx]; const prize = finalCredits[idx];
            if (p.id === gameState.loggedInUser.id) {
                gameState.userCredits += prize;
                supabaseClient.from('user_profiles').update({ credits: gameState.userCredits }).eq('id', gameState.loggedInUser.id);
            }
            container.innerHTML += `<div class="result-item rank-${p.slot}"><span>${assignedRank}등. ${p.nickname} (${p.score}박스)</span><span class="res-gold-badge">+${prize} Credit</span></div>`;
        });
    }
    document.getElementById("game-over-screen").style.display = "block";
}

// 아이템 박스 파트 메커니즘
export function triggerGrabBox() {
    const myEnt = playersEntities[gameState.mySlotIndex];
    if (!myEnt || myEnt.isCarrying) return; myEnt.isCarrying = true;
    myEnt.boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), pileBoxMat);
    myEnt.boxMesh.position.set(0, 2.1, 0); myEnt.model.root.add(myEnt.boxMesh);
    myEnt.model.torso.scale.set(1.2, 0.7, 1.2);
    broadcastMyLocation();
}

export function triggerReleaseBox(isGoal) {
    const myEnt = playersEntities[gameState.mySlotIndex]; if (!myEnt) return;
    myEnt.isCarrying = false;
    if (myEnt.boxMesh) { myEnt.model.root.remove(myEnt.boxMesh); myEnt.boxMesh = null; }
    myEnt.model.torso.scale.set(1, 1, 1);
    if (isGoal) {
        myEnt.score++; gold += 10;
        document.getElementById(`score-slot-${myEnt.slot}`).innerText = myEnt.score;
        sendScoreUpdate(myEnt.slot, myEnt.score);
    }
    updateUI(); broadcastMyLocation();
}

function executePlayerPunch() {
    const myEnt = playersEntities[gameState.mySlotIndex]; if (punchCooldown || !myEnt || myEnt.isSlipped || myEnt.isFrozen) return;
    punchCooldown = true; myEnt.model.rArm.position.z = -0.4; myEnt.model.rArm.scale.set(1, 1, 1.8);
    setTimeout(() => { myEnt.model.rArm.position.z = 0; myEnt.model.rArm.scale.set(1, 1, 1); punchCooldown = false; }, 200);

    playersEntities.forEach((ent, idx) => {
        if (idx === gameState.mySlotIndex) return;
        if (myEnt.model.root.position.distanceTo(ent.model.root.position) < 1.6) {
            if (ent.isCarrying) {
                ent.isCarrying = false; if (ent.boxMesh) ent.model.root.remove(ent.boxMesh); ent.model.torso.scale.set(1,1,1);
                broadcastMyLocation();
            }
        }
    });
}

// 아이템 로직 매핑 바인딩 집합
export function buyItem(type, price) {
    if (gold >= price && !currentItem) {
        gold -= price; currentItem = type; document.getElementById("inv-slot").innerText = type; updateUI();
    }
}

export function updateUI() { document.getElementById("gold-txt").innerText = gold; updateItemShopButtons(); }

export function updateItemShopButtons() {
    const itemsList = [ { id: 'btn-banana', price: 10 }, { id: 'btn-powerup', price: 30 }, { id: 'btn-magnet', price: 50 }, { id: 'btn-ice', price: 70 }, { id: 'btn-thanos', price: 100 } ];
    itemsList.forEach(item => {
        const btn = document.getElementById(item.id);
        if (btn) btn.disabled = (gold < item.price || currentItem) ? true : false;
    });
}

function useAcquiredItem() {
    if (!gameState.gameStarted || gameState.mySlotIndex === -1 || !currentItem) return;
    const myEnt = playersEntities[gameState.mySlotIndex]; if (myEnt.isSlipped || myEnt.isFrozen) return;
    const type = currentItem; currentItem = null; document.getElementById("inv-slot").innerText = "비어있음"; updateUI();
    const forwardVec = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), myEnt.model.root.rotation.y).normalize();

    if (type === 'banana') {
        const bPos = myEnt.model.root.position.clone().add(forwardVec.multiplyScalar(2.5)); bPos.y = 0.02;
        const bMesh = createFancyBananaShellMesh(); bMesh.position.copy(bPos); scene.add(bMesh);
        const bId = Math.random().toString(36).substring(2, 9); activeBananasInWorld.push({ id: bId, mesh: bMesh, ownerId: gameState.loggedInUser.id });
        sendItemTrigger({ item: 'banana', action: 'spawn', id: bId, x: bPos.x, z: bPos.z, ownerId: gameState.loggedInUser.id });
    } else if (type === 'powerup') {
        myEnt.hasPowerup = true; setTimeout(() => { myEnt.hasPowerup = false; }, 7000);
    } else if (type === 'magnet') {
        const target = getForwardFacingTargetPlayer(myEnt, forwardVec, 12);
        if (target && target.isCarrying) {
            sendItemTrigger({ item: 'magnet', victimId: target.id, stealerId: gameState.loggedInUser.id });
            target.isCarrying = false; if (target.boxMesh) target.model.root.remove(target.boxMesh); target.model.torso.scale.set(1, 1, 1);
            triggerGrabBox();
        }
    } else if (type === 'ice') {
        const target = getForwardFacingTargetPlayer(myEnt, forwardVec, 15);
        if (target) {
            sendItemTrigger({ item: 'ice', victimId: target.id });
            target.isFrozen = true; const iceBlockGeo = new THREE.BoxGeometry(1.4, 2.2, 1.4); const iceBlockMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 });
            const iceMesh = new THREE.Mesh(iceBlockGeo, iceBlockMat); iceMesh.position.y = 1.0; target.model.root.add(iceMesh); target.iceMesh = iceMesh;
            setTimeout(() => { target.isFrozen = false; if (target.iceMesh) { target.model.root.remove(target.iceMesh); target.iceMesh = null; } }, 5000);
        }
    } else if (type === 'thanos') { openThanosPopup(); }
}

function getForwardFacingTargetPlayer(owner, forwardVec, maxDist) {
    let closestTarget = null; let minDist = maxDist;
    playersEntities.forEach((ent) => {
        if (ent.id === owner.id) return;
        const toTarget = ent.model.root.position.clone().sub(owner.model.root.position); const dist = toTarget.length();
        if (dist < minDist) {
            const angle = forwardVec.angleTo(toTarget.clone().normalize());
            if (angle < 0.8) { minDist = dist; closestTarget = ent; }
        }
    });
    return closestTarget;
}

export function openThanosPopup() {
    if (!gameState.gameStarted || gameState.mySlotIndex === -1) return;
    const container = document.getElementById("thanos-players-container"); container.innerHTML = "";
    playersEntities.forEach((p, idx) => {
        if (idx === gameState.mySlotIndex) return;
        const btn = document.createElement("button"); btn.className = `thanos-player-btn rank-${p.slot}`;
        btn.innerHTML = `<span>${p.nickname}</span><span>${p.score}박스 소지</span>`;
        btn.onclick = () => window.executeThanosSnap(p); container.appendChild(btn);
    });
    document.getElementById("thanos-popup").style.display = "block";
}

export function closeThanosPopup() { document.getElementById("thanos-popup").style.display = "none"; }

export function executeThanosSnap(targetPlayer) {
    const myEnt = playersEntities[gameState.mySlotIndex]; if (!myEnt || !targetPlayer) return;
    if (targetPlayer.score > 0) {
        const stolenScore = Math.floor(targetPlayer.score / 2);
        if (stolenScore > 0) {
            targetPlayer.score -= stolenScore; myEnt.score += stolenScore;
            document.getElementById(`score-slot-${targetPlayer.slot}`).innerText = targetPlayer.score;
            document.getElementById(`score-slot-${myEnt.slot}`).innerText = myEnt.score;
            sendItemTrigger({ item: 'thanos', victimSlot: targetPlayer.slot, stealerSlot: myEnt.slot, amount: stolenScore });
        }
    }
    closeThanosPopup();
}

export function handleRemoteItemTrigger(data) {
    if (!gameState.gameStarted) return;
    if (data.item === 'banana') {
        if (data.action === 'spawn') {
            const bMesh = createFancyBananaShellMesh(); bMesh.position.set(data.x, 0.02, data.z); scene.add(bMesh); activeBananasInWorld.push({ id: data.id, mesh: bMesh, ownerId: data.ownerId });
        } else if (data.action === 'destroy') {
            const idx = activeBananasInWorld.findIndex(b => b.id === data.id); if (idx !== -1) { scene.remove(activeBananasInWorld[idx].mesh); activeBananasInWorld.splice(idx, 1); }
        }
    } else if (data.item === 'magnet') {
        if (data.victimId === gameState.loggedInUser.id) {
            const myEnt = playersEntities[gameState.mySlotIndex]; myEnt.isCarrying = false;
            if (myEnt.boxMesh) { myEnt.model.root.remove(myEnt.boxMesh); myEnt.boxMesh = null; }
            myEnt.model.torso.scale.set(1, 1, 1); broadcastMyLocation();
        }
        const stealer = playersEntities.find(p => p.id === data.stealerId); const victim = playersEntities.find(p => p.id === data.victimId);
        if (stealer) {
            stealer.isCarrying = true;
            if (!stealer.boxMesh && stealer.id !== gameState.loggedInUser.id) {
                stealer.boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 1.1), pileBoxMat); stealer.boxMesh.position.set(0, 2.1, 0); stealer.model.root.add(stealer.boxMesh); stealer.model.torso.scale.set(1.2, 0.7, 1.2);
            }
        }
        if (victim) { victim.isCarrying = false; if (victim.boxMesh) victim.model.root.remove(victim.boxMesh); victim.model.torso.scale.set(1, 1, 1); }
    } else if (data.item === 'ice') {
        const target = playersEntities.find(p => p.id === data.victimId);
        if (target) {
            target.isFrozen = true; const iceMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 1.4), new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.65 }));
            iceMesh.position.y = 1.0; target.model.root.add(iceMesh); target.iceMesh = iceMesh;
            setTimeout(() => { target.isFrozen = false; if (target.iceMesh) { target.model.root.remove(target.iceMesh); target.iceMesh = null; } }, 5000);
        }
    } else if (data.item === 'thanos') {
        const vPlayer = playersEntities.find(p => p.slot === data.victimSlot); const sPlayer = playersEntities.find(p => p.slot === data.stealerSlot);
        if (vPlayer && sPlayer) {
            vPlayer.score -= data.amount; sPlayer.score += data.amount;
            document.getElementById(`score-slot-${vPlayer.slot}`).innerText = vPlayer.score; document.getElementById(`score-slot-${sPlayer.slot}`).innerText = sPlayer.score;
        }
    }
}

export function exitGameOverToLobby() {
    document.getElementById("game-over-screen").style.display = "none"; document.querySelectorAll(".hud").forEach(el => el.style.display = "none");
    playersEntities.forEach(ent => { if (ent.model) scene.remove(ent.model.root); });
    activeBananasInWorld.forEach(b => scene.remove(b.mesh)); activeBananasInWorld.length = 0;
    playersEntities = []; gameState.gameStarted = false; gameState.gameTime = 120;
    document.getElementById("start-screen").style.display = "flex"; document.getElementById("start-screen").style.opacity = "1";
    subscribeRoomPresence();
}

// 키보드 입출력 인터럽트 핸들러 등록
const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (!gameState.gameStarted || gameState.mySlotIndex === -1) return;
    const myEnt = playersEntities[gameState.mySlotIndex]; if (!myEnt || myEnt.isFrozen || myEnt.isSlipped) return;

    if (e.key.toLowerCase() === 'e') executePlayerPunch();
    if (e.key.toLowerCase() === 'r') useAcquiredItem();
    if (e.key === " ") {
        e.preventDefault();
        if (!myEnt.isCarrying && myEnt.model.root.position.distanceTo(new THREE.Vector3(0,0,0)) < 4.5) triggerGrabBox();
    }
});
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

// 실시간 렌더링 애니메이션 루프 프로시저
let clock = 0;
function animate() {
    requestAnimationFrame(animate);
    if (!gameState.gameStarted || playersEntities.length === 0 || gameState.mySlotIndex === -1) {
        renderer.render(scene, camera); return;
    }

    clock += 0.15; const myEnt = playersEntities[gameState.mySlotIndex];
    if (myEnt && !myEnt.isSlipped && !myEnt.isFrozen) {
        activeBananasInWorld.forEach((b) => {
            if (b.ownerId === gameState.loggedInUser.id) return;
            if (myEnt.model.root.position.distanceTo(b.mesh.position) < 1.1) {
                myEnt.isSlipped = true; if (myEnt.isCarrying) triggerReleaseBox(false);
                sendItemTrigger({ item: 'banana', action: 'destroy', id: b.id });
                scene.remove(b.mesh);
                const slipStartClock = Date.now();
                const slipInterval = setInterval(() => {
                    if (!gameState.gameStarted) { clearInterval(slipInterval); return; }
                    myEnt.model.root.rotation.y += 0.4; broadcastMyLocation();
                    if (Date.now() - slipStartClock >= 1000) { clearInterval(slipInterval); myEnt.isSlipped = false; }
                }, 30);
            }
        });
    }

    playersEntities.forEach((ent, idx) => {
        if (!ent || !ent.model) return;
        if (idx === gameState.mySlotIndex) {
            let isMoving = keys.ArrowUp || keys.ArrowDown || keys.ArrowLeft || keys.ArrowRight;
            if (isMoving && !ent.isSlipped && !ent.isFrozen) {
                let computedSpeed = ent.hasPowerup ? baseSpeed * 1.5 : (ent.isCarrying ? baseSpeed * 0.7 : baseSpeed);
                if (keys.ArrowUp) ent.model.root.position.z -= computedSpeed;
                if (keys.ArrowDown) ent.model.root.position.z += computedSpeed;
                if (keys.ArrowLeft) ent.model.root.position.x -= computedSpeed;
                if (keys.ArrowRight) ent.model.root.position.x += computedSpeed;

                const moveVec = new THREE.Vector3(keys.ArrowRight - keys.ArrowLeft, 0, keys.ArrowDown - keys.ArrowUp).normalize();
                if (moveVec.lengthSq() > 0) ent.model.root.rotation.y = Math.atan2(moveVec.x, moveVec.z);
                ent.model.rLeg.rotation.x = Math.sin(clock) * 0.6; ent.model.lLeg.rotation.x = -Math.sin(clock) * 0.6;

                if (ent.isCarrying && ent.model.root.position.distanceTo(ent.targetZone) < zoneSize / 1.5) triggerReleaseBox(true);
                broadcastMyLocation();
            }
        } else {
            if (!ent.isSlipped) {
                ent.model.rLeg.rotation.x = Math.sin(clock * 1.2) * 0.5; ent.model.lLeg.rotation.x = -Math.sin(clock * 1.2) * 0.5;
            }
        }
    });
    renderer.render(scene, camera);
}
animate();