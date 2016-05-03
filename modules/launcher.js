// ==============================================================
// ================== REQUIRES ==================================
// ==============================================================
var Games;
var MongoClient = require('mongodb').MongoClient;
var assert = require('assert');
var users = require('./connectedUsers');


// ==============================================================
// ================== GLOBAL VARS ===============================
// ==============================================================
var MAXPLAYER=2;
var TIMEUNIT = 1000;
var rooms = {};
var launcher = {};
// var url = 'mongodb://localhost:27017/test';



module.exports = function(io){
	var test = {};
	var Games = require('./game')(io);
	// // ==============================================================
	// // ================== SOCKETS ===================================
	// // ==============================================================
	io.on('connection', function(socket){
		/*** FUNCTION CALLED ON A NEW CLIENT/SOCKET***/
		if (socket.handshake.session.user){
			var name=socket.handshake.session.user.name;
			if (users[name]){
				users[name].socket = socket.id;
				if (users[name].game){
					users[name].status = 'in_game';
				} else {
					users[name].status = 'available';
				}
			} else {
				users[name] = {socket: socket.id, name: name, game:null, status: 'available'};
			}
				console.log(new Date() + ' INFO ' + 'CONNECTION ' + 'user ' + name + ' is connected');
				socket.emit('connection_accepted', {message:'Connection accepted', name: name});//when connection refused? how?
				socket.broadcast.emit('connection', {user:{name: name, status: users[name].status}});
				if (users[name].game) Games.game(users[name].game.gameID).reconnect(name);
		} else {
			socket.emit('connection_refused', {message:'Connection refused. Please refresh your browser (F5).'});//when connection refused? how?
			socket.disconnect();
		}
		/**********************************************************************************************************/
		/************************************************ LISTENERS **********************************************/
		/*********************************************************************************************************/
		// <<<<<<<<<<<< Manage disconnection >>>>>>>>>>>>>>
		socket.on('disconnect', function(){
			if (socket.handshake.session.user){
				var name=socket.handshake.session.user.name;
				if (users[name]){
					if (users[name].status == 'in_game' && users[name].game){
						users[name].socket = null; 
					} else {
						if((users[name].status == 'hosting' || users[name].status == 'pending_invite')&& users[name].game){
							Games.leaveRoom(name);
						}
						delete users[name];
					}
				}
			}else{
				var name='visitor';
			}
			console.log(new Date() + ' INFO ' + 'DISCONNECTION ' + 'user ' + name + ' is disconnected');
			socket.broadcast.emit('disconnection', {name:name});
		});
		// <<<<<<<<<<<< Manage chat message >>>>>>>>>>>>>>
		socket.on('chat_message', function(msg){
			var name = socket.handshake.session.user.name;
			assert(users[name]);
			if (msg.message.trim().length > 0 ) io.emit('chat_message', {name: name, message: msg.message});//TODO EVOL roadcast+print local
	  	});
		// <<<<<<<<<<<< Manage game invitation >>>>>>>>>>>>>>
		socket.on('new_game', function(msg){
			var name = socket.handshake.session.user.name;
			Games.newRoom(name);
	  	});

		socket.on('game_invitation', function(msg){
			//TODO: check user input
			var name = socket.handshake.session.user.name;
		   	Games.invite(name,msg.players);
	  	});
		socket.on('game_invitation_accepted', function(msg){
			var name = socket.handshake.session.user.name;
		    assert(users[name]);
		    assert(users[name].game);

			Games.accept(name);
	  	});
		socket.on('game_invitation_refused', function(msg){
			var name = socket.handshake.session.user.name;
		    Games.refuse(name);
	  	});
	  	socket.on('leave_room', function(msg){
			var name = socket.handshake.session.user.name;
		    Games.leaveRoom(name);
	  	});
	  	socket.on('swap_place', function(msg){
			var name = socket.handshake.session.user.name;
	  		Games.swapPlace(name, msg.name);
	  	});
	  	socket.on('start_game', function(msg){
			var name = socket.handshake.session.user.name;
	  		Games.startGame(name);
	  	});

		// <<<<<<<<<<<< Manage a player annonce >>>>>>>>>>>>>>
	  	socket.on('announce', function(msg){
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.announce(name, msg.value,msg.color);
	  	});
	  	socket.on('coinche', function(msg){
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.coinche(name);
	  	});
	  	
		// <<<<<<<<<<<< Manage a player plays >>>>>>>>>>>>>>
	  	socket.on('play', function(msg){
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.play(name, msg.card);
	  	});

	  	socket.on('leave_game', function(msg){
			var name = socket.handshake.session.user.name;
	  		assert(users[name]);
	  		
	  		var thisGame = Games.game(users[name].game.gameID);
	  		thisGame.leaveGame(name);
	  		users[name].game = null;
	  	});
	});
	return launcher;
}

launcher.getConnectedUsers = function(){
	return users;
}