// /ayshu/assets/firebase.js  (FULL FILE — replace everything)

/* ---------------- Firebase SDK (CDN ESM) ---------------- */
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup,
  setPersistence, browserLocalPersistence, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, setDoc, doc, updateDoc, getDoc, getDocs,
  serverTimestamp, query, where, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

/* ---------------- Config (your real web config) ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyDMCk_sQWPzlnes_pfZzAlaL9OY-Y6i7YQ",
  authDomain: "vaahakamv-fe548.firebaseapp.com",
  projectId: "vaahakamv-fe548",
  storageBucket: "vaahakamv-fe548.appspot.com",
  appId: "1:614963890607:web:581cb7fd31b2b1661c475a"
};

/* ---------------- Initialize ---------------- */
export const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

auth.languageCode = 'en';
// Use persistent session, but don’t block module load if the call fails
setPersistence(auth, browserLocalPersistence).catch(()=>{});

/* ---------------- Globals / helpers ---------------- */
export const OWNER_EMAILS = ["nmmc@live.com","ayshuaysh@gmail.com"].map(e=>e.toLowerCase());
export const now = () => serverTimestamp();

export function toast(msg){
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(()=> t.style.display = 'none', 1800);
}

function cleanAuthErr(e){
  const map = {
    "auth/invalid-email": "Invalid email",
    "auth/missing-password": "Enter a password",
    "auth/weak-password": "Password too weak",
    "auth/email-already-in-use": "Email already in use",
    "auth/invalid-credential": "Wrong email or password",
    "auth/popup-blocked": "Popup blocked",
    "auth/unauthorized-domain": "Add your domain in Firebase Auth → Authorized domains",
    "auth/api-key-not-valid": "Invalid API key",
    "auth/operation-not-allowed": "Enable the provider in Firebase Auth"
  };
  return map[e?.code] || (e?.message || 'Auth error');
}

/* ---------------- Roles ---------------- */
export async function getRole(uid){
  const email = (auth.currentUser?.email || "").toLowerCase();
  if (OWNER_EMAILS.includes(email)) return "owner";
  try{
    const snap = await getDoc(doc(db, "roles", uid));
    const role = snap.exists() ? snap.data()?.role : null;
    if (role === "owner" || role === "moderator") return role;
  }catch{}
  return "user";
}

/* ---------------- Auth bar wiring (no flicker) ----------------
   Requires your page to wrap the bars like:

   <div id="authSection" data-auth-ready="0">
     <div id="authBar">...</div>
     <div id="userBar" style="display:none">...</div>
   </div>

   And in the page:
   <script type="module">
     import { wireAuthBar } from "/ayshu/assets/firebase.js?v=113";
     wireAuthBar();
   </script>
---------------------------------------------------------------- */
export function wireAuthBar(){
  const authSection = document.getElementById('authSection');
  const authBar = document.getElementById('authBar');
  const userBar = document.getElementById('userBar');

  const emailEl = document.getElementById('email');
  const passEl  = document.getElementById('pass');

  const btnLogin  = document.getElementById('btnLogin');
  const btnSignup = document.getElementById('btnSignup');
  const btnGoogle = document.getElementById('btnGoogle');
  const btnLogout = document.getElementById('btnLogout');
  const who       = document.getElementById('who');

  if (!authBar || !userBar) return; // page may not have auth bars

  let first = true;

  function showLoggedOut(){
    authBar.style.display = 'flex';
    userBar.style.display = 'none';
  }
  function showLoggedIn(user){
    authBar.style.display = 'none';
    userBar.style.display = 'flex';
    if (who){
      const bits = [user.email || '(no email)'];
      if (user.emailVerified) bits.push('· verified');
      who.textContent = bits.join(' ');
    }
  }

  if (btnLogin) btnLogin.onclick = async ()=>{
    try{
      await signInWithEmailAndPassword(auth, (emailEl?.value||"").trim(), passEl?.value||"");
    }catch(e){ toast(cleanAuthErr(e)); }
  };
  if (btnSignup) btnSignup.onclick = async ()=>{
    try{
      const cred = await createUserWithEmailAndPassword(auth, (emailEl?.value||"").trim(), passEl?.value||"");
      try{ await sendEmailVerification(cred.user); }catch{}
      toast("Signed up. Check your email to verify.");
    }catch(e){ toast(cleanAuthErr(e)); }
  };
  if (btnGoogle) btnGoogle.onclick = async ()=>{
    try{ await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch(e){ toast(cleanAuthErr(e)); }
  };
  if (btnLogout) btnLogout.onclick = async ()=>{
    try{ await signOut(auth); }catch{}
  };

  onAuthStateChanged(auth, (u)=>{
    if (u) showLoggedIn(u); else showLoggedOut();

    // Let pages react (Explore, My Panel, etc.)
    window.dispatchEvent(new Event('firebase-auth-changed'));

    // Remove flicker: only unhide after the first state arrives
    if (first){
      first = false;
      if (authSection) authSection.setAttribute('data-auth-ready', '1');
    }
  });
}

/* ---------------- Stories: queries & mutations ---------------- */
export async function listPublishedStories(limitN = 60){
  const snap = await getDocs(query(collection(db, "stories"), where("status","==","published")));
  const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
  return rows.slice(0, limitN);
}

export async function listTrending(limitN = 6){
  const rows = await listPublishedStories(60);
  rows.sort((a,b)=>{
    const ah = Number(a.hotScore||0), bh = Number(b.hotScore||0);
    if (bh !== ah) return bh - ah;
    const at = a.createdAt?.seconds||0, bt = b.createdAt?.seconds||0;
    return bt - at;
  });
  return rows.slice(0, limitN);
}

export async function getStory(id){
  const snap = await getDoc(doc(db, "stories", id));
  return snap.exists() ? ({ id, ...snap.data() }) : null;
}

export async function getSinglePost(id){
  const snap = await getDoc(doc(db, "singlePosts", id));
  return snap.exists() ? snap.data() : null;
}

export async function listSeriesParts(storyId){
  const s = await getDocs(query(collection(db, "seriesParts"), where("storyId","==",storyId)));
  const rows = s.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (a?.partNumber||0) - (b?.partNumber||0));
  return rows;
}

