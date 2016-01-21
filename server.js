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
// var session = require ('express-session');
// 	app.use(session({secret: "This is a secret",resave: true,saveUninitialized: true}));
var io = require('socket.io')(http);
var sharedsession = require("express-socket.io-session");
	app.use(session); 
	io.use(sharedsession(session, {
	    autoSave:true
	}));

var auth = require('D:/projects/coincheApp/modules/authentication');
var user = require('D:/projects/coincheApp/modules/user');

var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';

var bodyParser = require('body-parser'); // Charge le middleware de gestion des paramètres
  app.use( bodyParser.json() );       // to support JSON-encoded bodies
  app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
  })); 
// ==========================================
// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var MAXPLAYER=2;
var TIMEUNIT = 1000;
var PORT = 3000;
var rooms = {};
var Room = {
	namespace:'',
	players : [],//socket ID
	currentPlayer : null,
	currentDealer : null,
	firstTrickPlayer : null
}
var users = {}//iid = socketId
// var User = {
// 	id: '',//socket ID
// 	name: ''
// }
// ==============================================================
// ================== ROUTES ====================================
// ==============================================================
app.use(function(req,res,next){
    console.log('============',req.method, ' ', req.originalUrl,'============');
    res.locals.session = req.session;
    // console.dir(req.session);
    next();
});
app.get('/', auth.checkAuthorized, function(req, res){
	res.render('index');
});
app.get('/home', auth.checkAuthorized, function(req, res){
  res.redirect('/');
});
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
    }
  });
});
app.get('/logout', function (req, res){
  req.session.user = null;
  req.session.redirectmessage = 'You were successfully disconnected';
  res.redirect('/login');
});
app.get('/connectedUsers', function (req, res){
	var usersToSend = [];
	for (user in users){
		usersToSend.push(users[user].name);//TODO: ne pas renvoyé le nom du client / lenlever a larrivee
	}
    console.dir(users);
  	res.send(usersToSend);
});
// ==============================================================
// ================== SOCKETS ===================================
// ==============================================================
io.on('connection', function(socket){
	if (socket.handshake.session.user){
		var name=socket.handshake.session.user.name;
		console.log(name + ' connected with socket ' + socket.id);
		users[socket.id] = {id: socket.id, name: name};
		Room.players.push(socket.id);
		// console.log(' OK : socket.handshake.session.user');
		socket.emit('connection_accepted', {message:'Connection accepted', name: name});//when connection refused? how?
		socket.broadcast.emit('connection', {name: name});
	} else {
		socket.emit('connection_refused', {message:'Connection refused. Please refresh your browser (F5).'});//when connection refused? how?
		socket.disconnect();
		// console.log(' WARNING : NO socket.handshake.session.user');//TODO: gros probleme lors de la reconnection du server:/ = refuser le socket et demander le refresh
	}
	// <<<<<<<<<<<< Ask for pseudo >>>>>>>>>>>>>>
	// socket.emit('identification_required',{});//TODO EVOL : si server reboot, on perd infos de session (client doit le srenvoyer)
	// <<<<<<<<<<<< Manage disconnection >>>>>>>>>>>>>>
	socket.on('disconnect', function(){
		if (users[socket.id]){
			var name=users[socket.id].name;
			delete users[socket.id];
		}else{
			var name='visitor';
    		// console.dir(users);
    		// console.dir('this socket id = ' +socket.id);//TODO: probleme doublons qd refresh rapide
		}
   		console.log(name + ' disconnected.');
		socket.broadcast.emit('disconnection', {name:name});
	});
	// <<<<<<<<<<<< Manage chat message >>>>>>>>>>>>>>
	socket.on('chat_message', function(msg){
	    console.log('Chat message from '+ users[socket.id].name + ': '+ msg.message);
	    io.emit('chat_message', {name: users[socket.id].name, message: msg.message});//TODO EVOL roadcast+print local
  	});
	// <<<<<<<<<<<< Manage game invitation >>>>>>>>>>>>>>
	socket.on('game_invitation', function(msg){
		//créer un namespace ET SEN RAPELLER
	    console.log('Game invitation from '+ users[socket.id].name + ' for '+ msg.players);
	    var gameID = Math.floor((Math.random() * 1000));
	    socket.broadcast.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
	    //TODO: set Timeout si client rep pas
	    // var gamePlayers = msg.players;
	    var playersIndex = {};
	    playersIndex['a']=0;//TODO: PRIORITAIRE:
	    playersIndex['b']=1;
	    var gamePlayers = [];
	    gamePlayers.push(socket);
	    gamePlayers[users[socket.id].name]=socket.id;

	    // {name:'b', accepted:false}, {name:'a', accepted:false}];
	    
	    // gamePlayers.push(users[socket.id].name);
	    rooms[gameID] = {players: gamePlayers, playersIndex: playersIndex, currentPlayer:null, currentDealer:null, firstTrickPlayer:null}//comment on check ils acceptent
  	});
	socket.on('game_invitation_accepted', function(msg){//msg-> gameID
	    if (rooms[msg.gameID]){
		    console.log('Game invitation accepted by '+ users[socket.id].name);
		    var thisRoom = rooms[msg.gameID];
		    var players = thisRoom.players;
		    players[users[socket.id].name] = socket.id;
		    var gameMustStart=true;

		    for (player in players){
		    	// console.log(players);
		    	gameMustStart=gameMustStart && players[player];
		    }
		    if (gameMustStart){
				console.log('initialize_game');
				var playersToSend = [];
				for (player in players){
					playersToSend.push(player);
				}
		    	nbPlayers = playersToSend.length;
		    	rand=Math.floor((Math.random() * nbPlayers));
				thisRoom.currentDealer=rand;
				thisRoom.firstTrickPlayer=(rand+1)%nbPlayers;
				thisRoom.currentPlayer=(rand+1)%nbPlayers;

				io.emit('initialize_game', {players: playersToSend, dealer: thisRoom.currentDealer});

				io.to(thisRoom.players[playersToSend[thisRoom.currentPlayer]]).emit('play', {gameID:msg.gameID});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
				console.log(thisRoom.currentPlayer);
				console.log(thisRoom.players[thisRoom.currentPlayer]);
		    }

		} else {
			console.log('game ' + msg.gameID + ' already cancelled');
		}
	    // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
  	});
	socket.on('game_invitation_refused', function(msg){
	    console.log('Game invitation refused by '+ users[socket.id].name);
	    io.emit('game_invitation_cancelled', {message:'', gameID: msg.gameID, name:users[socket.id].name});
	    delete rooms[msg.gameID];
	    // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
  	});
	// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
  	socket.on('play', function(msg){//.card + .player + .firstPlayer
  		var thisRoom = rooms[msg.gameID];

  		assert(thisRoom!=null);
  		assert(thisRoom!=='undefined');
  		assert(thisRoom.players.indexOf(socket.id)===thisRoom.currentPlayer, 'Its not that player s turn...' + thisRoom.players.indexOf(socket.id)+'==!'+thisRoom.currentPlayer);
		io.emit('played', {name: users[socket.id].name, card:msg.card});
		if (thisRoom.firstTrickPlayer==((thisRoom.currentPlayer+1)%MAXPLAYER)){
			setTimeout(function(){
				console.log('endTrick');
				io.emit('end_trick', {message:'trick well ended'});
				thisRoom.currentPlayer = Math.floor((Math.random() * MAXPLAYER));//TODO EVOL: calculé quia  gagné le pli
				thisRoom.firstTrickPlayer = thisRoom.currentPlayer;
				io.to(thisRoom.players[thisRoom.currentPlayer]).emit('play', {gameID:msg.gameID});	
			},2*TIMEUNIT);
		} else {
			thisRoom.currentPlayer=(thisRoom.currentPlayer+1)%MAXPLAYER;
			io.to(thisRoom.players[thisRoom.currentPlayer]).emit('play', {gameID:msg.gameID});	
		}
  	});
});


//LISTEN
http.listen(PORT, function(){
  console.log('listening on *:'+PORT);
});