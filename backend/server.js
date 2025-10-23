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
const NODE_ENV = process.env.NODE_ENV || 'development';
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'dev-secret-change-me');
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'db.json');

if(NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required in production');
  process.exit(1);
}

app.use(bodyParser.json({limit:'10kb'}));
app.use(bodyParser.urlencoded({limit:'10kb'}));
app.use(cookieParser());
app.use(cors({ origin: process.env.CORS_ORIGIN || true, credentials: true }));

// Validation helpers
const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (pwd) => pwd && pwd.length >= 8;
const sanitizeString = (str) => String(str||'').trim().slice(0,255);

function readDB(){
  try{
    const data = fs.readFileSync(DB_FILE,'utf8');
    return JSON.parse(data || '{}');
  }catch(e){
    console.error('Error reading DB:', e.message);
    return {users:[]};
  }
}

function writeDB(db){
  try{
    fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2));
  }catch(e){
    console.error('Error writing DB:', e.message);
    throw new Error('Database write failed');
  }
}

// ensure db exists
try{
  if(!fs.existsSync(DB_FILE)) writeDB({users:[]});
}catch(e){
  console.error('Failed to initialize database:', e.message);
}

app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password, restaurantName, role } = req.body;
    
    // Input validation
    const cleanEmail = sanitizeString(email).toLowerCase();
    const cleanFirst = sanitizeString(firstName);
    const cleanLast = sanitizeString(lastName);
    const cleanRestaurant = sanitizeString(restaurantName);
    
    if(!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    if(!password || !validatePassword(password)) {
      return res.status(400).json({error:'Password must be at least 8 characters'});
    }
    if(!cleanFirst || cleanFirst.length < 2) {
      return res.status(400).json({error:'First name must be at least 2 characters'});
    }
    if(!cleanLast || cleanLast.length < 2) {
      return res.status(400).json({error:'Last name must be at least 2 characters'});
    }
    if(!cleanRestaurant || cleanRestaurant.length < 2) {
      return res.status(400).json({error:'Restaurant name must be at least 2 characters'});
    }
    if(!role || !['owner','manager','staff'].includes(role)) {
      return res.status(400).json({error:'Invalid role'});
    }
    
    const db = readDB();
    if(db.users.find(u=>u.email === cleanEmail)){
      return res.status(409).json({error:'User already exists'});
    }
    
    const hash = await bcrypt.hash(password, 10);
    const user = {
      id: Date.now(),
      firstName: cleanFirst,
      lastName: cleanLast,
      email: cleanEmail,
      passwordHash: hash,
      restaurantName: cleanRestaurant,
      role,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    writeDB(db);
    
    res.status(201).json({id:user.id, email:user.email, message:'User created successfully'});
  }catch(e){
    console.error('Register error:', e.message);
    res.status(500).json({error:'Registration failed'});
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    const cleanEmail = sanitizeString(email).toLowerCase();
    
    if(!cleanEmail || !validateEmail(cleanEmail)) {
      return res.status(400).json({error:'Valid email is required'});
    }
    if(!password) {
      return res.status(400).json({error:'Password is required'});
    }
    
    const db = readDB();
    const user = db.users.find(u=>u.email === cleanEmail);
    if(!user) {
      return res.status(401).json({error:'Invalid credentials'});
    }
    
    const match = await bcrypt.compare(password, user.passwordHash);
    if(!match) {
      return res.status(401).json({error:'Invalid credentials'});
    }
    
    const token = jwt.sign({id:user.id, email:user.email}, JWT_SECRET, {expiresIn:'2h'});
    const secure = NODE_ENV === 'production';
    res.cookie('rm_auth', token, {
      httpOnly: true,
      secure: secure,
      sameSite: 'Strict',
      maxAge: 2 * 60 * 60 * 1000 // 2 hours
    });
    res.json({ok:true, message:'Login successful'});
  }catch(e){
    console.error('Login error:', e.message);
    res.status(500).json({error:'Login failed'});
  }
});

app.post('/api/logout', (req, res)=>{
  res.clearCookie('rm_auth', {httpOnly:true, secure: NODE_ENV === 'production', sameSite:'Strict'});
  res.json({ok:true, message:'Logged out successfully'});
});

app.get('/api/me', (req, res)=>{
  try {
    const token = req.cookies.rm_auth;
    if(!token) {
      return res.status(401).json({error:'Not authenticated'});
    }
    
    const data = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find(u=>u.id === data.id);
    
    if(!user) {
      return res.status(401).json({error:'User not found'});
    }
    
    const {passwordHash, ...safe} = user;
    res.json({user:safe});
  }catch(e){
    if(e.name === 'TokenExpiredError') {
      res.clearCookie('rm_auth');
      return res.status(401).json({error:'Session expired'});
    }
    console.error('Auth error:', e.message);
    res.status(401).json({error:'Invalid token'});
  }
});

app.use(express.static(path.join(__dirname,'..','frontend')));

if(require.main === module){
  app.listen(PORT, ()=>console.log(`Backend running on http://localhost:${PORT} (${NODE_ENV})`));
}

module.exports = app;
