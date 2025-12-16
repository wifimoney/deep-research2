import { html } from 'hono/html'

// Shared styles for auth pages
const authStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  .auth-container {
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    padding: 40px;
    width: 100%;
    max-width: 400px;
  }
  h1 {
    color: #333;
    margin-bottom: 30px;
    text-align: center;
    font-size: 28px;
  }
  .form-group {
    margin-bottom: 20px;
  }
  label {
    display: block;
    margin-bottom: 8px;
    color: #555;
    font-weight: 500;
    font-size: 14px;
  }
  input {
    width: 100%;
    padding: 12px;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 16px;
    transition: border-color 0.3s;
  }
  input:focus {
    outline: none;
    border-color: #667eea;
  }
  button {
    width: 100%;
    padding: 14px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  button:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
  }
  button:active {
    transform: translateY(0);
  }
  .error {
    background: #fee;
    color: #c33;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 14px;
  }
  .success {
    background: #efe;
    color: #3c3;
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 20px;
    font-size: 14px;
  }
  .link {
    text-align: center;
    margin-top: 20px;
    color: #666;
    font-size: 14px;
  }
  .link a {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
  }
  .link a:hover {
    text-decoration: underline;
  }
`

// Dashboard styles
const dashboardStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: #f5f7fa;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .navbar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    padding: 16px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    flex-shrink: 0;
  }
  .navbar h1 {
    color: white;
    font-size: 20px;
  }
  .navbar .user-info {
    display: flex;
    align-items: center;
    gap: 16px;
    color: white;
  }
  .navbar button {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
    width: auto;
  }
  .navbar button:hover {
    background: rgba(255, 255, 255, 0.3);
    transform: none;
    box-shadow: none;
  }

  /* Chat Layout */
  .chat-container {
    display: flex;
    flex: 1;
    overflow: hidden;
    height: calc(100vh - 64px);
  }

  /* Sidebar */
  .chat-sidebar {
    width: 280px;
    background: white;
    border-right: 1px solid #e0e0e0;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .sidebar-header {
    padding: 16px;
    border-bottom: 1px solid #e0e0e0;
  }
  .new-chat-btn {
    width: 100%;
    padding: 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .new-chat-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  .thread-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  .thread-item {
    padding: 12px 16px;
    border-radius: 8px;
    cursor: pointer;
    margin-bottom: 4px;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .thread-item:hover {
    background: #f5f7fa;
  }
  .thread-item.active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%);
    border: 1px solid rgba(102, 126, 234, 0.3);
  }
  .thread-item .thread-icon {
    font-size: 16px;
  }
  .thread-item .thread-title {
    flex: 1;
    font-size: 14px;
    color: #333;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .no-threads {
    padding: 20px;
    text-align: center;
    color: #999;
    font-size: 14px;
  }

  /* Chat Main Area */
  .chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: #f5f7fa;
    min-width: 0;
  }
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
  }
  .messages-list {
    max-width: 800px;
    margin: 0 auto;
  }
  .message {
    margin-bottom: 16px;
    display: flex;
    gap: 12px;
  }
  .message.user {
    flex-direction: row-reverse;
  }
  .message-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
  }
  .message.user .message-avatar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
  }
  .message.assistant .message-avatar {
    background: #e0e0e0;
    color: #666;
  }
  .message-content {
    max-width: 70%;
    padding: 12px 16px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.5;
  }
  .message.user .message-content {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-bottom-right-radius: 4px;
  }
  .message.assistant .message-content {
    background: white;
    color: #333;
    border-bottom-left-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }
  .empty-chat {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #999;
  }
  .empty-chat-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  .empty-chat h3 {
    font-size: 18px;
    color: #666;
    margin-bottom: 8px;
  }
  .empty-chat p {
    font-size: 14px;
  }

  /* Input Area */
  .input-container {
    padding: 16px 24px;
    background: white;
    border-top: 1px solid #e0e0e0;
  }
  .input-wrapper {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    gap: 12px;
    align-items: flex-end;
  }
  .chat-input {
    flex: 1;
    padding: 14px 16px;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    font-size: 14px;
    resize: none;
    min-height: 48px;
    max-height: 120px;
    font-family: inherit;
    transition: border-color 0.2s;
  }
  .chat-input:focus {
    outline: none;
    border-color: #667eea;
  }
  .send-btn {
    padding: 14px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    width: auto;
  }
  .send-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
  .send-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  /* Loading State */
  .loading-dots {
    display: flex;
    gap: 4px;
    padding: 8px 0;
  }
  .loading-dots span {
    width: 8px;
    height: 8px;
    background: #999;
    border-radius: 50%;
    animation: bounce 1.4s ease-in-out infinite;
  }
  .loading-dots span:nth-child(1) { animation-delay: 0s; }
  .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
  .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 80%, 100% { transform: translateY(0); }
    40% { transform: translateY(-8px); }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .chat-sidebar {
      position: absolute;
      left: -280px;
      height: calc(100vh - 64px);
      z-index: 100;
      transition: left 0.3s;
    }
    .chat-sidebar.open {
      left: 0;
    }
    .message-content {
      max-width: 85%;
    }
  }
`

