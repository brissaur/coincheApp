// var a = {};
// a['a'] = 'aa';
// a['b'] = 'bb';
// for (e in a){
// 	console.log(e);
// }
// var a2 = [];
// a2.push('aa');
// a2.push('bb');
// for (e in a2){
// 	console.log(e);
// }
// a2.forEach(function(e){
// 	console.log(e);
// })
// //RETURNS ab 01 aabb
	// console.log(players);
	// players.forEach(function(pName){
	// 		console.log(pName);

	// 	test[pName]={};
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

var auth = require(__dirname+'/modules/authentication');
var user = require(__dirname +'/modules/user');
// var Deck = require(__dirname+'/modules/deck');
var Games = require(__dirname+'/modules/game');

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
var AUTHORIZEDCARDS=['7H','8H','9H','10H','JH','QH','KH','AH','7D','8D','9D','10D','JD','QD','KD','AD','7S','8S','9S','10S','JS','QS','KS','AS','7C','8C','9C','10C','JC','QC','KC','AC'];
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
app.get('/connectedUsers',auth.checkAuthorized, function (req, res){//TODO !!!!!!!!
	var usersToSend = [];
	for (user in users){
		if(user!=req.session.user.name){
			usersToSend.push(user);//TODO: tester pk KO
		}
	}
	usersToSend.sort();
    // console.dir(usersToSend);
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
	//TEST
		// socket.emit('initialize_game', {msg:'', players: ['a','b'], dealer: 'a', cards: ['9H','8S','JC','10H','JH','QH','KH','AH']});
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
		//créer un namespace ET SEN RAPELLER -> dans Games[]
	    console.log('Game invitation from '+ name + ' for '+ msg.players);
	    
	    var gameID = Games.invite(msg.players);
	    Games.accept(gameID,name);
	    //TODO: set Timeout si client rep pas
    	msg.players.forEach(function(pName){
			assert(users[pName]);
	    	users[pName].game = {gameID:gameID};//, accepted:false}; ---> ca veut dire quil es toccupé par une game quil ait accepte ou pas
		});
		//sender auto accepts
	    // rooms[gameID] = {players: gamePlayers,  currentPlayer:null, currentDealer:null, firstTrickPlayer:null, deck:null}//comment on check ils acceptent
	    socket.broadcast.emit('game_invitation', {name: name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
  	});
	socket.on('game_invitation_accepted', function(msg){//msg-> gameID
		var name = socket.handshake.session.user.name;
	    // var thisRoom = rooms[msg.gameID];
	    assert(users[name]);
	    assert(users[name].game);
	    assert(users[name].game.gameID==msg.gameID);

		Games.accept(msg.gameID, name);
		if (Games.readyToStart(msg.gameID)){
			console.log('Game ready to start');
			Games.init(msg.gameID, function(game){
				thisGame = game;
				thisGame.start(function(){
					for (pIndex in thisGame.playersIndexes){
						var pName = thisGame.playersIndexes[pIndex];
						console.log(thisGame.players[pName]);
						io.to(users[pName].socket).emit('initialize_game', 
							{msg:'', players: thisGame.playersIndexes, dealer: thisGame.currentDealer, cards: thisGame.players[pName].cards});
					}
					io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('play', {gameID:msg.gameID});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

				});
			});
		}

			// var cards=thisGame.deck.distribute();
			// for (pIndex in thisGame.players){
			// 	users[thisGame.players[pIndex]].game.cards=cards[pIndex];
			// 	io.to(users[thisGame.players[pIndex]].socket).emit('initialize_game', {msg:'', players: thisGame.players, dealer: thisGame.currentDealer, cards: cards[pIndex]});
			// }

			// 	io.to(users[thisGame.players[thisGame.currentPlayer]].socket).emit('play', {gameID:msg.gameID});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
				// console.log(users[thisGame.players[thisGame.currentPlayer]].socket);
				// console.log(thisGame.players[thisGame.currentPlayer]);
	    // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
  	});
	socket.on('game_invitation_refused', function(msg){
		var name = socket.handshake.session.user.name;
	    console.log('Game invitation refused by '+ name);
	    
	    io.emit('game_invitation_cancelled', {message:'', gameID: msg.gameID, name:name});
	    Games.game(msg.gameID).playersIndexes().forEach(function(pName){
	    	assert(users[pName]);
	    	assert(users[pName].game);
	    	users[pName].game=null;
	    })
	    Games.refuse(msg.gameID, name);
	    
	    // rooms[msg.gameID].players.forEach(function(pName){
	    // 	assert(users[pName]);
	    // 	assert(users[pName].game);
	    // 	users[pName].game = null;
	    // });
	    // delete rooms[msg.gameID];
	    // io.emit('game_invitation', {name: users[socket.id].name, message: '', gameID: Math.floor((Math.random() * 1000))});//TODO EVOL roadcast+print local
  	});
	// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
  	socket.on('play', function(msg){//.card + .player + .firstPlayer
  		var thisRoom = rooms[msg.gameID];
  		var thisGame = rooms[msg.gameID].game;
		var name = socket.handshake.session.user.name;
  		//VERIFICATIONS
  		assert(thisRoom);
  		assert(users[name]);
  		assert(thisRoom.players.indexOf(name)!=-1);
  		assert(users[name].game.gameID==msg.gameID);
  		assert(thisRoom.players.indexOf(name)===thisRoom.currentPlayer);

  		assert(AUTHORIZEDCARDS.indexOf(msg.card)!=-1, 'AUTHORIZEDCARDS.indexOf(msg.card): ' + AUTHORIZEDCARDS.indexOf(msg.card) +' ' + msg.card);
  		//remove played card from hand
  		var cardIndex = users[name].game.cards.indexOf(msg.card);
  	// 	console.log(msg.cards);
  	// 	console.log(users[name].game.cards);
 		// console.log(cardIndex);
  		users[name].game.cards;
  		assert(cardIndex!=-1, 'User played '+msg.card+' but available cards should be '+ users[name].game.cards);
  		users[name].game.cards.splice(cardIndex, 1);

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