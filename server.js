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
app.get('/connectedUsers',auth.checkAuthorized, function (req, res){
	var usersToSend = [];
	for (user in users){
		if(user!=req.session.user.name){
			usersToSend.push(user);//TODO: ne pas renvoyé le nom du client / lenlever a larrivee
		}
	}
    console.dir(usersToSend);
  	res.send(usersToSend);
});
// ==============================================================
// ================== SOCKETS ===================================
// ==============================================================
io.on('connection', function(socket){
	if (socket.handshake.session.user){
		var name=socket.handshake.session.user.name;
		console.log(name + ' connected with socket ' + socket.id);
		users[name] = {socket: socket.id, name: name, game:null};
		socket.emit('connection_accepted', {message:'Connection accepted', name: name});//when connection refused? how?
		socket.broadcast.emit('connection', {name: name});
	} else {
		socket.emit('connection_refused', {message:'Connection refused. Please refresh your browser (F5).'});//when connection refused? how?
		socket.disconnect();
	}
	// <<<<<<<<<<<< Ask for pseudo >>>>>>>>>>>>>>
	// socket.emit('identification_required',{});//TODO EVOL : si server reboot, on perd infos de session (client doit le srenvoyer)
	// <<<<<<<<<<<< Manage disconnection >>>>>>>>>>>>>>
	socket.on('disconnect', function(){
		if (socket.handshake.session.user){
			var name=socket.handshake.session.user.name;
			delete users[name];
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
		var name = socket.handshake.session.user.name;
	    console.log('Chat message from '+ name + ': '+ msg.message);
	    io.emit('chat_message', {name: name, message: msg.message});//TODO EVOL roadcast+print local
  	});
	// <<<<<<<<<<<< Manage game invitation >>>>>>>>>>>>>>
	socket.on('game_invitation', function(msg){
		//TODO: verifier que users.game = null (= quil peut etre invité)
		var name = socket.handshake.session.user.name;
		//créer un namespace ET SEN RAPELLER
	    console.log('Game invitation from '+ name + ' for '+ msg.players);
	    var gameID = Math.floor((Math.random() * 1000));
	    //TODO: set Timeout si client rep pas
	    // var gamePlayers = msg.players;
	    var gamePlayers = [];
    	msg.players.forEach(function(pName){
			assert(users[pName]);
	    	users[pName].game = {gameID:gameID, accepted:false};
		    gamePlayers.push(pName);//plus sécuriser
		});
		//sender auto accepts
		users[name].game.accepted=true;
	    rooms[gameID] = {players: gamePlayers,  currentPlayer:null, currentDealer:null, firstTrickPlayer:null}//comment on check ils acceptent
	    socket.broadcast.emit('game_invitation', {name: name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
  	});
	socket.on('game_invitation_accepted', function(msg){//msg-> gameID
		var name = socket.handshake.session.user.name;
	    var thisRoom = rooms[msg.gameID];
	    if (thisRoom){
	    	//TODO: check player est dedans la room
		    console.log('Game invitation accepted by '+ name);
		    assert(users[name].game);
		    users[name].game.accepted=true;;
		    var gameMustStart=true;
			thisRoom.players.forEach(function(pName){
				assert(users[pName]);
				assert(users[pName].game);
				console.log(pName+'-->'+users[pName].game.accepted);
				gameMustStart = gameMustStart && users[pName].game.accepted;
			});
		    // var players = thisRoom.players;
		    // players[users[socket.id].name] = socket.id;

		    // for (player in players){
		    // 	// console.log(players);
		    // 	gameMustStart=gameMustStart && players[player];
		    // }
		    if (gameMustStart){
				console.log('initialize_game');
				// var playersToSend = [];
				// for (player in players){
				// 	playersToSend.push(player);
				// }
		    	nbPlayers = thisRoom.players.length;
		    	assert(nbPlayers==MAXPLAYER);
		    	rand=Math.floor((Math.random() * MAXPLAYER));
				thisRoom.currentDealer=rand;
				thisRoom.firstTrickPlayer=(rand+1)%MAXPLAYER;
				thisRoom.currentPlayer=(rand+1)%MAXPLAYER;

				io.emit('initialize_game', {players: thisRoom.players, dealer: thisRoom.currentDealer});

				io.to(users[thisRoom.players[thisRoom.currentPlayer]].socket).emit('play', {gameID:msg.gameID});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
				console.log(users[thisRoom.players[thisRoom.currentPlayer]].socket);
				// console.log(thisRoom.players[thisRoom.currentPlayer]);
		    }

		} else {
			console.log('game ' + msg.gameID + ' already cancelled');
		}
	    // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
  	});
	socket.on('game_invitation_refused', function(msg){
		var name = socket.handshake.session.user.name;
	    console.log('Game invitation refused by '+ name);
	    io.emit('game_invitation_cancelled', {message:'', gameID: msg.gameID, name:name});
	    rooms[msg.gameID].players.forEach(function(pName){
	    	assert(users[pName]);
	    	assert(users[pName].game);
	    	users[pName].game = null;
	    });
	    delete rooms[msg.gameID];
	    // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
  	});
	// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
  	socket.on('play', function(msg){//.card + .player + .firstPlayer
  		var thisRoom = rooms[msg.gameID];
		var name = socket.handshake.session.user.name;

  		assert(thisRoom!=null);
  		assert(thisRoom!=='undefined');
  		assert(thisRoom.players.indexOf(name)===thisRoom.currentPlayer);
		io.emit('played', {name: name, card:msg.card});
		if (thisRoom.firstTrickPlayer==((thisRoom.currentPlayer+1)%MAXPLAYER)){
			setTimeout(function(){
				console.log('endTrick');
				io.emit('end_trick', {message:'trick well ended'});
				thisRoom.currentPlayer = Math.floor((Math.random() * MAXPLAYER));//TODO EVOL: calculé quia  gagné le pli
				thisRoom.firstTrickPlayer = thisRoom.currentPlayer;
				io.to(users[thisRoom.players[thisRoom.currentPlayer]].socket).emit('play', {message:'',gameID:msg.gameID});	
			},2*TIMEUNIT);
		} else {
			thisRoom.currentPlayer=(thisRoom.currentPlayer+1)%MAXPLAYER;
			io.to(users[thisRoom.players[thisRoom.currentPlayer]].socket).emit('play', {gameID:msg.gameID});	
		}
  	});
});


//LISTEN
http.listen(PORT, function(){
  console.log('listening on *:'+PORT);
});