/**
 * Render login page
 */
export function renderLoginPage(
  error?: string,
  success?: string,
  username?: string,
  email?: string
) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Login</title>
      <style>${authStyles}
        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .loading {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #fff;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <h1>Login</h1>
        <div id="error" class="error" style="display: none;"></div>
        <div id="success" class="success" style="display: none;"></div>
        ${error ? html`<div class="error">${error}</div>` : ''}
        ${success ? html`<div class="success">${success}</div>` : ''}
        <form id="loginForm">
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              autocomplete="email"
              placeholder="Enter your email"
              value="${email || ''}"
            />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              autocomplete="current-password"
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" id="submitBtn">Login</button>
        </form>
        
        <div style="margin: 24px 0; text-align: center; position: relative;">
          <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: #e0e0e0;"></div>
          <span style="background: white; padding: 0 16px; color: #999; font-size: 14px; position: relative;">OR</span>
        </div>
        
        <button type="button" onclick="signInWithGoogle()" style="background: white; color: #333; border: 2px solid #e0e0e0; display: flex; align-items: center; justify-content: center; gap: 12px; width: 100%; padding: 14px; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer; transition: all 0.2s;">
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        
        <p class="link">Don't have an account? <a href="/auth/register">Register</a></p>
      </div>
      <script>
        const form = document.getElementById('loginForm');
        const errorDiv = document.getElementById('error');
        const successDiv = document.getElementById('success');
        const submitBtn = document.getElementById('submitBtn');

        async function signInWithGoogle() {
          const errorDiv = document.getElementById('error');
          errorDiv.style.display = 'none';
          
          try {
            const response = await fetch('/api/auth/sign-in/social', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                provider: 'google',
                callbackURL: '/dashboard'
              })
            });
            
            console.log('Sign-in response status:', response.status);
            console.log('Sign-in response headers:', Object.fromEntries(response.headers.entries()));
            
            // Check if response is a redirect
            if (response.redirected || response.status === 302 || response.status === 307) {
              const location = response.headers.get('location') || response.url;
              console.log('Redirecting to:', location);
              window.location.href = location;
              return;
            }
            
            // Try to parse as JSON
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
              const data = await response.json();
              console.log('Sign-in response data:', data);
              
              if (data.url) {
                window.location.href = data.url;
              } else if (data.error) {
                errorDiv.textContent = data.error;
                errorDiv.style.display = 'block';
              } else {
                errorDiv.textContent = 'Failed to initiate Google login';
                errorDiv.style.display = 'block';
              }
            } else {
              // Not JSON, might be HTML or redirect
              const text = await response.text();
              console.log('Non-JSON response:', text.substring(0, 200));
              
              if (!response.ok) {
                errorDiv.textContent = 'Error ' + response.status + ': ' + response.statusText;
                errorDiv.style.display = 'block';
              } else {
                errorDiv.textContent = 'Unexpected response from server';
                errorDiv.style.display = 'block';
              }
            }
          } catch (error) {
            console.error('Google sign-in error:', error);
            errorDiv.textContent = 'An error occurred during Google sign-in. Please try again.';
            errorDiv.style.display = 'block';
          }
        }

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          // Clear previous messages
          errorDiv.style.display = 'none';
          successDiv.style.display = 'none';
          
          // Show loading state
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="loading"></span>Logging in...';
          
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          
          try {
            const response = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ email, password }),
            });
            
            const data = await response.json();
            
            if (data.success) {
              successDiv.textContent = 'Login successful! Redirecting...';
              successDiv.style.display = 'block';
              
              // Store user in localStorage for client-side access
              localStorage.setItem('user', JSON.stringify(data.user));
              
              // Redirect to dashboard
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 500);
            } else {
              errorDiv.textContent = data.error || 'Login failed';
              errorDiv.style.display = 'block';
              submitBtn.disabled = false;
              submitBtn.textContent = 'Login';
            }
          } catch (err) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
          }
        });

        // Check if already logged in
        (async () => {
          try {
            const response = await fetch('/api/me', { credentials: 'include' });
            const data = await response.json();
            if (data.authenticated) {
              window.location.href = '/dashboard';
            }
          } catch (e) {}
        })();
      </script>
    </body>
    </html>
  `
}

/**
 * Render register page
 */
export function renderRegisterPage(
  error?: string,
  success?: string,
  username?: string,
  email?: string
) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Register</title>
      <style>${authStyles}
        button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .loading {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid #fff;
          border-radius: 50%;
          border-top-color: transparent;
          animation: spin 0.8s linear infinite;
          margin-right: 8px;
          vertical-align: middle;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="auth-container">
        <h1>Register</h1>
        <div id="error" class="error" style="display: none;"></div>
        <div id="success" class="success" style="display: none;"></div>
        ${error ? html`<div class="error">${error}</div>` : ''}
        ${success ? html`<div class="success">${success}</div>` : ''}
        <form id="registerForm">
          <div class="form-group">
            <label for="username">Username</label>
            <input 
              type="text" 
              id="username" 
              name="username" 
              required 
              autocomplete="username"
              placeholder="Choose a username"
              value="${username || ''}"
              minlength="3"
              maxlength="50"
            />
          </div>
          <div class="form-group">
            <label for="email">Email</label>
            <input 
              type="email" 
              id="email" 
              name="email" 
              required 
              autocomplete="email"
              placeholder="Enter your email"
              value="${email || ''}"
            />
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input 
              type="password" 
              id="password" 
              name="password" 
              required 
              autocomplete="new-password"
              placeholder="Create a password"
              minlength="8"
            />
          </div>
          <div class="form-group">
            <label for="confirmPassword">Confirm Password</label>
            <input 
              type="password" 
              id="confirmPassword" 
              name="confirmPassword" 
              required 
              autocomplete="new-password"
              placeholder="Confirm your password"
              minlength="8"
            />
          </div>
          <button type="submit" id="submitBtn">Register</button>
        </form>
        <p class="link">Already have an account? <a href="/auth/login">Login</a></p>
      </div>
      <script>
        const form = document.getElementById('registerForm');
        const errorDiv = document.getElementById('error');
        const successDiv = document.getElementById('success');
        const submitBtn = document.getElementById('submitBtn');

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          // Clear previous messages
          errorDiv.style.display = 'none';
          successDiv.style.display = 'none';
          
          const username = document.getElementById('username').value;
          const email = document.getElementById('email').value;
          const password = document.getElementById('password').value;
          const confirmPassword = document.getElementById('confirmPassword').value;
          
          // Client-side validation
          if (password !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
            return;
          }
          
          // Show loading state
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span class="loading"></span>Creating account...';
          
          try {
            const response = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ username, email, password, confirmPassword }),
            });
            
            const data = await response.json();
            
            if (data.success) {
              successDiv.textContent = 'Account created! Redirecting...';
              successDiv.style.display = 'block';
              
              // Store user in localStorage for client-side access
              localStorage.setItem('user', JSON.stringify(data.user));
              
              // Redirect to dashboard
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 500);
            } else {
              errorDiv.textContent = data.error || 'Registration failed';
              errorDiv.style.display = 'block';
              submitBtn.disabled = false;
              submitBtn.textContent = 'Register';
            }
          } catch (err) {
            errorDiv.textContent = 'Network error. Please try again.';
            errorDiv.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
          }
        });

        // Check if already logged in
        (async () => {
          try {
            const response = await fetch('/api/me', { credentials: 'include' });
            const data = await response.json();
            if (data.authenticated) {
              window.location.href = '/dashboard';
            }
          } catch (e) {}
        })();
      </script>
    </body>
    </html>
  `
}

