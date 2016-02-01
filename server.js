// ==============================================================
// ================== REQUIRES ==================================
// ==============================================================
var express = require('express');
	var app = express();
		app.use(express.static(__dirname));//define static default path
var http = require('http').Server(app);
var jade = require('jade');
  app.set('view engine', 'jade');

var assert = require('assert');
var ent = require('ent'); // Permet de bloquer les caractères HTML (sécurité équivalente à htmlentities en PHP)

var session = require("express-session")({
    secret: "my-secret",
    resave: true,
    saveUninitialized: true
  });

var io = require('socket.io')(http);
var launcher = require(__dirname+'/modules/launcher')(io);
launcher.getConnectedUsers();

var sharedsession = require("express-socket.io-session");
	app.use(session); 
	io.use(sharedsession(session, {
	    autoSave:true
	}));

var auth = require(__dirname+'/modules/authentication');
var user = require(__dirname +'/modules/user');

var bodyParser = require('body-parser'); // Charge le middleware de gestion des paramètres
  app.use( bodyParser.json() );       // to support JSON-encoded bodies
  app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
  })); 

// ==========================================
// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var PORT = 3000;

// ==============================================================
// ================== ROUTES ====================================
// ==============================================================
app.use(function(req,res,next){
    console.log('============',req.method, ' ', req.originalUrl,'============');
    res.locals.session = req.session;
    next();
});

		//APP ROUTE
app.get('/', auth.checkAuthorized, function(req, res){
	res.render('index');
});
app.get('/home', auth.checkAuthorized, function(req, res){
  res.redirect('/');
});
		//TEST ROUTE
app.get('/test', function(req, res){
	res.render('test');
});

		//USER LOGIN ROUTE
app.get('/login', function (req, res) {
  res.render('login');
});
app.post('/login', function (req, res){
  console.log('Attempt login...');
  auth.login(req, res, function onError(err){
  	req.session.redirectmessage='ERROR: '+ err.message;
  	res.redirect('/login');
  });
});
app.get('/register', function (req, res){
  res.render('register');
});
app.post('/register', function (req, res){
  console.log('Attempt register...');
  user.create(req, res, function (err, msg, result){
    if (err){
      console.log('Register error='+ err.message);//todo- vrai error =
      req.session.redirectmessage='ERROR: '+ err.message;
      res.redirect('/register');
    } else if (msg){
      console.log('Register failed: '+ msg);//todo- vrai error =
      req.session.redirectmessage='Signup failed: '+ msg;
      res.redirect('/register');
    } else {
      console.log('Register: success');
      console.log('Attempt login...');
      auth.login(req, res);
      });}

});
app.get('/logout', function (req, res){
  req.session.user = null;
  req.session.redirectmessage = 'You were successfully disconnected';
  res.redirect('/login');
});
		//CONNECTED USER ROUTE
app.get('/connectedUsers',auth.checkAuthorized, function (req, res){//TODO !!!!!!!!
	var usersToSend = [];
	for (index in launcher.getConnectedUsers()){
		if(users[index].name!=req.session.user.name){
			usersToSend.push(users[index].name);//TODO: tester pk KO
		}
	}
  	res.send(usersToSend);
});



// ==============================================================
// ================== LISTEN ====================================
// ==============================================================
http.listen(PORT, function(){
  console.log('listening on *:'+PORT);
});