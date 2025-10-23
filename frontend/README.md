Restaurant Management - Frontend Registration Form

Files:
- index.html - registration form HTML
- styles.css - styling
- script.js - client-side validation and mock save to localStorage

Open locally:
You can open `index.html` directly in your browser by double-clicking it.

Serve with a simple HTTP server (PowerShell):

```powershell
# Uses Python if installed
python -m http.server 8000
# or, if python3 is the command
python3 -m http.server 8000
# then open http://localhost:8000 in your browser
```

Notes:
- This is a static mock frontend. It performs client-side validation and saves registered users to `localStorage` under the key `rm_users`.
- Next steps: implement backend API, integrate with auth, add better UI flows and tests.