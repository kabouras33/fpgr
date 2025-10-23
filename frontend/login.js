document.addEventListener('DOMContentLoaded', ()=>{
  const form = document.getElementById('loginForm');
  function showError(name, message){
    const el = document.querySelector(`.error[data-for="${name}"]`);
    if(el) el.textContent = message || '';
  }
  function clearErrors(){ document.querySelectorAll('.error').forEach(e=>e.textContent=''); }

  form.addEventListener('submit', (e)=>{
    e.preventDefault(); clearErrors();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    let valid = true;
    if(!email){ showError('email','Enter your email'); valid=false; }
    if(!password){ showError('password','Enter your password'); valid=false; }
    if(!valid) return;

    const users = JSON.parse(localStorage.getItem('rm_users') || '[]');
    const found = users.find(u=>u.email.toLowerCase()===email.toLowerCase());
    if(!found){ showError('email','No account found for this email'); return; }

    // This is a mock: we don't store passwords. Accept any password for matched email.
    const session = { userId: found.id, email: found.email, createdAt: new Date().toISOString() };
    localStorage.setItem('rm_session', JSON.stringify(session));
    // redirect to a placeholder dashboard
    window.location.href = 'dashboard.html';
  });
});
