document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('loginForm');
  function showError(name, message){
    const el = document.querySelector(`.error[data-for="${name}"]`);
    if(el) el.textContent = message || '';
  }
  function clearErrors(){ document.querySelectorAll('.error').forEach(e=>e.textContent=''); }

  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); clearErrors();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    let valid = true;
    if(!email){ showError('email','Enter your email'); valid=false; }
    if(!password){ showError('password','Enter your password'); valid=false; }
    if(!valid) return;

    try{
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if(!res.ok){
        const err = await res.json().catch(()=>({error:'Login failed'}));
        showError('email', err.error || 'Login failed');
        return;
      }
      // success — server sets HttpOnly cookie
      window.location.href = 'dashboard.html';
    }catch(err){
      showError('email','Network error');
    }
  });
});
