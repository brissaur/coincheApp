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
app.get('/test', function(req, res){
	res.render('test');
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
	for (index in users){
		if(users[index].name!=req.session.user.name){
			usersToSend.push(users[index].name);//TODO: tester pk KO
		}
	}
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
	    //////////////////A VIRER TEST
	    msg.players.forEach(function(pName){
	    	Games.accept(gameID,pName);
	    });
	    if (Games.readyToStart(gameID)){
			console.log('Game ready to start');
			Games.init(gameID, function(game){
				for (pIndex in game.playersIndexes){
					var pName = game.playersIndexes[pIndex];
					io.to(users[pName].socket).emit('initialize_game', 
						{msg:'', players: game.playersIndexes, dealer: game.currentDealer});
				}
				game.nextJetee(function(){
					for (pIndex in game.playersIndexes){
						var pName = game.playersIndexes[pIndex];
						io.to(users[pName].socket).emit('distribution', 
							{msg:'', cards: game.players[pName].cards});
					}
					// console.log('playable cards: ' + 'trump=' + game.currentTrump + '&currentColor=' + game.colorPlayed() + '&cards=' + game.playableCards());
					io.to(users[game.playersIndexes[game.currentPlayer]].socket).emit('announce', {gameID:gameID, lastAnnounce:0, msg:'readyToStart'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

				});
			});
		}
	    //////////////////A VIRER 

	    //TODO: set Timeout si client rep pas
    	msg.players.forEach(function(pName){
			assert(users[pName]);
	    	users[pName].game = {gameID:gameID};//, accepted:false}; ---> ca veut dire quil es toccupé par une game quil ait accepte ou pas
		});
		//sender auto accepts
	    // rooms[gameID] = {players: gamePlayers,  currentPlayer:null, currentDealer:null, firstTrickPlayer:null, deck:null}//comment on check ils acceptent
	    //TODO: decommenter underneath
	    // socket.broadcast.emit('game_invitation', {name: name, message: '', gameID: gameID});//TODO EVOL roadcast+print local
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
				for (pIndex in game.playersIndexes){
					var pName = game.playersIndexes[pIndex];
					io.to(users[pName].socket).emit('initialize_game', 
						{msg:'', players: game.playersIndexes, dealer: game.currentDealer});
				}
				game.nextJetee(function(){
					for (pIndex in game.playersIndexes){
						var pName = game.playersIndexes[pIndex];
						io.to(users[pName].socket).emit('distribution', 
							{msg:'', cards: game.players[pName].cards});
					}
					// console.log('playable cards: ' + 'trump=' + game.currentTrump + '&currentColor=' + game.colorPlayed() + '&cards=' + game.playableCards());
					io.to(users[game.playersIndexes[game.currentPlayer]].socket).emit('announce', {gameID:msg.gameID, lastAnnounce:0, msg:'real Start'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

				});
			});
		}

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
	    
  	});
	// <<<<<<<<<<<< Manage a player annonce >>>>>>>>>>>>>>
  	socket.on('announce', function(msg){//.card + .player + .firstPlayer
		var name = socket.handshake.session.user.name;
  		console.log({type: 'announce', value:msg.value, color: msg.color, name: name});
  		assert(users[name]);
  		var thisGame = Games.game(msg.gameID);
  		thisGame.announce(name, msg.value,msg.color, function(err, finalAnnounce){
  			console.log({type:'game.js did announce', name:name, value:msg.value,color:msg.color, finalAnnounce:finalAnnounce});
  			if (err) return 0;
  			socket.broadcast.emit('announced', {gameID:msg.gameID, value:msg.value, color:msg.color, msg:'', name:name});
  			if (finalAnnounce){//send all puis send ifrst
				for (pIndex in thisGame.playersIndexes){
					var pName = thisGame.playersIndexes[pIndex];
					io.to(users[pName].socket).emit('chosen_trumps', 
						{msg:'', color: finalAnnounce.color, value: finalAnnounce.value});
				}
				if (finalAnnounce.value == 0){//TODO: next game
					console.log('all passed');
					thisGame.nextJetee(function(){
						console.log('next game after all passed');
						for (pIndex in thisGame.playersIndexes){
							var pName = thisGame.playersIndexes[pIndex];
							console.log('redistribution to ...'+ pName);
							io.to(users[pName].socket).emit('distribution', 
								// {msg:'', cards: ['8H','9H','10H','JH','AS','10S','9D','7D']});
								{msg:'', cards: thisGame.players[pName].cards});
						}
						// console.log('playable cards: ' + 'trump=' + thisGame.currentTrump + '&currentColor=' + thisGame.colorPlayed() + '&cards=' + thisGame.playableCards());
						// setTimeout(function(){
							io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('announce', {gameID:msg.gameID, lastAnnounce:0, msg:'all passed'});	
						// }, 2*TIMEUNIT);
					});
				} else {
  					console.log('finalAnnounce lets play');
					io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('play', {message:'',gameID:msg.gameID, cards: thisGame.playableCards()});	
				}
			} else {
				console.log('next annonce');
				io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('announce', {gameID:msg.gameID, lastAnnounce:(thisGame.currentAnnounce.value), msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler
			}
			

  		});
  	});
  	
	// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
  	socket.on('play', function(msg){//.card + .player + .firstPlayer
		var name = socket.handshake.session.user.name;
  		//VERIFICATIONS
  		// console.log('play');
  		assert(users[name]);
  		var thisGame = Games.game(msg.gameID);
  		thisGame.play(name, msg.card,function(endTrick, endJetee, endGame){
			io.emit('played', {name: name, card:msg.card});//TODO: Gérer les erreurs
			if (endGame){
				// console.log('endJetee');
				// setTimeout(function(){
				// 	io.emit('end_trick', {message:'trick well ended'});
				// 	for (pIndex in thisGame.playersIndexes){
				// 		var pName = thisGame.playersIndexes[pIndex];
				// 		io.to(users[pName].socket).emit('end_jetee', 
				// 			{message:'jetee well ended', cards: thisGame.players[pName].cards});
				// 	}
				// 	// io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('play', {message:'',gameID:msg.gameID});	
				// },2*TIMEUNIT);
			} else if (endJetee){
				console.log('endJetee');
				setTimeout(function(){
					io.emit('end_trick', {message:'trick well ended'});
					for (pIndex in thisGame.playersIndexes){
						var pName = thisGame.playersIndexes[pIndex];
						io.to(users[pName].socket).emit('end_jetee', {message:'jetee well ended'});
						io.to(users[pName].socket).emit('distribution', {message:'', cards: thisGame.players[pName].cards});
					}
				io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('announce', {gameID:msg.gameID, lastAnnounce:(thisGame.currentAnnounce.value), msg:'next announce'});//TODO: pas bon choix en théorie car peut jouer quune partie a la foi... donc server devrait sen rappeler

				},1*TIMEUNIT);
				
			} else if (endTrick){
				setTimeout(function(){
					io.emit('end_trick', {message:'trick well ended'});
					io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('play', {message:'',gameID:msg.gameID, cards: thisGame.playableCards()});	
				},1*TIMEUNIT);
			} else {
				// console.log('playable cards: ' + 'trump=' + thisGame.currentTrump + '&currentColor=' + thisGame.colorPlayed() + '&cards=' + thisGame.playableCards());
				io.to(users[thisGame.playersIndexes[thisGame.currentPlayer]].socket).emit('play', {message:'',gameID:msg.gameID, cards: thisGame.playableCards()});	
			}//TODO: END 8cardGame
  		});
  	});
});


//LISTEN
http.listen(PORT, function(){
  console.log('listening on *:'+PORT);
});