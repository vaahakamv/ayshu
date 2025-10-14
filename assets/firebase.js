// (full JS provided in previous cell; repeating fully here for file output)
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, signInWithRedirect,
  setPersistence, browserLocalPersistence, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, setDoc, doc, updateDoc, getDoc, getDocs,
  serverTimestamp, query, orderBy, limit, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMCk_sQWPzlnes_pfZzAlaL9OY-Y6i7YQ",
  authDomain: "vaahakamv-fe548.firebaseapp.com",
  projectId: "vaahakamv-fe548",
  storageBucket: "vaahakamv-fe548.appspot.com",
  appId: "1:614963890607:web:581cb7fd31b2b1661c475a"
};

export const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
auth.languageCode = 'en';
await setPersistence(auth, browserLocalPersistence);

export const OWNER_EMAILS = ["nmmc@live.com","ayshuaysh@gmail.com"].map(e=>e.toLowerCase());
export const now = ()=>serverTimestamp();
export function toast(msg){ const t=document.getElementById('toast'); if(!t) return; t.textContent=msg; t.style.display='block'; setTimeout(()=>t.style.display='none',2000); }
window.__fbdiag = { app, auth, db };

export async function getRole(uid){
  const email = (auth.currentUser?.email || "").toLowerCase();
  if (OWNER_EMAILS.includes(email)) return "owner";
  try{
    const snap = await getDoc(doc(db,'roles',uid));
    const role = snap.exists() ? snap.data()?.role : null;
    if (role === "moderator") return "moderator";
  }catch{}
  return "user";
}

export function wireAuthBar(){
  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('pass');
  const login   = document.getElementById('btnLogin');
  const signup  = document.getElementById('btnSignup');
  const google  = document.getElementById('btnGoogle');
  const logout  = document.getElementById('btnLogout');
  const authBar = document.getElementById('authBar');
  const userBar = document.getElementById('userBar');
  const who     = document.getElementById('who');
  const verifyNote = document.getElementById('verifyNote');
  const log = (...a)=>console.log("[AUTH]", ...a);

  if (login) login.onclick = async ()=>{
    try{
      const email=(emailEl?.value||"").trim(), pass=passEl?.value||"";
      log("login click", email);
      await signInWithEmailAndPassword(auth, email, pass);
      toast(auth.currentUser?.emailVerified ? 'Logged in.' : 'Logged in. Verify your email.');
    }catch(e){ console.error(e); toast(cleanAuthErr(e)); }
  };

  if (signup) signup.onclick = async ()=>{
    try{
      const email=(emailEl?.value||"").trim(), pass=passEl?.value||"";
      log("signup click", email);
      await createUserWithEmailAndPassword(auth, email, pass);
      await sendEmailVerification(auth.currentUser);
      toast('Account created. Verification email sent.');
    }catch(e){ console.error(e); toast(cleanAuthErr(e)); }
  };

  if (google) google.onclick = async ()=>{
    try{
      log("google click");
      const prov = new GoogleAuthProvider();
      try { await signInWithPopup(auth, prov); }
      catch { await signInWithRedirect(auth, prov); }
    }catch(e){ console.error(e); toast(cleanAuthErr(e)); }
  };

  if (logout) logout.onclick = ()=> { log("logout click"); signOut(auth); };

  onAuthStateChanged(auth, async (user)=>{
    log("state changed", user?.email || null);
    if (user){
      authBar && (authBar.style.display='none');
      userBar && (userBar.style.display='flex');
      const email = (user.email||"").toLowerCase();
      const role = OWNER_EMAILS.includes(email) ? 'owner' : 'user';
      who && (who.innerHTML = `${user.email} ${user.emailVerified?'':'<span class="muted">(verify)</span>'} · ${role}`);
      verifyNote && (verifyNote.style.display = user.emailVerified ? 'none' : 'block');
    } else {
      authBar && (authBar.style.display='flex');
      userBar && (userBar.style.display='none');
      who && (who.textContent='');
      verifyNote && (verifyNote.style.display='block');
    }
    window.dispatchEvent(new Event('firebase-auth-changed'));
  });

  log("auth bar wired");
}

function cleanAuthErr(e){
  const map = {
    "auth/invalid-email":"Invalid email",
    "auth/missing-password":"Enter a password",
    "auth/weak-password":"Password too weak",
    "auth/email-already-in-use":"Email already in use",
    "auth/invalid-credential":"Wrong email or password",
    "auth/popup-blocked":"Popup blocked — trying redirect…",
    "auth/unauthorized-domain":"Add your domain in Firebase Auth → Authorized domains",
    "auth/api-key-not-valid":"Invalid API key",
    "auth/operation-not-allowed":"Enable the provider in Firebase Auth"
  };
  return map[e?.code] || (e?.message || 'Auth error');
}

export async function listPublishedStories(limitN=60){
  const snap = await getDocs(query(collection(db,'stories'), where('status','==','published')));
  const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
  return rows.slice(0, limitN);
}
export async function listTrending(limitN=6){
  const rows = await listPublishedStories(60);
  rows.sort((a,b)=>{
    const ah=+a.hotScore||0, bh=+b.hotScore||0;
    if (bh!==ah) return bh-ah;
    const at=a.createdAt?.seconds||0, bt=b.createdAt?.seconds||0;
    return bt-at;
  });
  return rows.slice(0, limitN);
}
export async function getStory(id){
  const snap = await getDoc(doc(db,'stories',id));
  return snap.exists()? { id, ...snap.data() } : null;
}
export async function getSinglePost(id){
  const snap = await getDoc(doc(db,'singlePosts',id));
  return snap.exists()? snap.data() : null;
}
export async function listSeriesParts(storyId){
  const s = await getDocs(query(collection(db,'seriesParts'), where('storyId','==',storyId)));
  const rows = s.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (a?.partNumber||0) - (b?.partNumber||0));
  return rows;
}
export async function listMyStories(uid, limitN=200){
  const s = await getDocs(query(collection(db,'stories'), where('authorId','==',uid)));
  const rows = s.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
  return rows.slice(0, limitN);
}
export async function listAllStories(limitN=400){
  const snap = await getDocs(collection(db,'stories'));
  const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
  return rows.slice(0, limitN);
}
export async function createStoryShell({title, language, type, genres, tags, uid}){
  const ref = await addDoc(collection(db,'stories'), { title, language, type, status:'pending', genres: genres||[], tags: tags||[], authorId: uid, hotScore: 0, createdAt: now(), updatedAt: now() });
  return ref.id;
}
export async function createSinglePost(storyId, body){
  await setDoc(doc(db,'singlePosts',storyId), { storyId, body, createdAt: now(), updatedAt: now() });
}
export async function addSeriesPart({ storyId, partNumber, title, body }){
  await addDoc(collection(db,'seriesParts'), { storyId, partNumber, title, body, createdAt: now(), updatedAt: now() });
}
export async function updateStory(id, patch){
  await updateDoc(doc(db,'stories',id), { ...patch, updatedAt: now() });
}
export async function updateStatus(id, status){
  await updateDoc(doc(db,'stories',id), { status, updatedAt: now() });
}
export async function bumpHot(id, delta=1){
  try{ const d = await getDoc(doc(db,'stories',id));
       const cur = Number(d.data()?.hotScore||0);
       await updateDoc(doc(db,'stories',id), { hotScore: cur+delta, updatedAt: now() });
  }catch{}
}
export async function deleteStory(id){
  await deleteDoc(doc(db,'stories',id));
}
