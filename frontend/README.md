 # Restaurant Management - Frontend Registration & Login
 
 Files:
 
 - `index.html` - registration form HTML
 - `login.html` - login page
 - `dashboard.html` - simple post-login placeholder
 - `styles.css` - styling
 - `script.js` - registration form client-side validation and mock save to `localStorage`
 - `login.js` - login page logic (mock auth)
 - `server.js` - tiny Node static server
 - `package.json` - project manifest
 
 Run locally
 
 1) Using Node (recommended):
 
 ```powershell
 cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\frontend"
 npm install  # optional, no dependencies but safe
 npm start
 # Open http://localhost:8000 in your browser
 ```
 
 2) Using Python (if installed):
 
 ```powershell
 cd "C:\Users\kabou\Documents\Vionix Labs\Fpga_test\frontend"
 python -m http.server 8000
 # Open http://localhost:8000
 ```
 
 Testing the flow
 
 - Register: open `index.html`, fill the form and submit. The user will be saved in `localStorage` under the key `rm_users`.
 - Sign in: open `login.html`, enter the email you registered with (password is not checked in this mock). On success you'll be redirected to `dashboard.html` and a `rm_session` will be saved.
 
 Notes:
 
 - This is a static mock frontend. To integrate with a real backend, update `script.js` and `login.js` to POST to your API endpoints and perform proper authentication.