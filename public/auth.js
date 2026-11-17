async function apiLogin(username,password){const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const data=await r.json();if(!r.ok)throw new Error(data.message||"Login gagal");sessionStorage.setItem("spAdmin",JSON.stringify(data.user));return data.user}
function requireAdmin(){if(!sessionStorage.getItem("spAdmin")){location.href="/login.html";return false}return true}
function logoutAdmin(){sessionStorage.removeItem("spAdmin");location.href="/login.html"}
