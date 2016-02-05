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
			// console.log(name + ' connected with socket ' + socket.id);
			socket.emit('connection_accepted', {message:'Connection accepted', name: name});//when connection refused? how?
			socket.broadcast.emit('connection', {name: name});
			
			if (users[name]){
				users[name].socket = socket.id;
				if (users[name].game) Games.game(users[name].game.gameID).reconnect(name);
			} else {
				users[name] = {socket: socket.id, name: name, game:null};
			}
		} else {
			socket.emit('connection_refused', {message:'Connection refused. Please refresh your browser (F5).'});//when connection refused? how?
			socket.disconnect();
			// socket.emit('reconnection', {message:''});
		}
		// socket.on('reconnection', function(){
			
			// socket.disconnect();
		// })
		// <<<<<<<<<<<< Manage disconnection >>>>>>>>>>>>>>
		socket.on('disconnect', function(){
			if (socket.handshake.session.user){
				var name=socket.handshake.session.user.name;
				if (users[name].game){
					users[name].socket = null; 
				} else {
					delete users[name];
				}
			}else{
				var name='visitor';
			}
			socket.broadcast.emit('disconnection', {name:name});
		});
		// <<<<<<<<<<<< Manage chat message >>>>>>>>>>>>>>
		socket.on('chat_message', function(msg){
			var name = socket.handshake.session.user.name;
			assert(users[name]);
			if (msg.message.trim().length > 0 ) io.emit('chat_message', {name: name, message: msg.message});//TODO EVOL roadcast+print local
	  	});
		// <<<<<<<<<<<< Manage game invitation >>>>>>>>>>>>>>
		socket.on('game_invitation', function(msg){
			//todo check input user
			var name = socket.handshake.session.user.name;
		   	Games.invite(name,msg.players);
	  	});
		socket.on('game_invitation_accepted', function(msg){//msg-> gameID
			var name = socket.handshake.session.user.name;
		    assert(users[name]);
		    assert(users[name].game);

			Games.accept(users[name].game.gameID, name);
	  	});
		socket.on('game_invitation_refused', function(msg){
			var name = socket.handshake.session.user.name;
		    Games.refuse(users[name].game.gameID, name);
	  	});

		// <<<<<<<<<<<< Manage a player annonce >>>>>>>>>>>>>>
	  	socket.on('announce', function(msg){//.card + .player + .firstPlayer
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.announce(name, msg.value,msg.color);
	  	});
	  	socket.on('coinche', function(msg){//.card + .player + .firstPlayer
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		console.log({type: 'coinche', name: name});
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.coinche(name);
	  	});
	  	
		// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
	  	socket.on('play', function(msg){//.card + .player + .firstPlayer
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.play(name, msg.card);
	  	});
	});
	return launcher;
}

launcher.getConnectedUsers = function(){
	return users;
}