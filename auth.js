
let supabaseClient = null;
let currentUser = null;
let cloudSaveTimer = null;

function cloudConfigured(){
  return window.SUPABASE_CONFIG &&
    window.SUPABASE_CONFIG.url &&
    window.SUPABASE_CONFIG.anonKey &&
    !window.SUPABASE_CONFIG.url.includes('YOUR_') &&
    !window.SUPABASE_CONFIG.anonKey.includes('YOUR_');
}
function authMessage(msg, err=false){
  const el=document.getElementById('authMessage');
  el.textContent=msg||'';
  el.style.color=err?'#9b2c2c':'';
}
function renderAuth(){
  const yes=!!currentUser;
  document.getElementById('authUser').textContent=yes?currentUser.email:'尚未登入';
  document.getElementById('loginBtn').style.display=yes?'none':'';
  document.getElementById('signupBtn').style.display=yes?'none':'';
  document.getElementById('logoutBtn').style.display=yes?'':'none';
  document.getElementById('authEmail').disabled=yes;
  document.getElementById('authPassword').disabled=yes;
}
async function syncStateToCloud(){
  if(!currentUser||!supabaseClient) return;
  const {error}=await supabaseClient.from('user_progress').upsert({
    user_id:currentUser.id,
    state:state,
    updated_at:new Date().toISOString()
  },{onConflict:'user_id'});
  if(error) authMessage('雲端儲存失敗：'+error.message,true);
}
const originalSave = save;
save = function(){
  originalSave();
  if(currentUser&&supabaseClient){
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer=setTimeout(syncStateToCloud,500);
  }
};
async function loadCloudState(){
  const {data,error}=await supabaseClient.from('user_progress')
    .select('state').eq('user_id',currentUser.id).maybeSingle();
  if(error){authMessage('讀取雲端紀錄失敗：'+error.message,true);return;}
  if(data&&data.state){
    state=data.state;
    localStorage.setItem('yijingState',JSON.stringify(state));
  }else{
    await syncStateToCloud();
  }
  renderLesson();renderJournals();updateDashboard();
}
async function signUpUser(){
  if(!supabaseClient){authMessage('雲端登入尚未設定完成。',true);return;}
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  if(!email||password.length<6){authMessage('請輸入有效 Email，密碼至少 6 碼。',true);return;}
  authMessage('建立帳號中…');
  const {data,error}=await supabaseClient.auth.signUp({email,password});
  if(error){authMessage(error.message,true);return;}
  if(data.session){
    currentUser=data.user;renderAuth();await loadCloudState();
    authMessage('帳號建立完成，已登入。');
  }else{
    authMessage('帳號已建立，請依驗證信完成 Email 驗證後登入。');
  }
}
async function signInUser(){
  if(!supabaseClient){authMessage('雲端登入尚未設定完成。',true);return;}
  const email=document.getElementById('authEmail').value.trim();
  const password=document.getElementById('authPassword').value;
  authMessage('登入中…');
  const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});
  if(error){authMessage('登入失敗：'+error.message,true);return;}
  currentUser=data.user;renderAuth();await loadCloudState();
  authMessage('登入成功，已載入此帳號的學習紀錄。');
}
async function signOutUser(){
  if(!supabaseClient)return;
  await supabaseClient.auth.signOut();
  currentUser=null;renderAuth();authMessage('已登出。');
}
async function initAuth(){
  if(!cloudConfigured()){
    document.getElementById('setupNotice').style.display='';
    renderAuth();return;
  }
  try{
    supabaseClient=window.supabase.createClient(
      window.SUPABASE_CONFIG.url,
      window.SUPABASE_CONFIG.anonKey
    );
    const {data}=await supabaseClient.auth.getSession();
    currentUser=data.session?.user||null;
    renderAuth();
    if(currentUser) await loadCloudState();
    supabaseClient.auth.onAuthStateChange(async (_event,session)=>{
      currentUser=session?.user||null;renderAuth();
      if(currentUser) await loadCloudState();
    });
  }catch(e){authMessage('登入服務初始化失敗：'+e.message,true);}
}
initAuth();
