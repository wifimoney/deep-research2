
import { html } from 'hono/html'

export const Dashboard = (props: { username: string; email: string }) => {
    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Dashboard</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3b82f6;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body class="bg-gray-100 h-screen flex flex-col font-sans">
      <!-- Navbar -->
      <nav class="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
        <h1 class="text-xl font-bold flex items-center gap-2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 15v4a1 1 0 01-1 1H6a1 1 0 01-1-1v-4m14-3v4m-3 0v-4m-3-9v4m-4 1v3m8-3v3"></path></svg>
            Smart Dashboard
        </h1>
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold border border-blue-400">
                ${props.username.charAt(0).toUpperCase()}
            </div>
            <span class="text-sm cursor-help" title="${props.email}">${props.username}</span>
          </div>
          <button onclick="logout()" class="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm transition-colors border border-blue-600">Logout</button>
        </div>
      </nav>

      <!-- Main Content -->
      <main class="flex-1 flex overflow-hidden">
        
        <!-- Sidebar (Data Sources) -->
        <aside class="w-80 bg-white border-r border-gray-200 overflow-y-auto hidden md:block flex-shrink-0">
            <div class="p-4 border-b border-gray-100">
                <h2 class="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <svg class="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    Recent Emails
                </h2>
                <div id="gmail-list" class="space-y-3">
                    <div class="flex justify-center p-4">
                         <div class="loader"></div>
                    </div>
                </div>
            </div>

            <div class="p-4">
                <h2 class="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                    Contacts
                </h2>
                <div id="contacts-list" class="space-y-3">
                    <div class="flex justify-center p-4">
                         <div class="loader"></div>
                    </div>
                </div>
            </div>
        </aside>

        <!-- Chat Area -->
        <section class="flex-1 flex flex-col bg-gray-50 min-w-0">
            <div id="chat-messages" class="flex-1 overflow-y-auto p-6 space-y-4">
                <!-- Welcome Message -->
                <div class="flex items-start gap-4">
                    <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs flex-shrink-0">AI</div>
                    <div class="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm max-w-2xl text-gray-700 border border-gray-100">
                        <p>Hello ${props.username}! I can help you manage your digital life. Ask me things like:</p>
                        <ul class="list-disc ml-5 mt-2 space-y-1 text-sm text-gray-600">
                            <li>"Show me unread emails from John"</li>
                            <li>"What was the last email about 'project x'?"</li>
                            <li>"List my contacts named 'Smith'"</li>
                        </ul>
                    </div>
                </div>
            </div>

            <!-- Input Area -->
            <div class="p-4 bg-white border-t border-gray-200">
                <form id="chat-form" class="max-w-4xl mx-auto relative flex gap-2">
                    <input 
                        type="text" 
                        id="chat-input" 
                        class="w-full p-4 pr-12 rounded-xl border border-gray-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-sm transition-all"
                        placeholder="Ask about your emails or contacts..."
                        autocomplete="off"
                    >
                    <button type="submit" class="absolute right-3 top-1/2 -translate-y-1/2 text-purple-600 hover:text-purple-700 p-1">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                    </button>
                    <div id="thinking-indicator" class="hidden absolute right-12 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <span class="w-2 h-2 bg-purple-400 rounded-full animate-bounce"></span>
                        <span class="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-75"></span>
                        <span class="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-150"></span>
                    </div>
                </form>
            </div>
        </section>
      </main>

      <script>
        // Store thread ID globally
        let currentThreadId = null;

        // Fetch Gmail Data
        fetch('/api/dashboard/gmail')
            .then(res => res.json())
            .then(data => {
                const list = document.getElementById('gmail-list');
                if (data.success && data.messages.length > 0) {
                    list.innerHTML = data.messages.map(msg => \`
                        <div class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-sm">
                            <div class="font-semibold text-gray-800 truncate">\${msg.from || 'Unknown'}</div>
                            <div class="text-blue-600 truncate font-medium">\${msg.subject || 'No Subject'}</div>
                            <div class="text-xs text-gray-400 mt-1">\${new Date(msg.date).toLocaleDateString()}</div>
                        </div>
                    \`).join('');
                } else {
                    list.innerHTML = '<div class="text-sm text-gray-500 text-center p-4">No emails found</div>';
                }
            })
            .catch(() => {
                document.getElementById('gmail-list').innerHTML = '<div class="text-sm text-red-500 text-center p-4">Failed to load emails</div>';
            });

        // Fetch Contacts Data
        fetch('/api/dashboard/contacts')
            .then(res => res.json())
            .then(data => {
                const list = document.getElementById('contacts-list');
                if (data.success && data.contacts.length > 0) {
                    list.innerHTML = data.contacts.map(c => \`
                        <div class="bg-white p-3 rounded-lg border border-gray-100 shadow-sm flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold text-xs uppercase">
                                \${(c.name || '?').charAt(0)}
                            </div>
                            <div class="overflow-hidden">
                                <div class="font-medium text-gray-800 text-sm truncate">\${c.name || 'Unnamed'}</div>
                                <div class="text-xs text-gray-500 truncate">\${c.email || c.phone || 'No details'}</div>
                            </div>
                        </div>
                    \`).join('');
                } else {
                    list.innerHTML = '<div class="text-sm text-gray-500 text-center p-4">No contacts found</div>';
                }
            })
            .catch(() => {
                 document.getElementById('contacts-list').innerHTML = '<div class="text-sm text-red-500 text-center p-4">Failed to load contacts</div>';
            });

        // Chat Logic
        const chatForm = document.getElementById('chat-form');
        const chatInput = document.getElementById('chat-input');
        const chatMessages = document.getElementById('chat-messages');
        const thinkingIndicator = document.getElementById('thinking-indicator');

        chatForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const message = chatInput.value.trim();
            if (!message) return;

            // Add user message
            addMessage(message, 'user');
            chatInput.value = '';
            thinkingIndicator.classList.remove('hidden');

            try {
                const res = await fetch('/api/dashboard/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message,
                        threadId: currentThreadId
                    })
                });
                
                const data = await res.json();
                
                thinkingIndicator.classList.add('hidden');
                
                if (data.success) {
                    currentThreadId = data.threadId;
                    addMessage(data.assistantMessage.content, 'assistant');
                } else {
                    addMessage('Sorry, I encountered an error: ' + (data.error || 'Unknown error'), 'assistant');
                }
            } catch (err) {
                thinkingIndicator.classList.add('hidden');
                addMessage('Sorry, something went wrong. Please check your connection.', 'assistant');
            }
        });

        function addMessage(text, role) {
            const isUser = role === 'user';
            const div = document.createElement('div');
            div.className = \`flex items-start gap-4 \${isUser ? 'flex-row-reverse' : ''}\`;
            
            div.innerHTML = \`
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs flex-shrink-0 \${isUser ? 'bg-blue-600' : 'bg-purple-600'}">
                    \${isUser ? 'ME' : 'AI'}
                </div>
                <div class="p-4 rounded-2xl shadow-sm max-w-2xl border \${
                    isUser 
                    ? 'bg-blue-600 text-white rounded-tr-none border-blue-500' 
                    : 'bg-white text-gray-700 rounded-tl-none border-gray-100'
                }">
                    <p class="whitespace-pre-wrap text-sm leading-relaxed">\${formatText(text)}</p>
                </div>
            \`;
            
            chatMessages.appendChild(div);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }

        function formatText(text) {
             // Simple basic formatting
             return text.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
        }

        async function logout() {
            await fetch('/api/logout', { method: 'POST' });
            window.location.href = '/auth/login';
        }
      </script>
    </body>
    </html>
  `
}
