// Client-side validation and local mock registration
const form = document.getElementById('registrationForm');
const resetBtn = document.getElementById('resetBtn');
const password = document.getElementById('password');
const confirmPassword = document.getElementById('confirmPassword');
const passwordStrength = document.getElementById('passwordStrength');

function showError(name, message){
  const el = document.querySelector(`.error[data-for="${name}"]`);
  if(el) el.textContent = message || '';
}

function clearErrors(){
  document.querySelectorAll('.error').forEach(e=>e.textContent='');
}

function validateEmail(email){
  // simple RFC-like check
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function passwordScore(pw){
  let score = 0;
  if(pw.length >= 8) score++;
  if(/[0-9]/.test(pw)) score++;
  if(/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if(/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

password.addEventListener('input', ()=>{
  const s = passwordScore(password.value);
  passwordStrength.value = s;
});

form.addEventListener('submit', async (e)=>{
  e.preventDefault();
  clearErrors();

  const data = new FormData(form);
  const values = Object.fromEntries(data.entries());
  let valid = true;

  if(!values.firstName || values.firstName.trim().length < 2){
    showError('firstName','Enter a valid first name'); valid = false;
  }
  if(!values.lastName || values.lastName.trim().length < 2){
    showError('lastName','Enter a valid last name'); valid = false;
  }
  if(!values.email || !validateEmail(values.email)){
    showError('email','Enter a valid email address'); valid = false;
  }
  if(values.phone && values.phone.trim().length < 6){
    showError('phone','Enter a valid phone number'); valid = false;
  }
  if(!values.password || password.value.length < 8){
    showError('password','Password must be at least 8 characters'); valid = false;
  }
  if(values.password !== values.confirmPassword){
    showError('confirmPassword','Passwords do not match'); valid = false;
  }
  if(!values.restaurantName || values.restaurantName.trim().length < 2){
    showError('restaurantName','Enter a restaurant name'); valid = false;
  }
  if(!values.role){
    showError('role','Select a role'); valid = false;
  }

  const avatar = document.getElementById('avatar').files[0];
  if(avatar){
    const maxBytes = 2 * 1024 * 1024; // 2MB
    if(avatar.size > maxBytes){
      showError('avatar','File too large (max 2MB)'); valid = false;
    }
    if(!/^image\//.test(avatar.type)){
      showError('avatar','File must be an image'); valid = false;
    }
  }

  const tos = document.getElementById('tos').checked;
  if(!tos){ showError('tos','You must agree to the Terms of Service'); valid = false; }

  if(!valid) return;

  // Send to backend
  try{
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      password: values.password,
      restaurantName: values.restaurantName,
      role: values.role
    };
    const res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
    if(!res.ok){
      const err = await res.json().catch(()=>({error:'Registration failed'}));
      showError('email', err.error || 'Registration failed');
      return;
    }
    alert('Account created. You can now sign in.');
    form.reset();
    passwordStrength.value = 0;
  }catch(err){
    showError('email','Network error');
  }
});

resetBtn.addEventListener('click', ()=>{
  form.reset();
  clearErrors();
  passwordStrength.value = 0;
});