export async function listMyStories(uid, limitN = 200){
  const s = await getDocs(query(collection(db, "stories"), where("authorId","==",uid)));
  const rows = s.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
  return rows.slice(0, limitN);
}

export async function listAllStories(limitN = 400){
  const snap = await getDocs(collection(db, "stories"));
  const rows = snap.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=> (b?.createdAt?.seconds||0) - (a?.createdAt?.seconds||0));
  return rows.slice(0, limitN);
}

export async function createStoryShell({ title, language, type, genres, tags, uid }){
  const ref = await addDoc(collection(db, "stories"), {
    title, language, type,
    status: "pending",
    genres: genres || [],
    tags: tags || [],
    authorId: uid,
    hotScore: 0,
    createdAt: now(),
    updatedAt: now()
  });
  return ref.id;
}

export async function createSinglePost(storyId, body){
  await setDoc(doc(db, "singlePosts", storyId), {
    storyId, body, createdAt: now(), updatedAt: now()
  });
}

export async function addSeriesPart({ storyId, partNumber, title, body }){
  await addDoc(collection(db, "seriesParts"), {
    storyId, partNumber, title, body, createdAt: now(), updatedAt: now()
  });
}

export async function updateStory(id, patch){
  await updateDoc(doc(db, "stories", id), { ...patch, updatedAt: now() });
}

export async function updateStatus(id, status){
  await updateDoc(doc(db, "stories", id), { status, updatedAt: now() });
}

export async function bumpHot(id, delta = 1){
  try{
    const d = await getDoc(doc(db, "stories", id));
    const cur = Number(d.data()?.hotScore || 0);
    await updateDoc(doc(db, "stories", id), { hotScore: cur + delta, updatedAt: now() });
  }catch{}
}

export async function deleteStory(id){
  await deleteDoc(doc(db, "stories", id));
}
// ---- SERIES HELPERS ----

// All series stories for a given author (for Write page dropdown)
export async function listAuthorSeries(uid, limitN=200){
  const s = await getDocs(query(
    collection(db,'stories'),
    where('type','==','series'),
    where('authorId','==',uid)
  ));
  const rows = s.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=>(b?.createdAt?.seconds||0)-(a?.createdAt?.seconds||0));
  return rows.slice(0,limitN);
}

// Parts ordered ascending for a series
export async function listSeriesPartsOrdered(storyId){
  const s = await getDocs(query(
    collection(db,'seriesParts'),
    where('storyId','==',storyId)
  ));
  const rows = s.docs.map(d=>({ id:d.id, ...d.data() }));
  rows.sort((a,b)=>( (a?.partNumber||0) - (b?.partNumber||0) ));
  return rows;
}

// Adjacent (prev/next) part by partNumber
export async function getAdjacentParts(storyId, currentPart){
  const parts = await listSeriesPartsOrdered(storyId);
  const idx = parts.findIndex(p => Number(p.partNumber||0) === Number(currentPart||0));
  const prev = idx>0 ? parts[idx-1] : null;
  const next = (idx>=0 && idx<parts.length-1) ? parts[idx+1] : null;
  return { prev, next, parts };
}
