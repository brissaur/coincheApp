var Games;
var MongoClient = require('mongodb').MongoClient;
var url = 'mongodb://localhost:27017/test';
var assert = require('assert');

var MAXPLAYER=2;
var TIMEUNIT = 1000;
var rooms = {};
var users = require('./connectedUsers');
var launcher = {};

module.exports = function(io){
	var test = {};
	var Games = require('./game')(io);
	// // ==============================================================
	// // ================== SOCKETS ===================================
	// // ==============================================================
	io.on('connection', function(socket){
		if (socket.handshake.session.user){
			var name=socket.handshake.session.user.name;
			console.log(name + ' connected with socket ' + socket.id);
			users[name] = {socket: socket.id, name: name, game:null};
			Games.test();
			socket.emit('connection_accepted', {message:'Connection accepted', name: name});//when connection refused? how?
			socket.broadcast.emit('connection', {name: name});
		//TEST
			// socket.emit('initialize_game', {msg:'', players: ['a','b'], dealer: 'a', cards: ['9H','8S','JC','10H','JH','QH','KH','AH']});
		} else {
			socket.emit('connection_refused', {message:'Connection refused. Please refresh your browser (F5).'});//when connection refused? how?
			socket.disconnect();
		}

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
		    
		   	Games.invite(msg.players);
	  	});
		socket.on('game_invitation_accepted', function(msg){//msg-> gameID
			var name = socket.handshake.session.user.name;
		    // var thisRoom = rooms[msg.gameID];
		    assert(users[name]);
		    assert(users[name].game);
		    assert(users[name].game.gameID==msg.gameID);

			Games.accept(msg.gameID, name);
	  	});
		socket.on('game_invitation_refused', function(msg){
			var name = socket.handshake.session.user.name;
		    console.log('Game invitation refused by '+ name);
		    
		    Games.refuse(msg.gameID, name);
	  	});

		// <<<<<<<<<<<< Manage a player annonce >>>>>>>>>>>>>>
	  	socket.on('announce', function(msg){//.card + .player + .firstPlayer
			var name = socket.handshake.session.user.name;
	  		console.log({type: 'announce', value:msg.value, color: msg.color, name: name});
	  		assert(users[name]);
	  		var thisGame = Games.game(msg.gameID);
	  		thisGame.announce(name, msg.value,msg.color);
	  	});
	  	
		// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
	  	socket.on('play', function(msg){//.card + .player + .firstPlayer
			var name = socket.handshake.session.user.name;
	  		//VERIFICATIONS
	  		// console.log('play');
	  		assert(users[name]);
	  		var thisGame = Games.game(msg.gameID);
	  		thisGame.play(name, msg.card);
	  	});
	});
	return launcher;
}

launcher.getConnectedUsers = function(){
	return users;
}

// module.exports = function (io) {

// var Room = {
// 	namespace:'',
// 	players : [],//socket ID
// 	currentPlayer : null,
// 	currentDealer : null,
// 	firstTrickPlayer : null
// }

