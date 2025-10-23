const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const DB_FILE = path.join(__dirname, 'db.json');

app.use(bodyParser.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

function readDB(){
  try{ return JSON.parse(fs.readFileSync(DB_FILE,'utf8')||'{}'); }catch(e){ return {users:[]}; }
}
function writeDB(db){ fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }

// ensure db exists
if(!fs.existsSync(DB_FILE)) writeDB({users:[]});

app.post('/api/register', async (req, res) => {
  const { firstName, lastName, email, password, restaurantName, role } = req.body;
  if(!email || !password) return res.status(400).json({error:'email and password required'});
  const db = readDB();
  if(db.users.find(u=>u.email.toLowerCase()===email.toLowerCase())){
    return res.status(409).json({error:'User already exists'});
  }
  const hash = await bcrypt.hash(password, 10);
  const user = { id: Date.now(), firstName, lastName, email: email.toLowerCase(), passwordHash: hash, restaurantName, role, createdAt: new Date().toISOString() };
  db.users.push(user);
  writeDB(db);
  res.json({id:user.id, email:user.email});
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if(!email || !password) return res.status(400).json({error:'email and password required'});
  const db = readDB();
  const user = db.users.find(u=>u.email.toLowerCase()===email.toLowerCase());
  if(!user) return res.status(401).json({error:'Invalid credentials'});
  const match = await bcrypt.compare(password, user.passwordHash);
  if(!match) return res.status(401).json({error:'Invalid credentials'});
  const token = jwt.sign({id:user.id,email:user.email}, JWT_SECRET, {expiresIn:'2h'});
  res.cookie('rm_auth', token, { httpOnly: true, secure: false, sameSite: 'lax' });
  res.json({ok:true});
});

app.post('/api/logout', (req, res)=>{
  res.clearCookie('rm_auth'); res.json({ok:true});
});

app.get('/api/me', (req, res)=>{
  const token = req.cookies.rm_auth;
  if(!token) return res.status(401).json({error:'Not authenticated'});
  try{
    const data = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find(u=>u.id===data.id);
    if(!user) return res.status(401).json({error:'Not authenticated'});
    const {passwordHash, ...safe} = user;
    res.json({user:safe});
  }catch(e){ return res.status(401).json({error:'Invalid token'}); }
});

app.use(express.static(path.join(__dirname,'..','frontend')));

app.listen(PORT, ()=>console.log(`Backend running on http://localhost:${PORT}`));
