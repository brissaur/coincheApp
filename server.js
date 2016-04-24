// ==============================================================
// ================== REQUIRES ==================================
// ==============================================================
/*** CORE EXPRESS APP***/
var express = require('express');
	var app = express();
		app.use(express.static(__dirname));//define static default path (for js & css files)
var http = require('http').Server(app);
var http = require('http').createServer(app);
/*** LANGUAGE FOR HTML TEMPLATES ***/
var jade = require('jade');
  app.set('view engine', 'jade');

var assert = require('assert');
var ent = require('ent'); //useful?

/*** MESSAGES ***/
var io = require('socket.io')(http);
var launcher = require(__dirname+'/modules/launcher')(io);

/*** SESSIONS ***/
var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
  });

/*** ENABLE SHARED VAR BETWEEN SOCKET & SESSIONS ***/
var sharedsession = require("express-socket.io-session");
	app.use(session); 
	io.use(sharedsession(session, {
	    autoSave:true
	}));

/*** PARSER FOR POST REQUESTS PARAMETERS***/
var bodyParser = require('body-parser');
  app.use( bodyParser.json() );       // to support JSON-encoded bodies
  app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
  })); 

/*** LOCAL MODULES HANDLING SESSION CONNECTIONS ***/
var auth = require(__dirname+'/modules/authentication');
var user = require(__dirname +'/modules/user');
// ==========================================
// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var PORT = 3000;
var logDate = new Date();
// ==============================================================
// ================== ROUTES ====================================
// ==============================================================
app.use(function(req,res,next){
    // console.log('============',req.method, ' ', req.originalUrl,'============');
    res.locals.session = req.session;
    next();
});
/*** APP ROUTE ***/
app.get('/', auth.checkAuthorized, function(req, res){
	res.render('index');
});
app.get('/home', auth.checkAuthorized, function(req, res){
  res.redirect('/');
});
/*** TEST ROUTE ***/
app.get('/test', function(req, res){
	res.render('test');
});

/*** USER LOGIN ROUTE ***/
app.get('/login', function (req, res) {
  res.render('login');
});
app.post('/login', function (req, res){
  auth.login(req, res, function onError(err){
  	req.session.redirectmessage='ERROR: '+ err.message;
  	res.redirect('/login');
  });
});
app.get('/register', function (req, res){
  res.render('register');
});
app.post('/register', function (req, res){
  	user.create(req, res, function (err, msg, result){
	    if (err){
	      req.session.redirectmessage='ERROR: '+ err.message;
	      res.redirect('/register');
	    } else if (msg){
	      req.session.redirectmessage='Signup failed: '+ msg;
	      res.redirect('/register');
	    } else {
	      auth.login(req, res);
	    }
	});
});
app.get('/logout', function (req, res){
  console.log(logDate + ' INFO ' + 'DISCONNECT ' + 'user ' + req.session.user.name +' disconnected manually');
  req.session.user = null;
  req.session.redirectmessage = 'You were successfully disconnected';
  res.redirect('/login');
});
/*** CONNECTED USER ROUTE ***/
app.get('/connectedUsers',auth.checkAuthorized, function (req, res){
	var usersToSend = [];
	var users = launcher.getConnectedUsers();
	for (index in users){
		if(users[index].name!=req.session.user.name){
			usersToSend.push({name: users[index].name, status: users[index].status});
		}
	}
	//Return a table containing, for each connected user, a duet {name, status} where name is the name of the user and status its status (ex: available, in_game...)
  	res.send(usersToSend.sort(function(a,b){
  		return a.name > b.name;
  	}));
});

// ==============================================================
// ================== LISTEN ====================================
// ==============================================================
http.listen(PORT, '0.0.0.0', function(){
  console.log('listening on *:'+PORT);
});