/**
 * Render dashboard page (protected)
 */
export function renderDashboard(username: string, email: string) {
  return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard - Chat</title>
      <style>${dashboardStyles}</style>
    </head>
    <body>
      <nav class="navbar">
        <h1>AI Chat</h1>
        <div class="user-info">
          <span>Welcome, ${username}</span>
          <button id="logoutBtn">Logout</button>
        </div>
      </nav>

      <div class="chat-container">
        <!-- Sidebar -->
        <aside class="chat-sidebar">
          <div class="sidebar-header">
            <button class="new-chat-btn" id="newChatBtn">+ New Chat</button>
          </div>
          <div class="thread-list" id="threadList">
            <div class="no-threads">No conversations yet</div>
          </div>
        </aside>

        <!-- Main Chat Area -->
        <main class="chat-main">
          <div class="messages-container" id="messagesContainer">
            <div class="messages-list" id="messagesList">
              <div class="empty-chat">
                <div class="empty-chat-icon">💬</div>
                <h3>Start a conversation</h3>
                <p>Send a message to begin chatting with the AI</p>
              </div>
            </div>
          </div>

          <div class="input-container">
            <div class="input-wrapper">
              <textarea 
                class="chat-input" 
                id="chatInput" 
                placeholder="Type your message..."
                rows="1"
              ></textarea>
              <button class="send-btn" id="sendBtn">Send</button>
            </div>
          </div>
        </main>
      </div>

      <script>
        // State
        let currentThreadId = null;
        let threads = [];
        let isLoading = false;
        let currentThreadHasMessages = false; // Track if current thread has any messages

        // DOM Elements
        const threadList = document.getElementById('threadList');
        const messagesList = document.getElementById('messagesList');
        const messagesContainer = document.getElementById('messagesContainer');
        const chatInput = document.getElementById('chatInput');
        const sendBtn = document.getElementById('sendBtn');
        const newChatBtn = document.getElementById('newChatBtn');

        // Auto-resize textarea
        chatInput.addEventListener('input', () => {
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
        });

        // Send message on Enter (Shift+Enter for newline)
        chatInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
          }
        });

        // Send button click
        sendBtn.addEventListener('click', sendMessage);

        // New chat button - wrap in arrow function to avoid passing event as forceCreate
        newChatBtn.addEventListener('click', () => createNewThread(false));

        // Event delegation for thread clicks (works even after re-renders)
        threadList.addEventListener('click', (e) => {
          const threadItem = e.target.closest('.thread-item');
          if (threadItem) {
            const threadId = threadItem.getAttribute('data-thread-id');
            if (threadId) {
              selectThread(threadId);
            }
          }
        });

        // Load threads on page load
        loadThreads();

        // Load threads from API
        async function loadThreads() {
          try {
            console.log('[Frontend] Loading threads...');
            const response = await fetch('/api/chat/threads', { credentials: 'include' });
            const data = await response.json();
            
            console.log('[Frontend] Threads response:', data);
            
            if (data.success) {
              threads = Array.isArray(data.threads) ? data.threads : [];
              console.log('[Frontend] Loaded ' + threads.length + ' threads');
              renderThreadList();
              
              // If there are threads, select the most recent one
              if (threads.length > 0 && !currentThreadId) {
                console.log('[Frontend] Selecting most recent thread: ' + threads[0].id);
                selectThread(threads[0].id);
              }
            } else {
              console.error('[Frontend] Failed to load threads:', data.error);
              threadList.innerHTML = '<div class="no-threads">Failed to load conversations</div>';
            }
          } catch (err) {
            console.error('[Frontend] Failed to load threads:', err);
            threadList.innerHTML = '<div class="no-threads">Error loading conversations</div>';
          }
        }

        // Render thread list
        function renderThreadList() {
          if (threads.length === 0) {
            threadList.innerHTML = '<div class="no-threads">No conversations yet</div>';
            return;
          }

          threadList.innerHTML = threads.map(thread => \`
            <div class="thread-item \${thread.id === currentThreadId ? 'active' : ''}" 
                 data-thread-id="\${thread.id}">
              <span class="thread-icon">💬</span>
              <span class="thread-title">\${escapeHtml(thread.title || 'New Chat')}</span>
            </div>
          \`).join('');
        }

        // Select a thread
        async function selectThread(threadId) {
          currentThreadId = threadId;
          renderThreadList();
          await loadMessages(threadId);
        }

        // Load messages for a thread
        async function loadMessages(threadId) {
          try {
            messagesList.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
            
            const response = await fetch(\`/api/chat/history?threadId=\${threadId}\`, { credentials: 'include' });
            const data = await response.json();
            
            if (data.success) {
              currentThreadHasMessages = data.messages && data.messages.length > 0;
              renderMessages(data.messages);
            } else {
              currentThreadHasMessages = false;
              renderEmptyChat();
            }
          } catch (err) {
            console.error('Failed to load messages:', err);
            currentThreadHasMessages = false;
            renderEmptyChat();
          }
        }

        // Render messages
        function renderMessages(messages) {
          if (messages.length === 0) {
            renderEmptyChat();
            return;
          }

          messagesList.innerHTML = messages.map(msg => \`
            <div class="message \${msg.role}">
              <div class="message-avatar">\${msg.role === 'user' ? '👤' : '🤖'}</div>
              <div class="message-content">\${escapeHtml(msg.content)}</div>
            </div>
          \`).join('');

          scrollToBottom();
        }

        // Render empty chat state
        function renderEmptyChat() {
          messagesList.innerHTML = \`
            <div class="empty-chat">
              <div class="empty-chat-icon">💬</div>
              <h3>Start a conversation</h3>
              <p>Send a message to begin chatting with the AI</p>
            </div>
          \`;
        }

        // Create new thread
        async function createNewThread(forceCreate = false) {
          // If current thread is empty (no messages), just reuse it instead of creating a new one
          if (!forceCreate && currentThreadId && !currentThreadHasMessages) {
            renderEmptyChat();
            chatInput.focus();
            return;
          }

          try {
            const response = await fetch('/api/chat/threads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ title: 'New Chat' }),
            });
            
            const data = await response.json();
            
            if (data.success) {
              // Refresh the full thread list to ensure we have the latest data
              await loadThreads();
              // Set the newly created thread as current
              currentThreadId = data.thread.id;
              currentThreadHasMessages = false; // New thread has no messages
              renderThreadList();
              renderEmptyChat();
              chatInput.focus();
            }
          } catch (err) {
            console.error('Failed to create thread:', err);
          }
        }

        // Send message
        async function sendMessage() {
          const message = chatInput.value.trim();
          if (!message || isLoading) return;

          // Create thread if none exists (force create since we're about to send a message)
          if (!currentThreadId) {
            await createNewThread(true);
          }

          isLoading = true;
          sendBtn.disabled = true;
          chatInput.disabled = true;

          // Clear input
          chatInput.value = '';
          chatInput.style.height = 'auto';

          // Add user message to UI immediately
          const emptyChat = messagesList.querySelector('.empty-chat');
          if (emptyChat) {
            messagesList.innerHTML = '';
          }

          messagesList.innerHTML += \`
            <div class="message user">
              <div class="message-avatar">👤</div>
              <div class="message-content">\${escapeHtml(message)}</div>
            </div>
          \`;

          // Add loading indicator
          messagesList.innerHTML += \`
            <div class="message assistant" id="loadingMessage">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                <div class="loading-dots"><span></span><span></span><span></span></div>
              </div>
            </div>
          \`;

          scrollToBottom();

          try {
            const response = await fetch('/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ threadId: currentThreadId, message }),
            });

            const data = await response.json();

            // Remove loading message
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) loadingMessage.remove();

            if (data.success) {
              // Mark that this thread now has messages
              currentThreadHasMessages = true;

              // Add assistant response
              messagesList.innerHTML += \`
                <div class="message assistant">
                  <div class="message-avatar">🤖</div>
                  <div class="message-content">\${escapeHtml(data.assistantMessage.content)}</div>
                </div>
              \`;
              scrollToBottom();

              // Update thread title if it was the first message
              const thread = threads.find(t => t.id === currentThreadId);
              if (thread && thread.title === 'New Chat') {
                thread.title = message.substring(0, 30) + (message.length > 30 ? '...' : '');
                renderThreadList();
              }
            } else {
              // Show error with actual error message from API
              const errorMsg = data.error || 'Sorry, something went wrong. Please try again.';
              messagesList.innerHTML += \`
                <div class="message assistant">
                  <div class="message-avatar">❌</div>
                  <div class="message-content">\${escapeHtml(errorMsg)}</div>
                </div>
              \`;
            }
          } catch (err) {
            console.error('Send message error:', err);
            const loadingMessage = document.getElementById('loadingMessage');
            if (loadingMessage) loadingMessage.remove();
            
            messagesList.innerHTML += \`
              <div class="message assistant">
                <div class="message-avatar">❌</div>
                <div class="message-content">Network error. Please try again.</div>
              </div>
            \`;
          } finally {
            isLoading = false;
            sendBtn.disabled = false;
            chatInput.disabled = false;
            chatInput.focus();
          }
        }

        // Scroll to bottom of messages
        function scrollToBottom() {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
          const div = document.createElement('div');
          div.textContent = text;
          return div.innerHTML;
        }

        // Handle logout
        document.getElementById('logoutBtn').addEventListener('click', async () => {
          try {
            const response = await fetch('/api/logout', {
              method: 'POST',
              credentials: 'include',
            });
            
            const data = await response.json();
            
            if (data.success) {
              localStorage.removeItem('user');
              window.location.href = '/auth/login';
            }
          } catch (err) {
            console.error('Logout error:', err);
            localStorage.removeItem('user');
            window.location.href = '/auth/login';
          }
        });

        // Verify session is still valid
        (async () => {
          try {
            const response = await fetch('/api/me', { credentials: 'include' });
            const data = await response.json();
            if (!data.authenticated) {
              localStorage.removeItem('user');
              window.location.href = '/auth/login';
            }
          } catch (e) {}
        })();
      </script>
    </body>
    </html>
  `
}
