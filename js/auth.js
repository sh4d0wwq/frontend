const toggleAuthLink = document.getElementById('toggle-auth');
const formTitle = document.getElementById('form-title');
const submitButton = document.getElementById('submit-btn');
const form = document.getElementById('auth-form');
const emailField = document.getElementById('email');
const emailGroup = document.getElementById('email-group');
const usernameField = document.getElementById('username');
const passwordField = document.getElementById('password');
const usernameGroup = document.getElementById('username-group');
const errorMessage = document.getElementById('error-message');

let isLogin = true;

toggleAuthLink.addEventListener('click', (e) => {
  e.preventDefault();
  isLogin = !isLogin;

  if (isLogin) {
    formTitle.textContent = 'Login';
    submitButton.textContent = 'Login';
    toggleAuthLink.textContent = 'Don\'t have an account? Register';

    emailGroup.style.display = 'none';
    emailField.removeAttribute('required');
  } else {
    formTitle.textContent = 'Register';
    submitButton.textContent = 'Register';
    toggleAuthLink.textContent = 'Already have an account? Login';

    emailGroup.style.display = 'block';
    emailField.setAttribute('required', 'true');
  }

  errorMessage.textContent = '';
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = emailField.value.trim();
  const password = passwordField.value.trim();
  const username = usernameField.value.trim();

  const url = isLogin
    ? 'http://localhost:8001/auth/login'
    : 'http://localhost:8001/auth/register';

  const body = isLogin
    ? { username, password }
    : { username, email, password };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    
    if (!res.ok) {
      const data = await res.json();
      errorMessage.textContent = data.detail || 'Something went wrong';
    } else {
      const data = await res.json();
      localStorage.setItem("user_id", data.user_id); 
      window.location.href = '/pages/chats.html';
    }
  } catch (err) {
    console.error(err);
    errorMessage.textContent = 'Server error';
  }
});
